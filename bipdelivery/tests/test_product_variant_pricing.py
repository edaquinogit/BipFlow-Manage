"""Product-variant pricing -- domain layer (FASE B).

See docs/architecture/product-variant-pricing.md. This module only covers the
model: the optional `ProductVariant.price` override, its validation, and the
single fallback rule `Product.get_effective_price(variant)`. Checkout / PDV /
serializer / frontend behaviour is covered in later phases.
"""
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase

from bipdelivery.api.models import Category, Product, ProductVariant, Store


class EffectivePriceResolutionTest(TestCase):
    """`Product.get_effective_price()` is the one place the fallback lives."""

    def setUp(self) -> None:
        self.store = Store.get_default()
        self.category = Category.objects.create(name="Camisetas", store=self.store)
        self.product = Product.objects.create(
            name="Camiseta Dry Fit",
            price=Decimal("59.90"),
            stock_quantity=20,
            category=self.category,
            store=self.store,
        )

    def _variant(self, name: str, price=None, **overrides) -> ProductVariant:
        self._next_position = getattr(self, "_next_position", 0) + 1
        fields = {
            "product": self.product,
            "name": name,
            "color_hex": "#111827",
            "stock_quantity": 5,
            "price": price,
            "position": self._next_position,
        }
        fields.update(overrides)
        return ProductVariant.objects.create(**fields)

    def test_variant_price_defaults_to_none_and_inherits_base_price(self) -> None:
        variant = self._variant("M")

        self.assertIsNone(variant.price)
        self.assertEqual(self.product.get_effective_price(variant), Decimal("59.90"))

    def test_variant_with_its_own_price_overrides_the_base_price(self) -> None:
        variant = self._variant("GG", price=Decimal("69.90"))

        self.assertEqual(self.product.get_effective_price(variant), Decimal("69.90"))

    def test_get_effective_price_without_a_variant_returns_the_base_price(self) -> None:
        self.assertEqual(self.product.get_effective_price(), Decimal("59.90"))
        self.assertEqual(self.product.get_effective_price(None), Decimal("59.90"))

    def test_zero_is_a_real_price_distinct_from_none(self) -> None:
        free_variant = self._variant("Brinde", price=Decimal("0.00"))

        self.assertIsNotNone(free_variant.price)
        self.assertEqual(self.product.get_effective_price(free_variant), Decimal("0.00"))

    def test_changing_the_base_price_moves_inheriting_variants_only(self) -> None:
        inherits = self._variant("P")
        overrides = self._variant("G", price=Decimal("64.90"))

        self.product.price = Decimal("70.00")
        self.product.save(update_fields=["price"])

        self.assertEqual(self.product.get_effective_price(inherits), Decimal("70.00"))
        self.assertEqual(self.product.get_effective_price(overrides), Decimal("64.90"))

    def test_changing_a_variant_price_does_not_touch_its_siblings(self) -> None:
        premium = self._variant("Premium", price=Decimal("70.00"))
        basic = self._variant("Basica")

        premium.price = Decimal("80.00")
        premium.save(update_fields=["price"])

        self.assertEqual(self.product.get_effective_price(premium), Decimal("80.00"))
        self.assertEqual(self.product.get_effective_price(basic), Decimal("59.90"))


class VariantPriceValidationTest(TestCase):
    """`price >= 0` -- the same floor the product form already enforces on
    Product.price, surfaced through model validation (full_clean)."""

    def setUp(self) -> None:
        self.store = Store.get_default()
        self.category = Category.objects.create(name="Kits", store=self.store)
        self.product = Product.objects.create(
            name="Kit Academia",
            price=Decimal("99.90"),
            stock_quantity=10,
            category=self.category,
            store=self.store,
        )

    def _build(self, price) -> ProductVariant:
        return ProductVariant(
            product=self.product,
            name="Premium",
            color_hex="#111827",
            stock_quantity=3,
            price=price,
        )

    def test_none_passes_validation(self) -> None:
        self._build(None).full_clean()

    def test_zero_passes_validation(self) -> None:
        self._build(Decimal("0.00")).full_clean()

    def test_positive_price_passes_validation(self) -> None:
        self._build(Decimal("129.90")).full_clean()

    def test_negative_price_is_rejected(self) -> None:
        with self.assertRaises(ValidationError) as ctx:
            self._build(Decimal("-1.00")).full_clean()

        self.assertIn("price", ctx.exception.message_dict)

    def test_more_than_two_decimal_places_is_rejected(self) -> None:
        with self.assertRaises(ValidationError) as ctx:
            self._build(Decimal("10.123")).full_clean()

        self.assertIn("price", ctx.exception.message_dict)
