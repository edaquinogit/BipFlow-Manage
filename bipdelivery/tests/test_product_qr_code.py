"""Etapa 2 of the QR-code stock-exit evolution: rendering a product's
public_code (Etapa 1) as a printable QR Code.

See docs/architecture/qrcode-stock-exit-evolution.md. Reuses
TwoStoreFixtureMixin (test_store_active_isolation.py) for cross-store
isolation, same as test_stock_movements.py / test_product_public_code.py.
"""
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from bipdelivery.api.models import StoreMembership
from bipdelivery.tests.test_store_active_isolation import TwoStoreFixtureMixin


class ProductQrCodeAPITest(TwoStoreFixtureMixin, TestCase):
    def _qr_code_url(self, product) -> str:
        return f"/api/v1/products/{product.id}/qr-code/"

    @override_settings(FRONTEND_BASE_URL="https://example-store.bipflow.app")
    def test_qr_code_response_includes_code_url_and_png_data_uri(self) -> None:
        response = self.client.get(self._qr_code_url(self.product_b))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["public_code"], self.product_b.public_code)
        self.assertEqual(
            response.data["url"],
            f"https://example-store.bipflow.app/l/{self.store_b.slug}/p/{self.product_b.public_code}",
        )
        self.assertTrue(response.data["qr_code"].startswith("data:image/png;base64,"))

    def test_qr_code_cross_store_404s(self) -> None:
        response = self.client.get(self._qr_code_url(self.product_a))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_qr_code_anonymous_user_is_unauthorized(self) -> None:
        client = APIClient()

        response = client.get(self._qr_code_url(self.product_a))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_qr_code_regular_authenticated_user_without_role_is_forbidden(self) -> None:
        plain_user = User.objects.create_user(username="qr_plain", password="testpass123")
        client = APIClient()
        client.force_authenticate(user=plain_user, token={"store_id": self.store_b.id})

        response = client.get(self._qr_code_url(self.product_b))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_qr_code_viewer_role_can_read(self) -> None:
        viewer = User.objects.create_user(username="qr_viewer_b", password="testpass123")
        StoreMembership.objects.create(
            store=self.store_b, user=viewer, role=StoreMembership.ROLE_VIEWER
        )
        client = APIClient()
        client.force_authenticate(user=viewer, token={"store_id": self.store_b.id})

        response = client.get(self._qr_code_url(self.product_b))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
