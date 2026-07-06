"""Etapa 3 of docs/architecture/customer-profile-checkout-evolution.md.

CheckoutWhatsAppView no longer accepts an anonymous request or identity/
address fields in the payload -- it requires an authenticated customer
with a CustomerProfile for the resolved store, and reads name, phone,
email and address from that profile instead.
"""
from decimal import Decimal
from typing import Any

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from bipdelivery.api.models import Category, CustomerProfile, Product, SaleOrder, Store

User = get_user_model()


class CheckoutRequiresCustomerProfileTest(TestCase):
    def setUp(self) -> None:
        # LocMemCache persists across test methods within the same run (it
        # isn't reset by TestCase's transaction rollback) -- without this,
        # CheckoutIpThrottle/CheckoutCustomerThrottle accumulate hits across
        # every test in this class and start 429ing real checkout attempts.
        cache.clear()
        self.store = Store.get_default()
        self.category = Category.objects.create(name="Roupas", slug="roupas")
        self.product = Product.objects.create(
            name="Camiseta",
            sku="CAM-001",
            price=Decimal("59.90"),
            stock_quantity=5,
            category=self.category,
        )
        self.user = User.objects.create_user(
            username="cliente@example.com",
            email="cliente@example.com",
            password="testpass123",
        )

    def _payload(self, **customer_overrides: Any) -> dict[str, Any]:
        customer = {
            "delivery_method": "pickup",
            "payment_method": "pix",
            "notes": "",
        }
        customer.update(customer_overrides)
        return {
            "items": [{"product_id": self.product.id, "quantity": 1}],
            "customer": customer,
        }

    def test_anonymous_checkout_is_rejected(self) -> None:
        response = APIClient().post(
            "/api/v1/checkout/whatsapp/", self._payload(), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(SaleOrder.objects.count(), 0)

    def test_authenticated_user_without_a_profile_is_rejected_with_a_clear_code(self) -> None:
        client = APIClient()
        client.force_authenticate(user=self.user, token={"store_id": self.store.id})

        response = client.post("/api/v1/checkout/whatsapp/", self._payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "customer_profile_required")
        self.assertEqual(SaleOrder.objects.count(), 0)

    def test_pickup_order_uses_profile_identity_and_links_the_profile(self) -> None:
        profile = CustomerProfile.objects.create(
            user=self.user,
            store=self.store,
            full_name="Maria Cliente",
            phone="11988887777",
        )
        client = APIClient()
        client.force_authenticate(user=self.user, token={"store_id": self.store.id})

        response = client.post("/api/v1/checkout/whatsapp/", self._payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=response.data)
        order = SaleOrder.objects.get(order_reference=response.data["order_reference"])
        self.assertEqual(order.customer_profile_id, profile.id)
        self.assertEqual(order.customer_name, "Maria Cliente")
        self.assertEqual(order.customer_phone, "11988887777")
        self.assertEqual(order.customer_email, "cliente@example.com")
        self.assertIn("Maria Cliente", order.message)

    def test_delivery_order_requires_a_complete_profile_address(self) -> None:
        CustomerProfile.objects.create(
            user=self.user,
            store=self.store,
            full_name="Maria Cliente",
            phone="11988887777",
            # address/neighborhood/city deliberately left blank
        )
        client = APIClient()
        client.force_authenticate(user=self.user, token={"store_id": self.store.id})

        response = client.post(
            "/api/v1/checkout/whatsapp/",
            self._payload(delivery_method="delivery"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "profile_address_incomplete")
        self.assertEqual(SaleOrder.objects.count(), 0)

    def test_delivery_order_uses_the_complete_profile_address(self) -> None:
        CustomerProfile.objects.create(
            user=self.user,
            store=self.store,
            full_name="Maria Cliente",
            phone="11988887777",
            address="Rua das Flores, 42",
            neighborhood="Jardim",
            city="Sao Paulo",
        )
        client = APIClient()
        client.force_authenticate(user=self.user, token={"store_id": self.store.id})

        response = client.post(
            "/api/v1/checkout/whatsapp/",
            self._payload(delivery_method="delivery"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=response.data)
        order = SaleOrder.objects.get(order_reference=response.data["order_reference"])
        self.assertEqual(order.address, "Rua das Flores, 42")
        self.assertEqual(order.neighborhood, "Jardim")
        self.assertEqual(order.city, "Sao Paulo")

    def test_another_customers_profile_is_never_used(self) -> None:
        """Isolation: a customer's checkout never reads a different user's profile."""
        other_user = User.objects.create_user(
            username="outra@example.com", email="outra@example.com", password="testpass123"
        )
        CustomerProfile.objects.create(
            user=other_user, store=self.store, full_name="Outra Pessoa", phone="11900001111"
        )
        CustomerProfile.objects.create(
            user=self.user, store=self.store, full_name="Maria Cliente", phone="11988887777"
        )
        client = APIClient()
        client.force_authenticate(user=self.user, token={"store_id": self.store.id})

        response = client.post("/api/v1/checkout/whatsapp/", self._payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=response.data)
        order = SaleOrder.objects.get(order_reference=response.data["order_reference"])
        self.assertEqual(order.customer_name, "Maria Cliente")
