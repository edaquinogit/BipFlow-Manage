"""Etapa 2 of the multi-tenant evolution: invisible store_id on business tables.

Category, Product, DeliveryRegion and SaleOrder now carry a `store` FK,
backfilled to the single default store for every pre-existing row (see
migration 0015), with a model-level default so existing code paths --
including every fixture in this suite that never passed `store=` -- keep
resolving to that same default store without any change.

These tests guard the two things this step changes: every business row
resolves to a real store by default, and uniqueness constraints that used
to be global (Category.slug, Product.sku/slug, DeliveryRegion.name) are now
scoped per store instead of removed outright. That scoping is the exact
building block Etapa 3's active isolation will depend on -- a regression
here would silently let two tenants collide on names/SKUs once isolation
goes live. No view filters by store yet; that is still Etapa 3.
"""
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.test import TestCase

from bipdelivery.api.models import Category, DeliveryRegion, Product, SaleOrder, Store


def make_sale_order(**overrides) -> SaleOrder:
    fields = {
        "order_reference": "BPF-TEST-0001",
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


class DefaultStoreAssignmentTest(TestCase):
    """Rows created without an explicit `store` must resolve to the default tenant."""

    def test_category_defaults_to_the_default_store(self) -> None:
        category = Category.objects.create(name="Bebidas")

        self.assertEqual(category.store_id, Store.get_default().id)

    def test_product_defaults_to_the_default_store(self) -> None:
        category = Category.objects.create(name="Lanches")
        product = Product.objects.create(name="Combo", price=Decimal("19.90"), category=category)

        self.assertEqual(product.store_id, Store.get_default().id)

    def test_delivery_region_defaults_to_the_default_store(self) -> None:
        region = DeliveryRegion.objects.create(name="Centro", delivery_fee=Decimal("8.00"))

        self.assertEqual(region.store_id, Store.get_default().id)

    def test_sale_order_defaults_to_the_default_store(self) -> None:
        order = make_sale_order()

        self.assertEqual(order.store_id, Store.get_default().id)


class PerStoreUniquenessTest(TestCase):
    """Uniqueness that used to be global must now be scoped to `store`, not removed."""

    def setUp(self) -> None:
        self.store_a = Store.get_default()
        self.store_b = Store.objects.create(name="Loja B (futura)", slug="loja-b")

    def test_category_slug_can_repeat_across_stores(self) -> None:
        Category.objects.create(name="Bebidas", store=self.store_a)
        Category.objects.create(name="Bebidas", store=self.store_b)

        self.assertEqual(Category.objects.filter(slug="bebidas").count(), 2)

    def test_category_slug_still_unique_within_the_same_store(self) -> None:
        Category.objects.create(name="Bebidas", store=self.store_a)

        with self.assertRaises(IntegrityError), transaction.atomic():
            Category.objects.create(name="Bebidas", store=self.store_a)

    def test_product_sku_can_repeat_across_stores(self) -> None:
        category = Category.objects.create(name="Lanches", store=self.store_a)
        Product.objects.create(
            name="X-Burger", sku="SKU-1", price=Decimal("19.90"), category=category, store=self.store_a
        )
        Product.objects.create(
            name="X-Burger B", sku="SKU-1", price=Decimal("21.90"), category=category, store=self.store_b
        )

        self.assertEqual(Product.objects.filter(sku="SKU-1").count(), 2)

    def test_product_sku_still_unique_within_the_same_store(self) -> None:
        category = Category.objects.create(name="Lanches", store=self.store_a)
        Product.objects.create(
            name="X-Burger", sku="SKU-1", price=Decimal("19.90"), category=category, store=self.store_a
        )

        with self.assertRaises(IntegrityError), transaction.atomic():
            Product.objects.create(
                name="X-Burger 2", sku="SKU-1", price=Decimal("9.90"), category=category, store=self.store_a
            )

    def test_product_slug_can_repeat_across_stores(self) -> None:
        category = Category.objects.create(name="Lanches", store=self.store_a)
        Product.objects.create(
            name="A", slug="fixed-slug", price=Decimal("1.00"), category=category, store=self.store_a
        )
        Product.objects.create(
            name="B", slug="fixed-slug", price=Decimal("2.00"), category=category, store=self.store_b
        )

        self.assertEqual(Product.objects.filter(slug="fixed-slug").count(), 2)

    def test_product_slug_still_unique_within_the_same_store(self) -> None:
        category = Category.objects.create(name="Lanches", store=self.store_a)
        Product.objects.create(
            name="A", slug="fixed-slug", price=Decimal("1.00"), category=category, store=self.store_a
        )

        with self.assertRaises(IntegrityError), transaction.atomic():
            Product.objects.create(
                name="B", slug="fixed-slug", price=Decimal("2.00"), category=category, store=self.store_a
            )

    def test_delivery_region_name_can_repeat_across_stores(self) -> None:
        DeliveryRegion.objects.create(name="Centro", delivery_fee=Decimal("8.00"), store=self.store_a)
        DeliveryRegion.objects.create(name="Centro", delivery_fee=Decimal("10.00"), store=self.store_b)

        self.assertEqual(DeliveryRegion.objects.filter(name="Centro").count(), 2)

    def test_delivery_region_name_still_unique_within_the_same_store(self) -> None:
        DeliveryRegion.objects.create(name="Centro", delivery_fee=Decimal("8.00"), store=self.store_a)

        with self.assertRaises(IntegrityError), transaction.atomic():
            DeliveryRegion.objects.create(name="Centro", delivery_fee=Decimal("9.00"), store=self.store_a)
