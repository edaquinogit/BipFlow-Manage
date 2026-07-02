"""
Token Refresh Flow Integration Tests

Validates the complete 401 -> refresh token -> retry flow:
1. Initial request fails with 401 (token expired)
2. System attempts to refresh access token
3. Original request is retried with new token
4. Request succeeds

Critical to prevent user session dropout when access token expires
but refresh token is still valid.

The refresh token travels exclusively via the httpOnly `refresh_token`
cookie (never the request body), so every test sets/reads that cookie
through `self.client.cookies` instead of the POST payload.

Run tests with:
    pytest tests/test_token_refresh_flow.py -v
"""

import os
from typing import Any

import django
import pytest
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

# Configure Django before importing models
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "bipdelivery.core.settings")
django.setup()

from bipdelivery.api.models import Category, Product  # noqa: E402
from bipdelivery.api.throttling import REFRESH_TOKEN_COOKIE_NAME  # noqa: E402

pytestmark = pytest.mark.django_db


class TokenRefreshFlowTest(TestCase):
    """Test token refresh flow when access token expires."""

    client: APIClient
    user: User
    category: Category
    product: Product

    def setUp(self) -> None:
        """Create test data and user."""
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", password="testpass123")

        # Create test data
        self.category = Category.objects.create(name="Test Category", slug="test-category")
        self.product = Product.objects.create(
            name="Test Product",
            slug="test-product",
            price=10.00,
            category=self.category,
            is_available=True,
            stock_quantity=5,
        )

    def _set_refresh_cookie(self, refresh: str) -> None:
        self.client.cookies[REFRESH_TOKEN_COOKIE_NAME] = refresh

    def test_refresh_token_endpoint_exists_at_correct_path(self) -> None:
        """Validate refresh token endpoint is at /api/auth/token/refresh/."""
        refresh = RefreshToken.for_user(self.user)
        self._set_refresh_cookie(str(refresh))

        response: Any = self.client.post("/api/auth/token/refresh/", {}, format="json")

        # Should succeed
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)

    def test_refresh_token_endpoint_rejects_wrong_path(self) -> None:
        """Validate old incorrect path /token/refresh/ returns 404."""
        refresh = RefreshToken.for_user(self.user)
        self._set_refresh_cookie(str(refresh))

        # Try old wrong endpoint
        response: Any = self.client.post("/token/refresh/", {}, format="json")  # Wrong old path

        # Should fail (404 or 404-like error)
        self.assertIn(
            response.status_code, [status.HTTP_404_NOT_FOUND, status.HTTP_405_METHOD_NOT_ALLOWED]
        )

    def test_refresh_token_with_valid_refresh_token(self) -> None:
        """Valid refresh token cookie should return new access token."""
        refresh = RefreshToken.for_user(self.user)
        self._set_refresh_cookie(str(refresh))

        response: Any = self.client.post("/api/auth/token/refresh/", {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIsNotNone(response.data["access"])

    def test_refresh_token_with_invalid_refresh_token(self) -> None:
        """Invalid refresh token cookie should return 401."""
        self._set_refresh_cookie("invalid-token-here")

        response: Any = self.client.post("/api/auth/token/refresh/", {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_token_with_expired_refresh_token(self) -> None:
        """Expired refresh token cookie should return 401."""
        import datetime

        refresh = RefreshToken.for_user(self.user)

        # Manually expire the refresh token by manipulating its exp claim
        refresh.set_exp(lifetime=datetime.timedelta(seconds=-1))
        self._set_refresh_cookie(str(refresh))

        response: Any = self.client.post("/api/auth/token/refresh/", {}, format="json")

        # Should reject expired token
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_request_with_valid_access_token(self) -> None:
        """Request with valid access token should succeed."""
        tokens = RefreshToken.for_user(self.user)
        access_token = str(tokens.access_token)

        # Make authenticated request
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        response: Any = self.client.get("/api/v1/products/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_frontend_endpoint_alignment(self) -> None:
        """Validate frontend calls correct endpoint: /api/auth/token/refresh/

        This test documents the contract that frontend MUST use:
        /api/auth/token/refresh/ (not /token/refresh/ or other variants)
        """
        refresh = RefreshToken.for_user(self.user)
        self._set_refresh_cookie(str(refresh))

        # Frontend calls this endpoint
        response: Any = self.client.post("/api/auth/token/refresh/", {}, format="json")

        # Should succeed - this is the only valid endpoint
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)

    def test_refresh_rotates_the_cookie_not_the_body(self) -> None:
        """Refresh endpoint should rotate the httpOnly cookie, never expose it in JSON."""
        refresh = RefreshToken.for_user(self.user)
        self._set_refresh_cookie(str(refresh))

        response: Any = self.client.post("/api/auth/token/refresh/", {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertNotIn("refresh", response.data)
        self.assertIn(REFRESH_TOKEN_COOKIE_NAME, response.cookies)
        rotated_cookie = response.cookies[REFRESH_TOKEN_COOKIE_NAME]
        self.assertTrue(rotated_cookie["httponly"])
        self.assertEqual(rotated_cookie["samesite"], "Strict")

    @override_settings(BIPFLOW_CROSS_ORIGIN_COOKIES=True, REFRESH_COOKIE_SAMESITE="None")
    def test_cross_origin_opt_in_relaxes_samesite_and_forces_secure(self) -> None:
        """BIPFLOW_CROSS_ORIGIN_COOKIES=True (Render+Pages split deploy) must
        flip SameSite to None and force Secure -- browsers silently drop a
        SameSite=None cookie that isn't also Secure, which would otherwise
        break login with no visible error.
        """
        refresh = RefreshToken.for_user(self.user)
        self._set_refresh_cookie(str(refresh))

        response: Any = self.client.post("/api/auth/token/refresh/", {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rotated_cookie = response.cookies[REFRESH_TOKEN_COOKIE_NAME]
        self.assertEqual(rotated_cookie["samesite"], "None")
        self.assertTrue(rotated_cookie["secure"])

    def test_refreshed_access_token_is_valid(self) -> None:
        """Access token returned from refresh should be usable immediately."""
        tokens = RefreshToken.for_user(self.user)
        self._set_refresh_cookie(str(tokens))

        refresh_response: Any = self.client.post("/api/auth/token/refresh/", {}, format="json")

        self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)
        new_access_token = refresh_response.data["access"]

        # Use new access token in authenticated request
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {new_access_token}")
        protected_response: Any = self.client.get("/api/v1/products/")

        # Should succeed with refreshed token
        self.assertEqual(protected_response.status_code, status.HTTP_200_OK)

    def test_refresh_token_missing_cookie(self) -> None:
        """Missing refresh token cookie should return 400."""
        response: Any = self.client.post("/api/auth/token/refresh/", {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_multiple_refresh_cycles(self) -> None:
        """Multiple refresh cycles should work sequentially, each rotating the cookie."""
        tokens1 = RefreshToken.for_user(self.user)
        self._set_refresh_cookie(str(tokens1))
        response1: Any = self.client.post("/api/auth/token/refresh/", {}, format="json")
        self.assertEqual(response1.status_code, status.HTTP_200_OK)

        # The rotated cookie set on the test client is used automatically next.
        response2: Any = self.client.post("/api/auth/token/refresh/", {}, format="json")
        self.assertEqual(response2.status_code, status.HTTP_200_OK)

        response3: Any = self.client.post("/api/auth/token/refresh/", {}, format="json")
        self.assertEqual(response3.status_code, status.HTTP_200_OK)

    def test_refresh_endpoint_requires_post_method(self) -> None:
        """Refresh endpoint should only accept POST requests."""
        refresh = RefreshToken.for_user(self.user)
        self._set_refresh_cookie(str(refresh))

        # Try GET
        response_get: Any = self.client.get("/api/auth/token/refresh/")
        self.assertEqual(response_get.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        # Try PUT
        response_put: Any = self.client.put("/api/auth/token/refresh/", {}, format="json")
        self.assertEqual(response_put.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        # Try DELETE
        response_delete: Any = self.client.delete("/api/auth/token/refresh/")
        self.assertEqual(response_delete.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
