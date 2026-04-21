"""
Frontend-Backend Product Filter Integration Tests

Validates that frontend and backend use consistent filter parameter names
for product listing with price range and availability filters.

Critical Integration Points:
- Frontend sends: min_price, max_price, in_stock
- Backend accepts: min_price, max_price, in_stock
- Both should use the same parameter names to avoid silent failures

Run tests with:
    pytest tests/test_product_filters_integration.py -v
"""

import os
from decimal import Decimal
from typing import Any

import django
import pytest
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

# Configure Django before importing models
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'bipdelivery.core.settings')
django.setup()

from bipdelivery.api.models import Category, Product  # noqa: E402

pytestmark = pytest.mark.django_db


class ProductFilterIntegrationTest(TestCase):
    """Test frontend-backend filter parameter alignment."""

    client: APIClient
    user: User
    category: Category
    products: list[Product]

    def setUp(self) -> None:
        """Create test data with various price and stock levels."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser', password='testpass123'
        )
        self.client.force_authenticate(user=self.user)

        # Create test category
        self.category = Category.objects.create(
            name='Test Category',
            slug='test-category'
        )

        # Create products with different prices and availability
        self.products = [
            Product.objects.create(
                name='Cheap Product',
                slug='cheap-product',
                price=Decimal('10.00'),
                category=self.category,
                is_available=True,
                stock_quantity=5
            ),
            Product.objects.create(
                name='Medium Product',
                slug='medium-product',
                price=Decimal('50.00'),
                category=self.category,
                is_available=True,
                stock_quantity=3
            ),
            Product.objects.create(
                name='Expensive Product',
                slug='expensive-product',
                price=Decimal('100.00'),
                category=self.category,
                is_available=True,
                stock_quantity=1
            ),
            Product.objects.create(
                name='Out of Stock Product',
                slug='out-of-stock-product',
                price=Decimal('75.00'),
                category=self.category,
                is_available=False,
                stock_quantity=0
            ),
        ]

    def test_filter_by_min_price(self) -> None:
        """Frontend uses min_price parameter; backend should respect it."""
        response: Any = self.client.get(
            '/api/v1/products/',
            {'min_price': '50.00'}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should return Medium (50.00), Expensive (100.00), and Out of Stock (75.00)
        self.assertEqual(len(response.data['results']), 3)
        product_names = [p['name'] for p in response.data['results']]
        self.assertIn('Medium Product', product_names)
        self.assertIn('Expensive Product', product_names)
        self.assertIn('Out of Stock Product', product_names)
        self.assertNotIn('Cheap Product', product_names)

    def test_filter_by_max_price(self) -> None:
        """Frontend uses max_price parameter; backend should respect it."""
        response: Any = self.client.get(
            '/api/v1/products/',
            {'max_price': '60.00'}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)  # Cheap and Medium
        product_names = [p['name'] for p in response.data['results']]
        self.assertIn('Cheap Product', product_names)
        self.assertIn('Medium Product', product_names)
        self.assertNotIn('Expensive Product', product_names)

    def test_filter_by_price_range(self) -> None:
        """Frontend sends both min_price and max_price together."""
        response: Any = self.client.get(
            '/api/v1/products/',
            {'min_price': '40.00', 'max_price': '90.00'}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should return Medium (50.00) and Out of Stock (75.00)
        self.assertEqual(len(response.data['results']), 2)
        product_names = [p['name'] for p in response.data['results']]
        self.assertIn('Medium Product', product_names)
        self.assertIn('Out of Stock Product', product_names)
        self.assertNotIn('Cheap Product', product_names)
        self.assertNotIn('Expensive Product', product_names)

    def test_filter_by_in_stock(self) -> None:
        """Frontend uses in_stock parameter; backend should filter availability."""
        response: Any = self.client.get(
            '/api/v1/products/',
            {'in_stock': 'true'}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 3)  # Only in-stock items
        product_names = [p['name'] for p in response.data['results']]
        self.assertNotIn('Out of Stock Product', product_names)
        self.assertIn('Cheap Product', product_names)
        self.assertIn('Medium Product', product_names)
        self.assertIn('Expensive Product', product_names)

    def test_filter_out_of_stock(self) -> None:
        """Frontend can explicitly filter for out-of-stock products."""
        response: Any = self.client.get(
            '/api/v1/products/',
            {'in_stock': 'false'}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)  # Only out-of-stock
        product_names = [p['name'] for p in response.data['results']]
        self.assertIn('Out of Stock Product', product_names)

    def test_combined_filters_price_and_stock(self) -> None:
        """Frontend sends price range + stock filter together."""
        response: Any = self.client.get(
            '/api/v1/products/',
            {'min_price': '30.00', 'max_price': '80.00', 'in_stock': 'true'}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should only return Medium (50.00) that is in range and in_stock
        self.assertEqual(len(response.data['results']), 1)
        product_names = [p['name'] for p in response.data['results']]
        self.assertIn('Medium Product', product_names)

    def test_filter_with_invalid_price_value(self) -> None:
        """Backend should gracefully handle invalid price values."""
        response: Any = self.client.get(
            '/api/v1/products/',
            {'min_price': 'not-a-number'}
        )

        # Should not crash, just ignore invalid filter
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 4)  # All products

    def test_filter_backwards_compatibility_old_params(self) -> None:
        """Ensure old parameter names (price__gte, price__lte) don't work.

        This test documents that frontend MUST use min_price/max_price,
        not the Django ORM syntax (price__gte/price__lte).
        """
        response: Any = self.client.get(
            '/api/v1/products/',
            {'price__gte': '50.00'}  # Old frontend syntax
        )

        # Should return all products, not filtered
        # (because backend doesn't recognize price__gte)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # This documents current behavior - old params are silently ignored
        self.assertEqual(len(response.data['results']), 4)

    def test_filter_integration_example_ui_scenario(self) -> None:
        """Simulates real UI scenario: user filters by price range and availability.

        This validates the happy path that frontend UI should perform:
        1. User sets price min/max
        2. User checks "in stock only"
        3. Frontend sends unified parameters
        4. Backend returns correct results
        """
        # User wants products between $40-$80 that are in stock
        response: Any = self.client.get(
            '/api/v1/products/',
            {
                'min_price': '40.00',
                'max_price': '80.00',
                'in_stock': 'true'
            }
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        products = response.data['results']

        # Should only return Medium Product (price 50.00, in stock)
        self.assertEqual(len(products), 1)
        self.assertEqual(products[0]['name'], 'Medium Product')
        self.assertEqual(products[0]['price'], '50.00')
        self.assertTrue(products[0]['is_available'])
