"""Etapa 3 of the multi-tenant evolution: active store isolation.

Category, Product, DeliveryRegion and SaleOrder gained a `store` FK in
Etapa 2, but nothing filtered by it yet -- any authenticated dashboard
user, or any anonymous catalog request, could see every tenant's rows.
The architecture doc calls a test like this mandatory before anything
else in this step: prove a second store's data never leaks into the
first store's view, across every store-scoped endpoint.

`force_authenticate(user, token=...)` simulates the JWT's `store_id`
claim without a real login round-trip, consistent with how the rest of
this suite authenticates (plain `force_authenticate(user=...)`) --
StoreScopedViewSetMixin.get_request_store() reads the claim the same way
whether it comes from this dict or a real simplejwt token.

permissions.py is intentionally untouched here: every existing user
already has both a global Django group and a StoreMembership pointing at
the same store (Etapa 1's backfill), so "role per store" has no
observable effect until a single user can hold different roles in
different stores -- only possible once Etapa 4 ships real onboarding.
`store_b`'s user gets `is_staff=True` for write access, matching every
other test in this suite, not a StoreMembership role.
"""
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from bipdelivery.api.models import (
    BotConversation,
    Category,
    DeliveryRegion,
    Product,
    SaleOrder,
    Store,
    StoreMembership,
)


def make_sale_order(store: Store, **overrides) -> SaleOrder:
    fields = {
        "store": store,
        "order_reference": f"BPF-TEST-{store.slug}",
        "customer_name": "Cliente Teste",
        "customer_phone": "71999999999",
        "delivery_method": "pickup",
        "payment_method": "pix",
        "subtotal": Decimal("10.00"),
        "delivery_fee": Decimal("0.00"),
        "total": Decimal("10.00"),
    }
    fields.update(overrides)
    return SaleOrder.objects.create(**fields)


class TwoStoreFixtureMixin:
    """Two fully independent tenants, each with their own catalog and a manager for store B."""

    def setUp(self) -> None:
        super().setUp()
        cache.clear()
        self.store_a = Store.get_default()
        self.store_b = Store.objects.create(name="Loja B", slug="loja-b")

        self.category_a = Category.objects.create(name="Categoria A", store=self.store_a)
        self.category_b = Category.objects.create(name="Categoria B", store=self.store_b)

        self.product_a = Product.objects.create(
            name="Produto A", price=Decimal("10.00"), category=self.category_a, store=self.store_a
        )
        self.product_b = Product.objects.create(
            name="Produto B", price=Decimal("20.00"), category=self.category_b, store=self.store_b
        )

        self.region_a = DeliveryRegion.objects.create(
            name="Centro", delivery_fee=Decimal("5.00"), store=self.store_a
        )
        self.region_b = DeliveryRegion.objects.create(
            name="Centro", delivery_fee=Decimal("7.00"), store=self.store_b
        )

        self.order_a = make_sale_order(self.store_a, order_reference="BPF-A-0001", customer_name="Cliente A")
        self.order_b = make_sale_order(self.store_b, order_reference="BPF-B-0001", customer_name="Cliente B")

        # is_staff grants dashboard write access today (permissions.py is
        # unchanged in this step -- see module docstring); the membership row
        # still models which store this user legitimately belongs to.
        self.user_b = User.objects.create_user(
            username="manager_b", password="testpass123", is_staff=True
        )
        StoreMembership.objects.create(store=self.store_b, user=self.user_b, role=StoreMembership.ROLE_MANAGER)

        self.client = APIClient()
        self.client.force_authenticate(user=self.user_b, token={"store_id": self.store_b.id})


class DashboardCatalogIsolationTest(TwoStoreFixtureMixin, TestCase):
    def test_product_list_only_returns_the_authenticated_users_store(self) -> None:
        response = self.client.get("/api/v1/products/")

        ids = {item["id"] for item in response.data["results"]}
        self.assertIn(self.product_b.id, ids)
        self.assertNotIn(self.product_a.id, ids)

    def test_category_list_only_returns_the_authenticated_users_store(self) -> None:
        response = self.client.get("/api/v1/categories/")

        ids = {item["id"] for item in response.data["results"]}
        self.assertIn(self.category_b.id, ids)
        self.assertNotIn(self.category_a.id, ids)

    def test_product_detail_from_another_store_is_not_found(self) -> None:
        response = self.client.get(f"/api/v1/products/{self.product_a.id}/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_bulk_update_category_cannot_touch_another_stores_product(self) -> None:
        response = self.client.patch(
            "/api/v1/products/bulk_update_category/",
            {"product_ids": [self.product_a.id], "new_category_id": self.category_b.id},
            format="json",
        )

        self.assertIn(response.status_code, {400, 404})
        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.category_id, self.category_a.id)


