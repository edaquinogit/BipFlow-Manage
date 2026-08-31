"""Product-variant pricing -- checkout, PDV and serializer (FASE C).

See docs/architecture/product-variant-pricing.md. Both sale channels resolve
the line price through Product.get_effective_price(variant); the browser
never controls it; SaleOrderItem keeps the snapshot so historical orders are
immune to later price edits.
"""
from decimal import Decimal
from typing import Any

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from rest_framework import status
from rest_framework.test import APIClient

from bipdelivery.api.models import (
    Category,
    Product,
    ProductVariant,
    SaleOrder,
    Store,
)
from bipdelivery.tests.test_store_active_isolation import TwoStoreFixtureMixin

User = get_user_model()

CHECKOUT_URL = "/api/v1/checkout/whatsapp/"
PDV_SALES_URL = "/api/v1/pdv/sales/"


@override_settings(WHATSAPP_ORDER_PHONE="5571999999999")
class CheckoutVariantPricingTest(TestCase):
    """WhatsApp checkout charges the variant's effective price and snapshots it."""

    def setUp(self) -> None:
        cache.clear()
        self.store = Store.get_default()
        self.category = Category.objects.create(name="Camisetas", slug="camisetas")
        self.product = Product.objects.create(
            name="Camiseta Dry Fit",
            sku="CAM-DRY",
            price=Decimal("59.90"),
            stock_quantity=30,
            category=self.category,
        )
        self.inherits = ProductVariant.objects.create(
            product=self.product, name="M", color_hex="#111827",
            stock_quantity=10, position=0, price=None,
        )
        self.override = ProductVariant.objects.create(
            product=self.product, name="GG", color_hex="#222222",
            stock_quantity=10, position=1, price=Decimal("69.90"),
        )

    def _post(self, items: list[dict[str, Any]]) -> Any:
        payload = {
            "items": items,
            "customer": {
                "delivery_method": "pickup",
                "payment_method": "pix",
                "full_name": "Cliente Teste",
                "phone": "11988887777",
                "notes": "",
            },
        }
        return APIClient().post(CHECKOUT_URL, payload, format="json")

    def test_variant_with_its_own_price_is_charged_and_snapshotted(self) -> None:
        response = self._post(
            [{"product_id": self.product.id, "variant_id": self.override.id, "quantity": 2}]
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=response.data)
        self.assertEqual(response.data["items"][0]["unit_price"], "69.90")
        self.assertEqual(response.data["items"][0]["line_total"], "139.80")
        self.assertEqual(response.data["subtotal"], "139.80")
        self.assertEqual(response.data["total"], "139.80")

        item = SaleOrder.objects.get(
            order_reference=response.data["order_reference"]
        ).items.get()
        self.assertEqual(item.unit_price, Decimal("69.90"))
        self.assertEqual(item.line_total, Decimal("139.80"))
        self.assertEqual(item.variant_id, self.override.id)

    def test_variant_without_a_price_falls_back_to_the_base_price(self) -> None:
        response = self._post(
            [{"product_id": self.product.id, "variant_id": self.inherits.id, "quantity": 1}]
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=response.data)
        self.assertEqual(response.data["items"][0]["unit_price"], "59.90")

    def test_price_in_the_request_body_is_ignored(self) -> None:
        response = self._post(
            [
                {
                    "product_id": self.product.id,
                    "variant_id": self.override.id,
                    "quantity": 1,
                    "unit_price": "1.00",
                    "price": "1.00",
                    "line_total": "1.00",
                }
            ]
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=response.data)
        self.assertEqual(response.data["items"][0]["unit_price"], "69.90")
        self.assertEqual(response.data["total"], "69.90")

    def test_delivery_total_adds_the_fee_to_the_variant_priced_subtotal(self) -> None:
        from bipdelivery.api.models import DeliveryRegion

        region = DeliveryRegion.objects.create(
            name="Centro", city="Salvador", delivery_fee=Decimal("12.00"), store=self.store
        )
        payload = {
            "items": [
                {"product_id": self.product.id, "variant_id": self.override.id, "quantity": 1}
            ],
            "customer": {
                "delivery_method": "delivery",
                "payment_method": "pix",
                "delivery_region_id": region.id,
                "full_name": "Cliente Teste",
                "phone": "11988887777",
                "address": "Rua A, 1",
                "neighborhood": "Centro",
                "city": "Salvador",
                "notes": "",
            },
        }

        response = APIClient().post(CHECKOUT_URL, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=response.data)
        self.assertEqual(response.data["subtotal"], "69.90")
        self.assertEqual(response.data["delivery_fee"], "12.00")
        self.assertEqual(response.data["total"], "81.90")

    def test_historical_order_price_is_immune_to_a_later_variant_price_change(self) -> None:
        first = self._post(
            [{"product_id": self.product.id, "variant_id": self.override.id, "quantity": 1}]
        )
        self.assertEqual(first.data["items"][0]["unit_price"], "69.90")

        self.override.price = Decimal("84.90")
        self.override.save(update_fields=["price"])

        second = self._post(
            [{"product_id": self.product.id, "variant_id": self.override.id, "quantity": 1}]
        )
        self.assertEqual(second.data["items"][0]["unit_price"], "84.90")

        old_item = SaleOrder.objects.get(
            order_reference=first.data["order_reference"]
        ).items.get()
        self.assertEqual(old_item.unit_price, Decimal("69.90"))

    def test_changing_the_base_price_moves_only_inheriting_variant_lines(self) -> None:
        self.product.price = Decimal("64.90")
        self.product.save(update_fields=["price"])

        inherits_resp = self._post(
            [{"product_id": self.product.id, "variant_id": self.inherits.id, "quantity": 1}]
        )
        override_resp = self._post(
            [{"product_id": self.product.id, "variant_id": self.override.id, "quantity": 1}]
        )

        self.assertEqual(inherits_resp.data["items"][0]["unit_price"], "64.90")
        self.assertEqual(override_resp.data["items"][0]["unit_price"], "69.90")

    def test_product_without_variants_is_unchanged(self) -> None:
        plain = Product.objects.create(
            name="Bone", sku="BONE-1", price=Decimal("29.90"),
            stock_quantity=5, category=self.category,
        )

        response = self._post([{"product_id": plain.id, "quantity": 2}])

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=response.data)
        self.assertEqual(response.data["items"][0]["unit_price"], "29.90")
        self.assertEqual(response.data["total"], "59.80")


