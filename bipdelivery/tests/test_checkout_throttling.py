"""
Checkout endpoint abuse protection tests.

Guest checkout reinstated: CheckoutCustomerThrottle keys by the
authenticated user when logged in, and by the submitted `customer.phone`
(digits-only normalized) when anonymous -- a plain UserRateThrottle would
silently stop limiting anonymous attempts entirely (its get_cache_key()
returns None for an unauthenticated request), so this is exercised
explicitly here. CheckoutIpThrottle already keyed by IP regardless of auth
status, unaffected by guest checkout coming back. These tests keep both
throttles independent from production defaults by using small test rates.
"""

import os
from decimal import Decimal
from typing import Any

import django
import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.settings import api_settings
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.test import APIClient

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "bipdelivery.core.settings")
django.setup()

from bipdelivery.api.models import Category, CustomerProfile, Product, SaleOrder, Store  # noqa: E402
from bipdelivery.tests.throttle_utils import rest_framework_with_rates  # noqa: E402

pytestmark = pytest.mark.django_db

User = get_user_model()


CHECKOUT_THROTTLE_TEST_REST_FRAMEWORK = rest_framework_with_rates(
    checkout_ip="2/minute",
    checkout_phone="1/minute",
)


class CheckoutWhatsAppThrottlingTest(TestCase):
    client: APIClient
    category: Category
    product: Product

    def setUp(self) -> None:
        self.settings_override = override_settings(
            REST_FRAMEWORK=CHECKOUT_THROTTLE_TEST_REST_FRAMEWORK
        )
        self.settings_override.enable()
        api_settings.reload()
        self.original_throttle_rates = SimpleRateThrottle.THROTTLE_RATES
        SimpleRateThrottle.THROTTLE_RATES = settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]
        cache.clear()

        self.store = Store.get_default()
        self.category = Category.objects.create(name="Checkout", slug="checkout")
        self.product = Product.objects.create(
            name="Combo Protegido",
            sku="CHK-001",
            price=Decimal("25.90"),
            stock_quantity=10,
            category=self.category,
        )

    def tearDown(self) -> None:
        cache.clear()
        SimpleRateThrottle.THROTTLE_RATES = self.original_throttle_rates
        self.settings_override.disable()
        api_settings.reload()

    def _authenticated_client(self, *, email: str) -> APIClient:
        user = User.objects.create_user(username=email, email=email, password="testpass123")
        CustomerProfile.objects.create(
            user=user,
            store=self.store,
            full_name="Cliente Teste",
            phone="11999990000",
        )
        client = APIClient()
        client.force_authenticate(user=user, token={"store_id": self.store.id})
        return client

    def _payload(
        self,
        *,
        root_extra: dict[str, Any] | None = None,
        customer_extra: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "items": [
                {
                    "product_id": self.product.id,
                    "quantity": 1,
                }
            ],
            "customer": {
                "delivery_method": "pickup",
                "payment_method": "pix",
                "notes": "",
            },
        }

        if root_extra:
            payload.update(root_extra)

        if customer_extra:
            payload["customer"].update(customer_extra)

        return payload

    def test_checkout_is_throttled_by_client_ip_across_different_customers(self) -> None:
        for index in range(2):
            client = self._authenticated_client(email=f"cliente-ip-{index}@example.com")
            response: Any = client.post(
                "/api/v1/checkout/whatsapp/",
                self._payload(),
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)

        client = self._authenticated_client(email="cliente-ip-2@example.com")
        response = client.post(
            "/api/v1/checkout/whatsapp/",
            self._payload(),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn("Retry-After", response)

    def test_checkout_is_throttled_by_the_authenticated_customer_across_ips(self) -> None:
        client = self._authenticated_client(email="cliente-repetido@example.com")

        response: Any = client.post(
            "/api/v1/checkout/whatsapp/",
            self._payload(),
            format="json",
            REMOTE_ADDR="198.51.100.10",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = client.post(
            "/api/v1/checkout/whatsapp/",
            self._payload(),
            format="json",
            REMOTE_ADDR="198.51.100.11",
        )

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_checkout_is_throttled_by_submitted_phone_for_anonymous_guests(self) -> None:
        client = APIClient()
        guest = {"full_name": "Convidado Teste", "phone": "11977776666"}

        response: Any = client.post(
            "/api/v1/checkout/whatsapp/",
            self._payload(customer_extra=guest),
            format="json",
            REMOTE_ADDR="203.0.113.10",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=response.data)

        response = client.post(
            "/api/v1/checkout/whatsapp/",
            self._payload(customer_extra=guest),
            format="json",
            REMOTE_ADDR="203.0.113.11",  # different IP, same phone -- still throttled
        )

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_checkout_phone_throttle_normalizes_formatting_before_comparing(self) -> None:
        client = APIClient()

        response: Any = client.post(
            "/api/v1/checkout/whatsapp/",
            self._payload(customer_extra={"full_name": "Convidado A", "phone": "(11) 97777-6666"}),
            format="json",
            REMOTE_ADDR="203.0.113.20",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=response.data)

        response = client.post(
            "/api/v1/checkout/whatsapp/",
            self._payload(customer_extra={"full_name": "Convidado A", "phone": "11977776666"}),
            format="json",
            REMOTE_ADDR="203.0.113.21",
        )

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_anonymous_guests_with_different_phones_are_throttled_independently(self) -> None:
        client = APIClient()

        response: Any = client.post(
            "/api/v1/checkout/whatsapp/",
            self._payload(customer_extra={"full_name": "Convidado A", "phone": "11977776666"}),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=response.data)

        response = client.post(
            "/api/v1/checkout/whatsapp/",
            self._payload(customer_extra={"full_name": "Convidado B", "phone": "11988885555"}),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=response.data)

    def test_checkout_rejects_filled_honeypot_fields(self) -> None:
        client = self._authenticated_client(email="cliente-honeypot-1@example.com")
        response: Any = client.post(
            "/api/v1/checkout/whatsapp/",
            self._payload(root_extra={"website": "https://spam.example"}),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(SaleOrder.objects.count(), 0)

    def test_checkout_rejects_customer_honeypot_fields(self) -> None:
        client = self._authenticated_client(email="cliente-honeypot-2@example.com")
        response: Any = client.post(
            "/api/v1/checkout/whatsapp/",
            self._payload(customer_extra={"company": "Spam Ltda"}),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(SaleOrder.objects.count(), 0)
