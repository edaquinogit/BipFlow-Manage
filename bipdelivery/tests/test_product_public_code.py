"""Etapa 1 of the QR-code stock-exit evolution: an auto-generated, immutable
public_code per product, used to power QR-code lookups for both the PDV
(Etapa 3) and public storefront deep links (Etapa 4).

See docs/architecture/qrcode-stock-exit-evolution.md. Reuses
TwoStoreFixtureMixin (test_store_active_isolation.py) for cross-store
isolation, same as test_stock_movements.py.
"""
from decimal import Decimal
from unittest.mock import patch

from django.db import IntegrityError
from django.test import TestCase

from bipdelivery.api import models as api_models
from bipdelivery.api.management.commands.generate_missing_product_codes import (
    Command as GenerateMissingProductCodesCommand,
)
from bipdelivery.api.models import Product
from bipdelivery.tests.test_store_active_isolation import TwoStoreFixtureMixin


class ProductPublicCodeGenerationTest(TwoStoreFixtureMixin, TestCase):
    def test_creating_a_product_assigns_a_public_code(self) -> None:
        self.assertTrue(self.product_a.public_code)
        self.assertEqual(len(self.product_a.public_code), api_models.PRODUCT_PUBLIC_CODE_LENGTH)

    def test_public_code_alphabet_excludes_ambiguous_characters(self) -> None:
        for character in self.product_a.public_code:
            self.assertIn(character, api_models.PRODUCT_PUBLIC_CODE_ALPHABET)
        for ambiguous_character in "0O1IL":
            self.assertNotIn(ambiguous_character, api_models.PRODUCT_PUBLIC_CODE_ALPHABET)

    def test_two_products_in_different_stores_may_share_a_code(self) -> None:
        """The constraint is per-store, not global -- this must not raise."""
        shared_code = "ABCD2345"
        self.product_a.public_code = shared_code
        self.product_a.save(update_fields=["public_code"])

        self.product_b.public_code = shared_code
        self.product_b.save(update_fields=["public_code"])

        self.product_a.refresh_from_db()
        self.product_b.refresh_from_db()
        self.assertEqual(self.product_a.public_code, shared_code)
        self.assertEqual(self.product_b.public_code, shared_code)

    def test_collision_on_generation_is_retried_transparently(self) -> None:
        colliding_code = self.product_a.public_code
        unique_code = "FRESHCOD"

        new_product = Product(
            name="Produto Retry",
            price=Decimal("7.00"),
            category=self.category_a,
            store=self.store_a,
        )
        with patch.object(
            api_models, "generate_product_public_code", side_effect=[colliding_code, unique_code]
        ):
            new_product.save()

        self.assertEqual(new_product.public_code, unique_code)

    def test_exhausting_retries_reraises_the_integrity_error(self) -> None:
        colliding_code = self.product_a.public_code

        new_product = Product(
            name="Produto Sem Sorte",
            price=Decimal("7.00"),
            category=self.category_a,
            store=self.store_a,
        )
        with patch.object(api_models, "generate_product_public_code", return_value=colliding_code):
            with self.assertRaises(IntegrityError):
                new_product.save()

    def test_unrelated_integrity_error_is_not_masked_by_retries(self) -> None:
        """A duplicate slug (not public_code) must fail fast, not retry 8 times."""
        colliding_slug = self.product_a.slug

        new_product = Product(
            name="Produto Slug Duplicado",
            price=Decimal("7.00"),
            category=self.category_a,
            store=self.store_a,
            slug=colliding_slug,
        )
        with patch.object(api_models, "generate_product_public_code") as mocked_generator:
            mocked_generator.side_effect = lambda: "AAAA2222"
            with self.assertRaises(IntegrityError):
                new_product.save()

            # A single attempt: the slug conflict can never be fixed by a new
            # public_code, so it must not retry PRODUCT_PUBLIC_CODE_MAX_ATTEMPTS times.
            self.assertEqual(mocked_generator.call_count, 1)


class ProductPublicCodeBackfillCommandTest(TwoStoreFixtureMixin, TestCase):
    def test_command_backfills_only_products_missing_a_code(self) -> None:
        self.product_a.public_code = ""
        Product.objects.filter(pk=self.product_a.pk).update(public_code="")
        untouched_code = self.product_b.public_code

        GenerateMissingProductCodesCommand().handle()

        self.product_a.refresh_from_db()
        self.product_b.refresh_from_db()
        self.assertTrue(self.product_a.public_code)
        self.assertEqual(self.product_b.public_code, untouched_code)

    def test_command_is_a_no_op_when_nothing_is_missing(self) -> None:
        codes_before = set(Product.objects.values_list("public_code", flat=True))

        GenerateMissingProductCodesCommand().handle()

        codes_after = set(Product.objects.values_list("public_code", flat=True))
        self.assertEqual(codes_before, codes_after)


class ProductPublicCodeAPITest(TwoStoreFixtureMixin, TestCase):
    def test_public_code_is_exposed_on_the_product_payload(self) -> None:
        response = self.client.get(f"/api/v1/products/{self.product_b.id}/")

        self.assertEqual(response.data["public_code"], self.product_b.public_code)

    def test_patch_with_public_code_is_rejected(self) -> None:
        original_code = self.product_b.public_code

        response = self.client.patch(
            f"/api/v1/products/{self.product_b.id}/",
            {"public_code": "HACKED99"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.product_b.refresh_from_db()
        self.assertEqual(self.product_b.public_code, original_code)

    def test_by_code_lookup_returns_the_matching_product(self) -> None:
        response = self.client.get(f"/api/v1/products/by-code/{self.product_b.public_code}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], self.product_b.id)

    def test_by_code_lookup_is_case_insensitive(self) -> None:
        response = self.client.get(
            f"/api/v1/products/by-code/{self.product_b.public_code.lower()}/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], self.product_b.id)

    def test_by_code_lookup_never_crosses_stores(self) -> None:
        response = self.client.get(f"/api/v1/products/by-code/{self.product_a.public_code}/")

        self.assertEqual(response.status_code, 404)

    def test_by_code_lookup_unknown_code_404s(self) -> None:
        response = self.client.get("/api/v1/products/by-code/DOESNOTEXIST/")

        self.assertEqual(response.status_code, 404)

    def test_by_code_lookup_is_public(self) -> None:
        from rest_framework.test import APIClient

        anonymous_client = APIClient()
        response = anonymous_client.get(
            f"/api/v1/products/by-code/{self.product_a.public_code}/",
        )

        self.assertEqual(response.status_code, 200)