@override_settings(WHATSAPP_ORDER_PHONE="5571999999999")
class CheckoutVariantPricingIdempotencyTest(TestCase):
    def setUp(self) -> None:
        cache.clear()
        self.category = Category.objects.create(name="Kits", slug="kits")
        self.product = Product.objects.create(
            name="Kit Academia", sku="KIT-1", price=Decimal("99.90"),
            stock_quantity=20, category=self.category,
        )
        self.basic = ProductVariant.objects.create(
            product=self.product, name="Basico", color_hex="#111827",
            stock_quantity=10, position=0, price=None,
        )
        self.premium = ProductVariant.objects.create(
            product=self.product, name="Premium", color_hex="#222222",
            stock_quantity=10, position=1, price=Decimal("129.90"),
        )

    def _post(self, variant_id: int, key: str) -> Any:
        payload = {
            "idempotency_key": key,
            "items": [
                {"product_id": self.product.id, "variant_id": variant_id, "quantity": 1}
            ],
            "customer": {
                "delivery_method": "pickup",
                "payment_method": "pix",
                "full_name": "Cliente Teste",
                "phone": "11988887777",
                "notes": "",
            },
        }
        return APIClient().post(CHECKOUT_URL, payload, format="json")

    def test_same_key_same_variant_returns_the_same_order(self) -> None:
        first = self._post(self.premium.id, "kit-key-1")
        second = self._post(self.premium.id, "kit-key-1")

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(
            first.data["order_reference"], second.data["order_reference"]
        )
        self.assertEqual(SaleOrder.objects.count(), 1)

    def test_same_key_different_variant_is_a_conflict(self) -> None:
        first = self._post(self.premium.id, "kit-key-2")
        second = self._post(self.basic.id, "kit-key-2")

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(second.data["code"], "idempotency_key_conflict")
        self.assertEqual(SaleOrder.objects.count(), 1)