class DashboardDeliveryRegionIsolationTest(TwoStoreFixtureMixin, TestCase):
    def test_delivery_region_list_only_returns_the_authenticated_users_store(self) -> None:
        response = self.client.get("/api/v1/delivery-regions/")

        ids = {item["id"] for item in response.data["results"]}
        self.assertIn(self.region_b.id, ids)
        self.assertNotIn(self.region_a.id, ids)

    def test_active_action_only_returns_the_authenticated_users_store(self) -> None:
        response = self.client.get("/api/v1/delivery-regions/active/")

        ids = {item["id"] for item in response.data}
        self.assertIn(self.region_b.id, ids)
        self.assertNotIn(self.region_a.id, ids)


class DashboardSalesIsolationTest(TwoStoreFixtureMixin, TestCase):
    def test_sale_order_list_only_returns_the_authenticated_users_store(self) -> None:
        response = self.client.get("/api/v1/sales-orders/")

        ids = {item["id"] for item in response.data["results"]}
        self.assertIn(self.order_b.id, ids)
        self.assertNotIn(self.order_a.id, ids)

    def test_cannot_update_status_of_another_stores_order(self) -> None:
        response = self.client.patch(
            f"/api/v1/sales-orders/{self.order_a.id}/status/", {"status": "sent"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.order_a.refresh_from_db()
        self.assertEqual(self.order_a.status, "prepared")

    def test_summary_only_aggregates_the_authenticated_users_store(self) -> None:
        response = self.client.get("/api/v1/sales-orders/summary/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["orders_count"], 1)
        self.assertEqual(response.data["revenue_total"], "10.00")

    def test_timeseries_only_aggregates_the_authenticated_users_store(self) -> None:
        response = self.client.get("/api/v1/sales-orders/timeseries/?period=7d")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        total_revenue = sum(Decimal(point["revenue"]) for point in response.data)
        self.assertEqual(total_revenue, Decimal("10.00"))

    def test_breakdown_only_aggregates_the_authenticated_users_store(self) -> None:
        response = self.client.get("/api/v1/sales-orders/breakdown/?period=30d")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        by_status = {row["status"]: row["orders_count"] for row in response.data["by_status"]}
        self.assertEqual(by_status, {"prepared": 1})

    def test_customers_only_aggregates_the_authenticated_users_store(self) -> None:
        response = self.client.get("/api/v1/sales-orders/customers/?period=30d")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["new_customers"], 1)
        self.assertEqual(response.data["returning_customers"], 0)

    def test_customers_bot_conversion_only_counts_the_authenticated_users_store(self) -> None:
        BotConversation.objects.create(store=self.store_a)
        BotConversation.objects.create(store=self.store_b)

        response = self.client.get("/api/v1/sales-orders/customers/?period=30d")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["bot_conversations_count"], 1)


class DashboardCreateAssignsAuthenticatedStoreTest(TwoStoreFixtureMixin, TestCase):
    def test_creating_a_category_assigns_the_authenticated_users_store(self) -> None:
        response = self.client.post("/api/v1/categories/", {"name": "Nova Categoria"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = Category.objects.get(id=response.data["id"])
        self.assertEqual(created.store_id, self.store_b.id)

    def test_creating_a_delivery_region_assigns_the_authenticated_users_store(self) -> None:
        response = self.client.post(
            "/api/v1/delivery-regions/", {"name": "Nova Regiao", "delivery_fee": "5.00"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = DeliveryRegion.objects.get(id=response.data["id"])
        self.assertEqual(created.store_id, self.store_b.id)


class PublicCatalogIsolationTest(TwoStoreFixtureMixin, TestCase):
    def test_anonymous_request_with_store_slug_header_only_sees_that_store(self) -> None:
        client = APIClient()
        response = client.get("/api/v1/products/", HTTP_X_STORE_SLUG=self.store_b.slug)

        ids = {item["id"] for item in response.data["results"]}
        self.assertIn(self.product_b.id, ids)
        self.assertNotIn(self.product_a.id, ids)

    def test_anonymous_request_without_header_resolves_to_default_store(self) -> None:
        client = APIClient()
        response = client.get("/api/v1/products/")

        ids = {item["id"] for item in response.data["results"]}
        self.assertIn(self.product_a.id, ids)
        self.assertNotIn(self.product_b.id, ids)

    def test_current_store_endpoint_resolves_by_header(self) -> None:
        client = APIClient()
        response = client.get("/api/v1/store/current/", HTTP_X_STORE_SLUG=self.store_b.slug)

        self.assertEqual(response.data["slug"], self.store_b.slug)


class CheckoutIsolationTest(TwoStoreFixtureMixin, TestCase):
    def test_checkout_rejects_a_product_from_another_store(self) -> None:
        client = APIClient()
        payload = {
            "items": [{"product_id": self.product_a.id, "quantity": 1}],
            "customer": {
                "full_name": "Cliente Teste",
                "phone": "71999999999",
                "delivery_method": "pickup",
                "payment_method": "pix",
            },
        }

        response = client.post(
            "/api/v1/checkout/whatsapp/", payload, format="json", HTTP_X_STORE_SLUG=self.store_b.slug
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
