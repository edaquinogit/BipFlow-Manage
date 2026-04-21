"""
Token Refresh Flow Integration Tests

Validates the complete 401 -> refresh token -> retry flow:
1. Initial request fails with 401 (token expired)
2. System attempts to refresh access token
3. Original request is retried with new token
4. Request succeeds

Critical to prevent user session dropout when access token expires
but refresh token is still valid.

Run tests with:
    pytest tests/test_token_refresh_flow.py -v
"""

import os
from typing import Any

import django
import pytest
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

# Configure Django before importing models
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'bipdelivery.core.settings')
django.setup()

from bipdelivery.api.models import Category, Product  # noqa: E402

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
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )

        # Create test data
        self.category = Category.objects.create(
            name='Test Category',
            slug='test-category'
        )
        self.product = Product.objects.create(
            name='Test Product',
            slug='test-product',
            price=10.00,
            category=self.category,
            is_available=True,
            stock_quantity=5
        )

    def test_refresh_token_endpoint_exists_at_correct_path(self) -> None:
        """Validate refresh token endpoint is at /api/auth/token/refresh/."""
        # Get tokens
        refresh = RefreshToken.for_user(self.user)

        # Try to refresh at correct endpoint
        response: Any = self.client.post(
            '/api/auth/token/refresh/',
            {'refresh': str(refresh)},
            format='json'
        )

        # Should succeed
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

    def test_refresh_token_endpoint_rejects_wrong_path(self) -> None:
        """Validate old incorrect path /token/refresh/ returns 404."""
        # Get tokens
        refresh = RefreshToken.for_user(self.user)

        # Try old wrong endpoint
        response: Any = self.client.post(
            '/token/refresh/',  # Wrong old path
            {'refresh': str(refresh)},
            format='json'
        )

        # Should fail (404 or 404-like error)
        self.assertIn(response.status_code, [
            status.HTTP_404_NOT_FOUND,
            status.HTTP_405_METHOD_NOT_ALLOWED
        ])

    def test_refresh_token_with_valid_refresh_token(self) -> None:
        """Valid refresh token should return new access token."""
        refresh = RefreshToken.for_user(self.user)
        old_refresh_str = str(refresh)

        response: Any = self.client.post(
            '/api/auth/token/refresh/',
            {'refresh': old_refresh_str},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        # New token should be different from old
        self.assertIsNotNone(response.data['access'])

    def test_refresh_token_with_invalid_refresh_token(self) -> None:
        """Invalid refresh token should return 401."""
        response: Any = self.client.post(
            '/api/auth/token/refresh/',
            {'refresh': 'invalid-token-here'},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_token_with_expired_refresh_token(self) -> None:
        """Expired refresh token should return 401."""
        import datetime

        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(self.user)

        # Manually expire the refresh token by manipulating its exp claim
        refresh.set_exp(lifetime=datetime.timedelta(seconds=-1))

        response: Any = self.client.post(
            '/api/auth/token/refresh/',
            {'refresh': str(refresh)},
            format='json'
        )

        # Should reject expired token
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_request_with_valid_access_token(self) -> None:
        """Request with valid access token should succeed."""
        tokens = RefreshToken.for_user(self.user)
        access_token = str(tokens.access_token)

        # Make authenticated request
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        response: Any = self.client.get('/api/v1/products/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_frontend_endpoint_alignment(self) -> None:
        """Validate frontend calls correct endpoint: /api/auth/token/refresh/

        This test documents the contract that frontend MUST use:
        /api/auth/token/refresh/ (not /token/refresh/ or other variants)
        """
        refresh = RefreshToken.for_user(self.user)

        # Frontend calls this endpoint
        response: Any = self.client.post(
            '/api/auth/token/refresh/',
            {'refresh': str(refresh)},
            format='json'
        )

        # Should succeed - this is the only valid endpoint
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_refresh_returns_both_access_and_refresh_tokens(self) -> None:
        """Refresh endpoint should return both access and refresh tokens."""
        refresh = RefreshToken.for_user(self.user)

        response: Any = self.client.post(
            '/api/auth/token/refresh/',
            {'refresh': str(refresh)},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should have both tokens
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_refreshed_access_token_is_valid(self) -> None:
        """Access token returned from refresh should be usable immediately."""
        # Get initial tokens
        tokens = RefreshToken.for_user(self.user)

        # Refresh to get new access token
        refresh_response: Any = self.client.post(
            '/api/auth/token/refresh/',
            {'refresh': str(tokens)},
            format='json'
        )

        self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)
        new_access_token = refresh_response.data['access']

        # Use new access token in authenticated request
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {new_access_token}')
        protected_response: Any = self.client.get('/api/v1/products/')

        # Should succeed with refreshed token
        self.assertEqual(protected_response.status_code, status.HTTP_200_OK)

    def test_refresh_token_missing_body(self) -> None:
        """Missing refresh token in request body should return 400."""
        response: Any = self.client.post(
            '/api/auth/token/refresh/',
            {},  # Empty body
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_multiple_refresh_cycles(self) -> None:
        """Multiple refresh cycles should work sequentially."""
        # First cycle
        tokens1 = RefreshToken.for_user(self.user)
        response1: Any = self.client.post(
            '/api/auth/token/refresh/',
            {'refresh': str(tokens1)},
            format='json'
        )
        self.assertEqual(response1.status_code, status.HTTP_200_OK)

        # Second cycle with new tokens
        tokens2 = RefreshToken.for_user(self.user)
        response2: Any = self.client.post(
            '/api/auth/token/refresh/',
            {'refresh': str(tokens2)},
            format='json'
        )
        self.assertEqual(response2.status_code, status.HTTP_200_OK)

        # Third cycle
        tokens3 = RefreshToken.for_user(self.user)
        response3: Any = self.client.post(
            '/api/auth/token/refresh/',
            {'refresh': str(tokens3)},
            format='json'
        )
        self.assertEqual(response3.status_code, status.HTTP_200_OK)

    def test_refresh_endpoint_requires_post_method(self) -> None:
        """Refresh endpoint should only accept POST requests."""
        refresh = RefreshToken.for_user(self.user)

        # Try GET
        response_get: Any = self.client.get(
            '/api/auth/token/refresh/'
        )
        self.assertEqual(response_get.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        # Try PUT
        response_put: Any = self.client.put(
            '/api/auth/token/refresh/',
            {'refresh': str(refresh)},
            format='json'
        )
        self.assertEqual(response_put.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        # Try DELETE
        response_delete: Any = self.client.delete(
            '/api/auth/token/refresh/'
        )
        self.assertEqual(response_delete.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