class CheckoutVariantPricingTenantSafetyTest(TwoStoreFixtureMixin, TestCase):
    """A store-B variant price can never surface in a store-A checkout."""

    def setUp(self) -> None:
        super().setUp()
        Store.objects.filter(pk=self.store_a.pk).update(whatsapp_phone="5571999999999")
        self.product_a.stock_quantity = 10
        self.product_a.price = Decimal("50.00")
        self.product_a.save(update_fields=["stock_quantity", "price", "is_available"])
        self.product_b.stock_quantity = 10
        self.product_b.price = Decimal("50.00")
        self.product_b.save(update_fields=["stock_quantity", "price", "is_available"])

        self.variant_a = ProductVariant.objects.create(
            product=self.product_a, name="A", color_hex="#111827",
            stock_quantity=5, position=0, price=Decimal("60.00"),
        )
        self.variant_b = ProductVariant.objects.create(
            product=self.product_b, name="B", color_hex="#222222",
            stock_quantity=5, position=0, price=Decimal("999.00"),
        )

    def _guest_payload(self, product_id: int, variant_id: int) -> dict[str, Any]:
        return {
            "items": [
                {"product_id": product_id, "variant_id": variant_id, "quantity": 1}
            ],
            "customer": {
                "delivery_method": "pickup",
                "payment_method": "pix",
                "full_name": "Cliente A",
                "phone": "11988887777",
                "notes": "",
            },
        }

    def test_store_a_checkout_charges_its_own_variant_price(self) -> None:
        response = APIClient().post(
            CHECKOUT_URL, self._guest_payload(self.product_a.id, self.variant_a.id),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=response.data)
        self.assertEqual(response.data["items"][0]["unit_price"], "60.00")

    def test_store_a_checkout_rejects_store_b_variant(self) -> None:
        response = APIClient().post(
            CHECKOUT_URL, self._guest_payload(self.product_a.id, self.variant_b.id),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(SaleOrder.objects.filter(store=self.store_a).exclude(
            order_reference=self.order_a.order_reference
        ).exists())

    def test_inactive_variant_price_cannot_be_used(self) -> None:
        self.variant_a.is_active = False
        self.variant_a.save(update_fields=["is_active"])

        response = APIClient().post(
            CHECKOUT_URL, self._guest_payload(self.product_a.id, self.variant_a.id),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class PdvVariantPricingTest(TwoStoreFixtureMixin, TestCase):
    """The physical-store sale channel resolves the same effective price."""

    def setUp(self) -> None:
        super().setUp()
        self.product_b.stock_quantity = 20
        self.product_b.price = Decimal("40.00")
        self.product_b.save(update_fields=["stock_quantity", "price", "is_available"])
        self.cheap_variant = ProductVariant.objects.create(
            product=self.product_b, name="Padrao", color_hex="#111827",
            stock_quantity=10, position=0, price=None,
        )
        self.pricey_variant = ProductVariant.objects.create(
            product=self.product_b, name="Especial", color_hex="#222222",
            stock_quantity=10, position=1, price=Decimal("55.00"),
        )

    def _sell(self, variant: ProductVariant, quantity: int = 1) -> Any:
        return self.client.post(
            PDV_SALES_URL,
            {
                "items": [
                    {
                        "public_code": self.product_b.public_code,
                        "variant_id": variant.id,
                        "quantity": quantity,
                    }
                ],
                "payment_method": "cash",
            },
            format="json",
        )

    def test_pdv_uses_variant_override_price(self) -> None:
        response = self._sell(self.pricey_variant, quantity=2)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, msg=response.data)
        self.assertEqual(response.data["items"][0]["unit_price"], "55.00")
        self.assertEqual(response.data["items"][0]["line_total"], "110.00")
        self.assertEqual(response.data["total"], "110.00")

    def test_pdv_falls_back_to_base_price_for_a_priceless_variant(self) -> None:
        response = self._sell(self.cheap_variant)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, msg=response.data)
        self.assertEqual(response.data["items"][0]["unit_price"], "40.00")


class ProductVariantSerializerEffectivePriceTest(TwoStoreFixtureMixin, TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.product_b.price = Decimal("59.90")
        self.product_b.save(update_fields=["price"])
        self.inherits = ProductVariant.objects.create(
            product=self.product_b, name="M", color_hex="#111827",
            stock_quantity=3, position=0, price=None,
        )
        self.override = ProductVariant.objects.create(
            product=self.product_b, name="GG", color_hex="#222222",
            stock_quantity=3, position=1, price=Decimal("69.90"),
        )

    def test_payload_exposes_price_and_effective_price(self) -> None:
        response = self.client.get(f"/api/v1/products/{self.product_b.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        variants = {v["name"]: v for v in response.data["variants"]}
        self.assertIsNone(variants["M"]["price"])
        self.assertEqual(variants["M"]["effective_price"], "59.90")
        self.assertEqual(variants["GG"]["price"], "69.90")
        self.assertEqual(variants["GG"]["effective_price"], "69.90")

    def _add_catalog(self, count: int) -> None:
        for index in range(count):
            product = Product.objects.create(
                name=f"Produto extra {self.product_b.id}-{index}",
                price=Decimal("10.00"), category=self.category_b,
                store=self.store_b, stock_quantity=5,
            )
            ProductVariant.objects.create(
                product=product, name="U", color_hex="#111827",
                stock_quantity=2, position=0, price=None,
            )

    def test_effective_price_serialization_does_not_scale_with_variant_count(self) -> None:
        """effective_price reads variant.product -- the Prefetch's
        select_related("product") keeps that from becoming one query per row."""
        self._add_catalog(1)
        with CaptureQueriesContext(connection) as small:
            self.client.get("/api/v1/products/?page_size=100")

        self._add_catalog(8)
        with CaptureQueriesContext(connection) as large:
            response = self.client.get("/api/v1/products/?page_size=100")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(small), len(large))
