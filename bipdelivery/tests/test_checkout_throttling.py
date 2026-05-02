"""
Checkout endpoint abuse protection tests.

The checkout endpoint is public but persists sale orders, so these tests keep
its throttling independent from production defaults by using small test rates.
"""

import os
from decimal import Decimal
from typing import Any

import django
import pytest
from django.conf import settings
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.settings import api_settings
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.test import APIClient

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "bipdelivery.core.settings")
django.setup()

from bipdelivery.api.models import Category, Product, SaleOrder  # noqa: E402
from bipdelivery.tests.throttle_utils import rest_framework_with_rates  # noqa: E402

pytestmark = pytest.mark.django_db


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

        self.client = APIClient()
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

    def _payload(
        self,
        *,
        phone: str = "(71) 99999-0000",
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
                "full_name": "Cliente Teste",
                "phone": phone,
                "email": "",
                "delivery_method": "pickup",
                "payment_method": "pix",
                "delivery_region_id": None,
                "address": "",
                "neighborhood": "",
                "city": "",
                "notes": "",
            },
        }

        if root_extra:
            payload.update(root_extra)

        if customer_extra:
            payload["customer"].update(customer_extra)

        return payload

    def test_checkout_is_throttled_by_client_ip(self) -> None:
        for index in range(2):
            response: Any = self.client.post(
                "/api/v1/checkout/whatsapp/",
                self._payload(phone=f"(71) 99999-000{index}"),
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.post(
            "/api/v1/checkout/whatsapp/",
            self._payload(phone="(71) 99999-0009"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn("Retry-After", response)

    def test_checkout_is_throttled_by_normalized_phone_across_ips(self) -> None:
        response: Any = self.client.post(
            "/api/v1/checkout/whatsapp/",
            self._payload(phone="(71) 99999-0000"),
            format="json",
            REMOTE_ADDR="198.51.100.10",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.post(
            "/api/v1/checkout/whatsapp/",
            self._payload(phone="71 99999-0000"),
            format="json",
            REMOTE_ADDR="198.51.100.11",
        )

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_checkout_rejects_filled_honeypot_fields(self) -> None:
        response: Any = self.client.post(
            "/api/v1/checkout/whatsapp/",
            self._payload(root_extra={"website": "https://spam.example"}),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(SaleOrder.objects.count(), 0)

    def test_checkout_rejects_customer_honeypot_fields(self) -> None:
        response: Any = self.client.post(
            "/api/v1/checkout/whatsapp/",
            self._payload(customer_extra={"company": "Spam Ltda"}),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(SaleOrder.objects.count(), 0)
