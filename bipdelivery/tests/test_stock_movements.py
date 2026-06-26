"""Etapa 1 and 2 of the stock-movement evolution: manual entrada/saida
auditing (Etapa 1) and the store-wide ledger (Etapa 2).

See docs/architecture/stock-movement-evolution.md. Reuses TwoStoreFixtureMixin
(test_store_active_isolation.py) for cross-store isolation: `self.client` is
authenticated as store B's manager (is_staff=True), `self.product_a`/
`self.product_b` belong to store A/B respectively.
"""
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from bipdelivery.api.models import Product, SaleOrder, StockMovement, StoreMembership
from bipdelivery.tests.test_store_active_isolation import TwoStoreFixtureMixin


class StockMovementAPITest(TwoStoreFixtureMixin, TestCase):
    def _movements_url(self, product: Product) -> str:
        return f"/api/v1/products/{product.id}/stock-movements/"

    def setUp(self) -> None:
        super().setUp()
        self.product_b.stock_quantity = 10
        self.product_b.save(update_fields=["stock_quantity"])

    def test_manual_entrada_increases_stock_and_creates_movement(self) -> None:
        response = self.client.post(
            self._movements_url(self.product_b),
            {"movement_type": "entrada", "quantity": 5, "reason": "compra"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.product_b.refresh_from_db()
        self.assertEqual(self.product_b.stock_quantity, 15)
        self.assertEqual(response.data["product"]["stock_quantity"], 15)

        movement = StockMovement.objects.get(product=self.product_b)
        self.assertEqual(movement.movement_type, StockMovement.TYPE_ENTRADA)
        self.assertEqual(movement.reason, StockMovement.REASON_COMPRA)
        self.assertEqual(movement.source, StockMovement.SOURCE_MANUAL)
        self.assertEqual(movement.previous_stock, 10)
        self.assertEqual(movement.new_stock, 15)
        self.assertEqual(movement.performed_by, self.user_b)

    def test_manual_saida_decreases_stock_and_creates_movement(self) -> None:
        response = self.client.post(
            self._movements_url(self.product_b),
            {"movement_type": "saida", "quantity": 4, "reason": "perda_avaria"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.product_b.refresh_from_db()
        self.assertEqual(self.product_b.stock_quantity, 6)

        movement = StockMovement.objects.get(product=self.product_b)
        self.assertEqual(movement.movement_type, StockMovement.TYPE_SAIDA)
        self.assertEqual(movement.previous_stock, 10)
        self.assertEqual(movement.new_stock, 6)

    def test_saida_larger_than_stock_is_rejected_without_side_effects(self) -> None:
        response = self.client.post(
            self._movements_url(self.product_b),
            {"movement_type": "saida", "quantity": 999, "reason": "perda_avaria"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.product_b.refresh_from_db()
        self.assertEqual(self.product_b.stock_quantity, 10)
        self.assertFalse(StockMovement.objects.filter(product=self.product_b).exists())

    def test_system_only_reasons_are_rejected_from_the_manual_endpoint(self) -> None:
        response = self.client.post(
            self._movements_url(self.product_b),
            {"movement_type": "entrada", "quantity": 1, "reason": "entrada_inicial"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(StockMovement.objects.filter(product=self.product_b).exists())

    def test_cross_store_post_to_another_stores_product_404s(self) -> None:
        response = self.client.post(
            self._movements_url(self.product_a),
            {"movement_type": "entrada", "quantity": 1, "reason": "compra"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(StockMovement.objects.filter(product=self.product_a).exists())

    def test_cross_store_history_list_404s(self) -> None:
        response = self.client.get(self._movements_url(self.product_a))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_history_list_returns_created_movements(self) -> None:
        self.client.post(
            self._movements_url(self.product_b),
            {"movement_type": "entrada", "quantity": 5, "reason": "compra"},
            format="json",
        )

        response = self.client.get(self._movements_url(self.product_b))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["reason"], "compra")

    def test_viewer_role_can_read_history_but_not_post(self) -> None:
        viewer = User.objects.create_user(username="viewer_b", password="testpass123")
        StoreMembership.objects.create(
            store=self.store_b, user=viewer, role=StoreMembership.ROLE_VIEWER
        )
        client = APIClient()
        client.force_authenticate(user=viewer, token={"store_id": self.store_b.id})

        read_response = client.get(self._movements_url(self.product_b))
        self.assertEqual(read_response.status_code, status.HTTP_200_OK)

        write_response = client.post(
            self._movements_url(self.product_b),
            {"movement_type": "entrada", "quantity": 1, "reason": "compra"},
            format="json",
        )
        self.assertEqual(write_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_user_cannot_read_or_write_history(self) -> None:
        # Anonymous requests with no X-Store-Slug header resolve to the
        # default store (store_a) -- use product_a so the 401 we're
        # asserting comes from the permission check, not a 404 from
        # get_object() filtering out a product that belongs to another store.
        # 401 (not 403) matches this codebase's convention for "never
        # authenticated at all" on every other dashboard-only endpoint (see
        # test_sales_history_requires_authentication).
        client = APIClient()

        read_response = client.get(self._movements_url(self.product_a))
        write_response = client.post(
            self._movements_url(self.product_a),
            {"movement_type": "entrada", "quantity": 1, "reason": "compra"},
            format="json",
        )

        self.assertEqual(read_response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(write_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_creating_a_product_with_initial_stock_logs_entrada_inicial(self) -> None:
        response = self.client.post(
            "/api/v1/products/",
            {
                "name": "Produto Novo",
                "price": "9.90",
                "stock_quantity": 10,
                "category": self.category_b.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        product = Product.objects.get(id=response.data["id"])
        movement = StockMovement.objects.get(product=product)
        self.assertEqual(movement.reason, StockMovement.REASON_ENTRADA_INICIAL)
        self.assertEqual(movement.source, StockMovement.SOURCE_MANUAL)
        self.assertEqual(movement.previous_stock, 0)
        self.assertEqual(movement.new_stock, 10)

    def test_creating_a_product_with_zero_stock_logs_no_movement(self) -> None:
        response = self.client.post(
            "/api/v1/products/",
            {
                "name": "Produto Zerado",
                "price": "9.90",
                "stock_quantity": 0,
                "category": self.category_b.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        product = Product.objects.get(id=response.data["id"])
        self.assertFalse(StockMovement.objects.filter(product=product).exists())

    def test_patch_with_stock_quantity_is_rejected(self) -> None:
        response = self.client.patch(
            f"/api/v1/products/{self.product_b.id}/",
            {"stock_quantity": 999},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.product_b.refresh_from_db()
        self.assertEqual(self.product_b.stock_quantity, 10)

    def test_patch_without_stock_quantity_still_succeeds(self) -> None:
        response = self.client.patch(
            f"/api/v1/products/{self.product_b.id}/",
            {"name": "Produto B Renomeado"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.product_b.refresh_from_db()
        self.assertEqual(self.product_b.name, "Produto B Renomeado")


class StockMovementLedgerAPITest(TwoStoreFixtureMixin, TestCase):
    """Etapa 2: the store-wide ledger (GET /v1/stock-movements/)."""

    LEDGER_URL = "/api/v1/stock-movements/"

    def setUp(self) -> None:
        super().setUp()
        self.other_product_b = Product.objects.create(
            name="Outro Produto B",
            sku="OTR-001",
            price=Decimal("5.00"),
            category=self.category_b,
            store=self.store_b,
            stock_quantity=0,
        )

        # One movement per store (product_a/store_a, product_b/store_b) plus
        # a second movement on a different store-B product, so filters have
        # something real to narrow down.
        self.movement_a = StockMovement.objects.create(
            store=self.store_a,
            product=self.product_a,
            movement_type=StockMovement.TYPE_ENTRADA,
            quantity=10,
            previous_stock=0,
            new_stock=10,
            reason=StockMovement.REASON_COMPRA,
            source=StockMovement.SOURCE_MANUAL,
        )
        self.movement_b_entrada = StockMovement.objects.create(
            store=self.store_b,
            product=self.product_b,
            movement_type=StockMovement.TYPE_ENTRADA,
            quantity=8,
            previous_stock=0,
            new_stock=8,
            reason=StockMovement.REASON_COMPRA,
            source=StockMovement.SOURCE_MANUAL,
        )
        self.movement_b_venda = StockMovement.objects.create(
            store=self.store_b,
            product=self.other_product_b,
            movement_type=StockMovement.TYPE_SAIDA,
            quantity=2,
            previous_stock=4,
            new_stock=2,
            reason=StockMovement.REASON_VENDA,
            source=StockMovement.SOURCE_VENDA,
            sale_order=self.order_b,
        )

    def test_ledger_only_returns_movements_from_the_authenticated_store(self) -> None:
        response = self.client.get(self.LEDGER_URL)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {item["id"] for item in response.data["results"]}
        self.assertEqual(ids, {self.movement_b_entrada.id, self.movement_b_venda.id})
        self.assertNotIn(self.movement_a.id, ids)

    def test_ledger_filters_by_product(self) -> None:
        response = self.client.get(self.LEDGER_URL, {"product": self.product_b.id})

        ids = {item["id"] for item in response.data["results"]}
        self.assertEqual(ids, {self.movement_b_entrada.id})

    def test_ledger_filters_by_movement_type(self) -> None:
        response = self.client.get(self.LEDGER_URL, {"movement_type": "saida"})

        ids = {item["id"] for item in response.data["results"]}
        self.assertEqual(ids, {self.movement_b_venda.id})

    def test_ledger_filters_by_source(self) -> None:
        response = self.client.get(self.LEDGER_URL, {"source": "venda"})

        ids = {item["id"] for item in response.data["results"]}
        self.assertEqual(ids, {self.movement_b_venda.id})

    def test_ledger_filters_by_reason(self) -> None:
        response = self.client.get(self.LEDGER_URL, {"reason": "compra"})

        ids = {item["id"] for item in response.data["results"]}
        self.assertEqual(ids, {self.movement_b_entrada.id})

    def test_ledger_search_matches_product_name_or_sku(self) -> None:
        by_name = self.client.get(self.LEDGER_URL, {"search": "Outro Produto"})
        by_sku = self.client.get(self.LEDGER_URL, {"search": "OTR-001"})

        self.assertEqual(
            {item["id"] for item in by_name.data["results"]}, {self.movement_b_venda.id}
        )
        self.assertEqual(
            {item["id"] for item in by_sku.data["results"]}, {self.movement_b_venda.id}
        )

    def test_ledger_includes_product_name_and_sale_order_reference(self) -> None:
        response = self.client.get(self.LEDGER_URL, {"product": self.other_product_b.id})

        row = response.data["results"][0]
        self.assertEqual(row["product_name"], "Outro Produto B")
        self.assertEqual(row["product_sku"], "OTR-001")
        self.assertEqual(row["sale_order"], self.order_b.id)
        self.assertEqual(row["sale_order_reference"], self.order_b.order_reference)

    def test_ledger_custom_date_range_excludes_movements_outside_it(self) -> None:
        far_future_movement = StockMovement.objects.create(
            store=self.store_b,
            product=self.product_b,
            movement_type=StockMovement.TYPE_ENTRADA,
            quantity=1,
            previous_stock=8,
            new_stock=9,
            reason=StockMovement.REASON_COMPRA,
            source=StockMovement.SOURCE_MANUAL,
        )
        far_future_movement.created_at = "2999-01-01T00:00:00Z"
        far_future_movement.save(update_fields=["created_at"])

        response = self.client.get(self.LEDGER_URL, {"start": "2000-01-01", "end": "2000-01-02"})

        self.assertEqual(response.data["count"], 0)

    def test_ledger_viewer_role_can_read(self) -> None:
        viewer = User.objects.create_user(username="ledger_viewer_b", password="testpass123")
        StoreMembership.objects.create(
            store=self.store_b, user=viewer, role=StoreMembership.ROLE_VIEWER
        )
        client = APIClient()
        client.force_authenticate(user=viewer, token={"store_id": self.store_b.id})

        response = client.get(self.LEDGER_URL)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_ledger_anonymous_user_is_unauthorized(self) -> None:
        client = APIClient()

        response = client.get(self.LEDGER_URL)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_ledger_regular_authenticated_user_without_role_is_forbidden(self) -> None:
        plain_user = User.objects.create_user(username="ledger_plain", password="testpass123")
        client = APIClient()
        client.force_authenticate(user=plain_user, token={"store_id": self.store_b.id})

        response = client.get(self.LEDGER_URL)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_ledger_cannot_create_movements(self) -> None:
        response = self.client.post(
            self.LEDGER_URL,
            {"movement_type": "entrada", "quantity": 1, "reason": "compra", "product": self.product_b.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
