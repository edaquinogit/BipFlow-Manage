"""
Checkout endpoint abuse protection tests.

Etapa 3 of docs/architecture/customer-profile-checkout-evolution.md: the
checkout endpoint now requires an authenticated customer with a
CustomerProfile, so these throttles can no longer key off a submitted
phone field (it isn't in the payload anymore) or rely on plain
AnonRateThrottle (which never throttles an authenticated request). Both
throttles were rewritten to key off the authenticated request instead --
these tests keep them independent from production defaults by using small
test rates.
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
