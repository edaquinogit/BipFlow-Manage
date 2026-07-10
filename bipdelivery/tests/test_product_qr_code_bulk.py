"""Etapa 6 of the QR-code stock-exit evolution: bulk label printing (the
batch action Etapa 2 explicitly deferred).

See docs/architecture/qrcode-stock-exit-evolution.md. Reuses
TwoStoreFixtureMixin (test_store_active_isolation.py) for cross-store
isolation, same as test_product_qr_code.py -- but adds its own setUp() with
an extra store-B product, since TwoStoreFixtureMixin only creates one
product per store and a batch endpoint needs more than that to be tested
meaningfully.
"""
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from bipdelivery.api.models import Product, StoreMembership
from bipdelivery.api.product_labels import MAX_BULK_LABEL_IDS
from bipdelivery.tests.test_store_active_isolation import TwoStoreFixtureMixin


class ProductQrCodesBulkAPITest(TwoStoreFixtureMixin, TestCase):
    BULK_URL = "/api/v1/products/qr-codes-bulk/"

    def setUp(self) -> None:
        super().setUp()
        # Gives one of the two store-B products a `size`, so the "size
        # present vs. absent" distinction has real fixture data to assert
        # against, without needing a third product.
        self.product_b.size = "M"
        self.product_b.save(update_fields=["size"])
        self.product_b2 = Product.objects.create(
            name="Produto B2", price=Decimal("15.00"), category=self.category_b, store=self.store_b
        )

    def _bulk_url(self, ids) -> str:
        ids_param = ",".join(str(i) for i in ids)
        return f"{self.BULK_URL}?ids={ids_param}"

    @override_settings(FRONTEND_BASE_URL="https://example-store.bipflow.app")
    def test_bulk_returns_labels_for_requested_ids(self) -> None:
        response = self.client.get(self._bulk_url([self.product_b.id, self.product_b2.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        labels = response.data["labels"]
        self.assertEqual(len(labels), 2)
        self.assertEqual(response.data["missing_ids"], [])

        label_b = next(label for label in labels if label["id"] == self.product_b.id)
        self.assertEqual(label_b["public_code"], self.product_b.public_code)
        self.assertEqual(label_b["name"], self.product_b.name)
        self.assertEqual(label_b["price"], str(self.product_b.price))
        self.assertEqual(label_b["size"], "M")
        self.assertEqual(
            label_b["url"],
            f"https://example-store.bipflow.app/l/{self.store_b.slug}/p/{self.product_b.public_code}",
        )
        self.assertTrue(label_b["qr_code"].startswith("data:image/png;base64,"))

    def test_bulk_size_is_null_when_absent(self) -> None:
        response = self.client.get(self._bulk_url([self.product_b2.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data["labels"][0]["size"])

    def test_bulk_silently_excludes_cross_store_ids(self) -> None:
        response = self.client.get(self._bulk_url([self.product_b.id, self.product_a.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {label["id"] for label in response.data["labels"]}
        self.assertEqual(ids, {self.product_b.id})
        self.assertEqual(response.data["missing_ids"], [self.product_a.id])

    def test_bulk_reports_missing_ids_without_failing_batch(self) -> None:
        nonexistent_id = self.product_b2.id + 9999
        response = self.client.get(self._bulk_url([self.product_b.id, nonexistent_id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["labels"]), 1)
        self.assertEqual(response.data["missing_ids"], [nonexistent_id])

    def test_bulk_empty_ids_param_returns_validation_error(self) -> None:
        response = self.client.get(f"{self.BULK_URL}?ids=")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_bulk_missing_ids_param_returns_validation_error(self) -> None:
        response = self.client.get(self.BULK_URL)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_bulk_malformed_ids_param_returns_validation_error(self) -> None:
        response = self.client.get(f"{self.BULK_URL}?ids=abc")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_bulk_rejects_batch_over_max_size(self) -> None:
        ids = list(range(1, MAX_BULK_LABEL_IDS + 2))
        response = self.client.get(self._bulk_url(ids))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_bulk_dedupes_repeated_ids(self) -> None:
        response = self.client.get(self._bulk_url([self.product_b.id, self.product_b.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["labels"]), 1)

    def test_bulk_anonymous_user_is_unauthorized(self) -> None:
        client = APIClient()

        response = client.get(self._bulk_url([self.product_b.id]))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_bulk_regular_authenticated_user_without_role_is_forbidden(self) -> None:
        plain_user = User.objects.create_user(username="qr_bulk_plain", password="testpass123")
        client = APIClient()
        client.force_authenticate(user=plain_user, token={"store_id": self.store_b.id})

        response = client.get(self._bulk_url([self.product_b.id]))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_bulk_viewer_role_can_read(self) -> None:
        viewer = User.objects.create_user(username="qr_bulk_viewer_b", password="testpass123")
        StoreMembership.objects.create(
            store=self.store_b, user=viewer, role=StoreMembership.ROLE_VIEWER
        )
        client = APIClient()
        client.force_authenticate(user=viewer, token={"store_id": self.store_b.id})

        response = client.get(self._bulk_url([self.product_b.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
