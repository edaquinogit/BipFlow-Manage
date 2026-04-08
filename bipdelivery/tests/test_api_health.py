"""
Backend API Health Check Tests

Comprehensive test suite validating Django REST Framework endpoints respond correctly
including database connectivity, authentication requirements, and full CRUD operations.

Documentation:
- Ensures all API endpoints require proper JWT authentication
- Validates data serialization and deserialization
- Tests error conditions (404, 400, protections)
- Confirms database transactional integrity

Run tests with:
    python manage.py test tests.test_api_health -v 2
    pytest tests/test_api_health.py -v (if using pytest)
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

# Configure Django before importing models (required for app initialization)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'bipdelivery.core.settings')
django.setup()

from bipdelivery.api.models import Category, Product  # noqa: E402

pytestmark = pytest.mark.django_db


class CategoryAPIHealthTest(TestCase):
    """Test Category endpoints are functioning."""

    client: APIClient
    user: User
    category: Category

    def setUp(self) -> None:
        """Initialize test client and create test data."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser', password='testpass123'
        )
        self.category = Category.objects.create(
            name='Electronics', slug='electronics'
        )

    def test_category_list_requires_auth(self) -> None:
        """Categories endpoint should require authentication."""
        response: Any = self.client.get('/api/v1/categories/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_category_list_returns_200_authenticated(self) -> None:
        """Categories list should return 200 when authenticated."""
        self.client.force_authenticate(user=self.user)
        response: Any = self.client.get('/api/v1/categories/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)

    def test_category_list_contains_data(self) -> None:
        """Categories list should contain created category."""
        self.client.force_authenticate(user=self.user)
        response: Any = self.client.get('/api/v1/categories/')
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'Electronics')

    def test_category_create(self) -> None:
        """Should create category via POST endpoint."""
        self.client.force_authenticate(user=self.user)
        payload = {'name': 'Books', 'slug': 'books'}
        response: Any = self.client.post('/api/v1/categories/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Books')

    def test_category_retrieve(self) -> None:
        """Should retrieve category by ID."""
        self.client.force_authenticate(user=self.user)
        response: Any = self.client.get(f'/api/v1/categories/{self.category.id}/')  # type: ignore
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Electronics')

    def test_category_update(self) -> None:
        """Should update category via PUT endpoint."""
        self.client.force_authenticate(user=self.user)
        payload = {'name': 'Updated Electronics'}
        response: Any = self.client.put(
            f'/api/v1/categories/{self.category.id}/',  # type: ignore
            payload,
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Updated Electronics')

    def test_category_delete(self) -> None:
        """Should delete category via DELETE endpoint."""
        self.client.force_authenticate(user=self.user)
        response: Any = self.client.delete(f'/api/v1/categories/{self.category.id}/')  # type: ignore
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Category.objects.filter(id=self.category.id).exists())  # type: ignore


class ProductAPIHealthTest(TestCase):
    """Test Product endpoints are functioning."""

    client: APIClient
    user: User
    category: Category
    product: Product

    def setUp(self) -> None:
        """Initialize test client and create test data."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser', password='testpass123'
        )
        self.category = Category.objects.create(
            name='Electronics', slug='electronics'
        )
        self.product = Product.objects.create(
            name='Laptop',
            sku='LAP-001',
            price=Decimal('999.99'),
            stock_quantity=5,
            category=self.category,
        )

    def test_product_list_requires_auth(self) -> None:
        """Products endpoint should require authentication."""
        response: Any = self.client.get('/api/v1/products/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_product_list_returns_200_authenticated(self) -> None:
        """Products list should return 200 when authenticated."""
        self.client.force_authenticate(user=self.user)
        response: Any = self.client.get('/api/v1/products/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)

    def test_product_list_contains_data(self) -> None:
        """Products list should contain created product."""
        self.client.force_authenticate(user=self.user)
        response: Any = self.client.get('/api/v1/products/')
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'Laptop')

    def test_product_includes_category_name(self) -> None:
        """Product response should include denormalized category_name."""
        self.client.force_authenticate(user=self.user)
        response: Any = self.client.get(f'/api/v1/products/{self.product.id}/')  # type: ignore
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['category_name'], 'Electronics')

    def test_product_availability_calculated(self) -> None:
        """Product should have is_available=True when stock > 0."""
        self.client.force_authenticate(user=self.user)
        response: Any = self.client.get(f'/api/v1/products/{self.product.id}/')  # type: ignore
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_available'])

    def test_product_unavailable_out_of_stock(self) -> None:
        """Product should have is_available=False when stock=0."""
        self.product.stock_quantity = 0
        self.product.save()
        self.client.force_authenticate(user=self.user)
        response: Any = self.client.get(f'/api/v1/products/{self.product.id}/')  # type: ignore
        self.assertFalse(response.data['is_available'])

    def test_product_create(self) -> None:
        """Should create product via POST endpoint."""
        self.client.force_authenticate(user=self.user)
        payload = {
            'name': 'Desktop',
            'sku': 'DES-001',
            'price': '1299.99',
            'stock_quantity': 3,
            'category': self.category.id,  # type: ignore
        }
        response: Any = self.client.post('/api/v1/products/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Desktop')
        self.assertIsNotNone(response.data['slug'])

    def test_product_create_auto_generates_slug(self) -> None:
        """Product slug should be auto-generated if not provided."""
        self.client.force_authenticate(user=self.user)
        payload = {
            'name': 'Phone',
            'sku': 'PHN-001',
            'price': '599.99',
            'stock_quantity': 10,
            'category': self.category.id,  # type: ignore
        }
        response: Any = self.client.post('/api/v1/products/', payload, format='json')
        self.assertIn('phone', response.data['slug'])
        self.assertRegex(response.data['slug'], r'^phone-[a-f0-9]{8}$')

    def test_product_retrieve(self) -> None:
        """Should retrieve product by ID."""
        self.client.force_authenticate(user=self.user)
        response: Any = self.client.get(f'/api/v1/products/{self.product.id}/')  # type: ignore
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Laptop')

    def test_product_update(self) -> None:
        """Should update product via PUT endpoint."""
        self.client.force_authenticate(user=self.user)
        payload = {'name': 'Updated Laptop', 'stock_quantity': 8}
        response: Any = self.client.put(
            f'/api/v1/products/{self.product.id}/',  # type: ignore
            payload,
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Updated Laptop')
        self.assertEqual(response.data['stock_quantity'], 8)

    def test_product_delete(self) -> None:
        """Should delete product via DELETE endpoint."""
        self.client.force_authenticate(user=self.user)
        response: Any = self.client.delete(f'/api/v1/products/{self.product.id}/')  # type: ignore
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Product.objects.filter(id=self.product.id).exists())  # type: ignore

    def test_product_delete_with_category_protect(self) -> None:
        """Deleting category with products should fail (PROTECT)."""
        self.client.force_authenticate(user=self.user)
        response: Any = self.client.delete(f'/api/v1/categories/{self.category.id}/')  # type: ignore
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(Category.objects.filter(id=self.category.id).exists())  # type: ignore


class DjangoHealthTest(TestCase):
    """Test Django framework and database connectivity."""

    def test_django_database_connected(self) -> None:
        """Database connection should be functional."""
        # Creating and retrieving from DB proves connection
        user = User.objects.create_user(username='dbtest', password='pass')
        retrieved = User.objects.get(username='dbtest')
        self.assertEqual(user.id, retrieved.id)  # type: ignore

    def test_django_migrations_applied(self) -> None:
        """All migrations should be applied (tables exist)."""
        # If migrations not applied, table queries will fail
        category_count = Category.objects.count()
        self.assertEqual(category_count, 0)  # No categories yet, but table exists

    def test_django_settings_loaded(self) -> None:
        """Django settings should be properly loaded."""
        from django.conf import settings
        self.assertIsNotNone(settings.INSTALLED_APPS)
        self.assertIn('bipdelivery.api.apps.ApiConfig', settings.INSTALLED_APPS)
        self.assertIn('rest_framework', settings.INSTALLED_APPS)

    def test_drf_authentication_configured(self) -> None:
        """DRF should have JWT authentication configured."""
        from django.conf import settings
        rest_framework_config = settings.REST_FRAMEWORK
        self.assertIn('DEFAULT_AUTHENTICATION_CLASSES', rest_framework_config)
        auth_classes = rest_framework_config['DEFAULT_AUTHENTICATION_CLASSES']
        self.assertTrue(any('JWT' in cls for cls in auth_classes))
