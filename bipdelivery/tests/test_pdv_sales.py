"""Etapa 3 of the QR-code stock-exit evolution: point-of-sale checkout for
the physical store (POST /v1/pdv/sales/), resolving cart items by scanned
`public_code` instead of numeric product id.

See docs/architecture/qrcode-stock-exit-evolution.md. Reuses
TwoStoreFixtureMixin (test_store_active_isolation.py) for cross-store
isolation, same as test_stock_movements.py / test_product_public_code.py.
"""
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from bipdelivery.api.models import Product, SaleOrder, StockMovement, StoreMembership
from bipdelivery.tests.test_store_active_isolation import TwoStoreFixtureMixin

PDV_SALES_URL = "/api/v1/pdv/sales/"


class PdvSaleAPITest(TwoStoreFixtureMixin, TestCase):
    def setUp(self) -> None:
        super().setUp()
        # update_fields must include is_available, not just stock_quantity:
        # Product.save() recomputes is_available in memory regardless, but a
        # restricted update_fields only persists the columns actually listed
        # -- omitting it here would leave the DB row's is_available stuck at
        # the original False from creation with 0 stock, and this view's
        # is_available check reads a fresh row from the database, not this
        # in-memory instance.
        self.product_b.stock_quantity = 10
        self.product_b.save(update_fields=["stock_quantity", "is_available"])

        self.other_product_b = Product.objects.create(
            name="Outro Produto B",
            price=Decimal("15.00"),
            category=self.category_b,
            store=self.store_b,
            stock_quantity=4,
        )

    def test_single_item_sale_decrements_stock_and_creates_order(self) -> None:
        response = self.client.post(
            PDV_SALES_URL,
            {
                "items": [{"public_code": self.product_b.public_code, "quantity": 3}],
                "payment_method": "cash",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["subtotal"], "60.00")
        self.assertEqual(response.data["total"], "60.00")
        self.assertTrue(response.data["order_reference"].startswith("PDV-"))

        self.product_b.refresh_from_db()
        self.assertEqual(self.product_b.stock_quantity, 7)

        sale_order = SaleOrder.objects.get(order_reference=response.data["order_reference"])
        self.assertEqual(sale_order.channel, SaleOrder.CHANNEL_LOJA_FISICA)
        self.assertEqual(sale_order.store, self.store_b)
        self.assertEqual(sale_order.delivery_method, "pickup")
        self.assertEqual(sale_order.customer_name, "Cliente balcão")

        movement = StockMovement.objects.get(product=self.product_b, sale_order=sale_order)
        self.assertEqual(movement.movement_type, StockMovement.TYPE_SAIDA)
        self.assertEqual(movement.source, StockMovement.SOURCE_PDV)
        self.assertEqual(movement.reason, StockMovement.REASON_VENDA)
        self.assertEqual(movement.previous_stock, 10)
        self.assertEqual(movement.new_stock, 7)
        self.assertEqual(movement.performed_by, self.user_b)

    def test_multi_item_sale_is_atomic_across_products(self) -> None:
        response = self.client.post(
            PDV_SALES_URL,
            {
                "items": [
                    {"public_code": self.product_b.public_code, "quantity": 2},
                    {"public_code": self.other_product_b.public_code, "quantity": 4},
                ],
                "payment_method": "pix",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.product_b.refresh_from_db()
        self.other_product_b.refresh_from_db()
        self.assertEqual(self.product_b.stock_quantity, 8)
        self.assertEqual(self.other_product_b.stock_quantity, 0)
        self.assertFalse(self.other_product_b.is_available)

    def test_duplicate_scans_of_the_same_code_are_aggregated(self) -> None:
        response = self.client.post(
            PDV_SALES_URL,
            {
                "items": [
                    {"public_code": self.product_b.public_code, "quantity": 1},
                    {"public_code": self.product_b.public_code, "quantity": 2},
                ],
                "payment_method": "cash",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data["items"]), 1)
        self.assertEqual(response.data["items"][0]["quantity"], 3)
        self.product_b.refresh_from_db()
        self.assertEqual(self.product_b.stock_quantity, 7)

    def test_quantity_larger_than_stock_is_rejected_without_side_effects(self) -> None:
        response = self.client.post(
            PDV_SALES_URL,
            {
                "items": [{"public_code": self.product_b.public_code, "quantity": 999}],
                "payment_method": "cash",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.product_b.refresh_from_db()
        self.assertEqual(self.product_b.stock_quantity, 10)
        self.assertFalse(StockMovement.objects.filter(product=self.product_b).exists())

    def test_partial_failure_in_a_multi_item_sale_rolls_back_everything(self) -> None:
        """One bad item must not leave the first item's stock decremented."""
        response = self.client.post(
            PDV_SALES_URL,
            {
                "items": [
                    {"public_code": self.product_b.public_code, "quantity": 2},
                    {"public_code": self.other_product_b.public_code, "quantity": 999},
                ],
                "payment_method": "cash",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.product_b.refresh_from_db()
        self.other_product_b.refresh_from_db()
        self.assertEqual(self.product_b.stock_quantity, 10)
        self.assertEqual(self.other_product_b.stock_quantity, 4)
        self.assertFalse(SaleOrder.objects.filter(channel=SaleOrder.CHANNEL_LOJA_FISICA).exists())

    def test_unknown_code_is_rejected(self) -> None:
        response = self.client.post(
            PDV_SALES_URL,
            {"items": [{"public_code": "DOESNOTEX", "quantity": 1}], "payment_method": "cash"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_code_lookup_is_case_insensitive(self) -> None:
        response = self.client.post(
            PDV_SALES_URL,
            {
                "items": [{"public_code": self.product_b.public_code.lower(), "quantity": 1}],
                "payment_method": "cash",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_cross_store_code_is_not_found(self) -> None:
        response = self.client.post(
            PDV_SALES_URL,
            {
                "items": [{"public_code": self.product_a.public_code, "quantity": 1}],
                "payment_method": "cash",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.stock_quantity, 0)

    def test_empty_items_list_is_rejected(self) -> None:
        response = self.client.post(
            PDV_SALES_URL, {"items": [], "payment_method": "cash"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_anonymous_user_is_unauthorized(self) -> None:
        client = APIClient()

        response = client.post(
            PDV_SALES_URL,
            {"items": [{"public_code": "ANYCODE1", "quantity": 1}], "payment_method": "cash"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_viewer_role_cannot_register_a_sale(self) -> None:
        viewer = User.objects.create_user(username="pdv_viewer_b", password="testpass123")
        StoreMembership.objects.create(
            store=self.store_b, user=viewer, role=StoreMembership.ROLE_VIEWER
        )
        client = APIClient()
        client.force_authenticate(user=viewer, token={"store_id": self.store_b.id})

        response = client.post(
            PDV_SALES_URL,
            {
                "items": [{"public_code": self.product_b.public_code, "quantity": 1}],
                "payment_method": "cash",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_optional_customer_name_and_notes_are_persisted(self) -> None:
        response = self.client.post(
            PDV_SALES_URL,
            {
                "items": [{"public_code": self.product_b.public_code, "quantity": 1}],
                "payment_method": "card",
                "customer_name": "Maria",
                "notes": "Cliente preferencial",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        sale_order = SaleOrder.objects.get(order_reference=response.data["order_reference"])
        self.assertEqual(sale_order.customer_name, "Maria")
        self.assertEqual(sale_order.notes, "Cliente preferencial")
        self.assertEqual(sale_order.payment_method, "card")
