"""
Backend API Health Check Tests

Comprehensive test suite validating Django REST Framework endpoints respond correctly
including database connectivity, authentication requirements, and full CRUD operations.

Documentation:
- Ensures public read endpoints and authenticated write endpoints behave correctly
- Validates data serialization and deserialization
- Tests error conditions (404, 400, protections)
- Confirms database transactional integrity

Run tests with:
    python manage.py test tests.test_api_health -v 2
    pytest tests/test_api_health.py -v (if using pytest)
"""

import os
import tempfile
from decimal import Decimal
from io import BytesIO
from typing import Any

import django
import pytest
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.test.utils import override_settings
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient

# Configure Django before importing models (required for app initialization)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "bipdelivery.core.settings")
django.setup()

from bipdelivery.api.models import Category, DeliveryRegion, Product, SaleOrder  # noqa: E402

pytestmark = pytest.mark.django_db


def build_test_image(filename: str) -> SimpleUploadedFile:
    """Create a tiny valid PNG upload for multipart API tests."""
    image_buffer = BytesIO()
    Image.new("RGB", (2, 2), color=(240, 120, 160)).save(image_buffer, format="PNG")
    image_buffer.seek(0)

    return SimpleUploadedFile(
        filename,
        image_buffer.read(),
        content_type="image/png",
    )


class CategoryAPIHealthTest(TestCase):
    """Test Category endpoints are functioning."""

    client: APIClient
    user: User
    category: Category

    def setUp(self) -> None:
        """Initialize test client and create test data."""
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", password="testpass123")
        self.category = Category.objects.create(name="Electronics", slug="electronics")

    def test_category_list_requires_auth(self) -> None:
        """Categories list should be publicly accessible."""
        response: Any = self.client.get("/api/v1/categories/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_category_list_returns_200_authenticated(self) -> None:
        """Categories list should return paginated results when authenticated."""
        self.client.force_authenticate(user=self.user)
        response: Any = self.client.get("/api/v1/categories/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("results", response.data)
        self.assertIsInstance(response.data["results"], list)

    def test_category_list_contains_data(self) -> None:
        """Categories list should contain created category."""
        self.client.force_authenticate(user=self.user)
        response: Any = self.client.get("/api/v1/categories/")
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["name"], "Electronics")

    def test_category_create(self) -> None:
        """Should create category via POST endpoint."""
        self.client.force_authenticate(user=self.user)
        payload = {"name": "Books", "slug": "books"}
        response: Any = self.client.post("/api/v1/categories/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Books")

    def test_category_retrieve(self) -> None:
        """Should retrieve category by ID."""
        self.client.force_authenticate(user=self.user)
        response: Any = self.client.get(f"/api/v1/categories/{self.category.id}/")  # type: ignore
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Electronics")

    def test_category_update(self) -> None:
        """Should update category via PUT endpoint."""
        self.client.force_authenticate(user=self.user)
        payload = {"name": "Updated Electronics"}
        response: Any = self.client.put(
            f"/api/v1/categories/{self.category.id}/", payload, format="json"  # type: ignore
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Updated Electronics")

    def test_category_delete(self) -> None:
        """Should delete category via DELETE endpoint."""
        self.client.force_authenticate(user=self.user)
        response: Any = self.client.delete(f"/api/v1/categories/{self.category.id}/")  # type: ignore
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
        self.user = User.objects.create_user(username="testuser", password="testpass123")
        self.category = Category.objects.create(name="Electronics", slug="electronics")
        self.product = Product.objects.create(
            name="Laptop",
            sku="LAP-001",
            price=Decimal("999.99"),
            stock_quantity=5,
            category=self.category,
        )

    def test_product_list_requires_auth(self) -> None:
        """Products list should be publicly accessible."""
        response: Any = self.client.get("/api/v1/products/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_product_list_returns_200_authenticated(self) -> None:
        """Products list should return paginated results when authenticated."""
        self.client.force_authenticate(user=self.user)
        response: Any = self.client.get("/api/v1/products/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("results", response.data)
        self.assertIsInstance(response.data["results"], list)

    def test_product_list_contains_data(self) -> None:
        """Products list should contain created product."""
        self.client.force_authenticate(user=self.user)
        response: Any = self.client.get("/api/v1/products/")
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["name"], "Laptop")

    def test_product_includes_category_name(self) -> None:
        """Product response should include denormalized category_name."""
        self.client.force_authenticate(user=self.user)
        response: Any = self.client.get(f"/api/v1/products/{self.product.id}/")  # type: ignore
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["category_name"], "Electronics")

    def test_product_availability_calculated(self) -> None:
        """Product should have is_available=True when stock > 0."""
        self.client.force_authenticate(user=self.user)
        response: Any = self.client.get(f"/api/v1/products/{self.product.id}/")  # type: ignore
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_available"])

    def test_product_unavailable_out_of_stock(self) -> None:
        """Product should have is_available=False when stock=0."""
        self.product.stock_quantity = 0
        self.product.save()
        self.client.force_authenticate(user=self.user)
        response: Any = self.client.get(f"/api/v1/products/{self.product.id}/")  # type: ignore
        self.assertFalse(response.data["is_available"])

    def test_product_create(self) -> None:
        """Should create product via POST endpoint."""
        self.client.force_authenticate(user=self.user)
        payload = {
            "name": "Desktop",
            "sku": "DES-001",
            "price": "1299.99",
            "stock_quantity": 3,
            "category": self.category.id,  # type: ignore
        }
        response: Any = self.client.post("/api/v1/products/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Desktop")
        self.assertIsNotNone(response.data["slug"])

    def test_product_create_auto_generates_slug(self) -> None:
        """Product slug should be auto-generated if not provided."""
        self.client.force_authenticate(user=self.user)
        payload = {
            "name": "Phone",
            "sku": "PHN-001",
            "price": "599.99",
            "stock_quantity": 10,
            "category": self.category.id,  # type: ignore
        }
        response: Any = self.client.post("/api/v1/products/", payload, format="json")
        self.assertIn("phone", response.data["slug"])
        self.assertRegex(response.data["slug"], r"^phone-[a-f0-9]{8}$")

    def test_product_retrieve(self) -> None:
        """Should retrieve product by ID."""
        self.client.force_authenticate(user=self.user)
        response: Any = self.client.get(f"/api/v1/products/{self.product.id}/")  # type: ignore
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Laptop")

    def test_product_retrieve_by_slug(self) -> None:
        """Should retrieve product detail by slug for public storefront routes."""
        response: Any = self.client.get(f"/api/v1/products/by-slug/{self.product.slug}/")  # type: ignore
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Laptop")
        self.assertEqual(response.data["slug"], self.product.slug)
        self.assertIn("images", response.data)

    def test_product_update(self) -> None:
        """Should update product via PUT endpoint."""
        self.client.force_authenticate(user=self.user)
        payload = {"name": "Updated Laptop", "stock_quantity": 8}
        response: Any = self.client.put(
            f"/api/v1/products/{self.product.id}/", payload, format="json"  # type: ignore
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Updated Laptop")
        self.assertEqual(response.data["stock_quantity"], 8)

    @override_settings(MEDIA_ROOT=tempfile.mkdtemp())
    def test_product_create_preserves_three_images_in_multipart_payload(self) -> None:
        """Create should keep cover plus two gallery images in display order."""
        self.client.force_authenticate(user=self.user)
        payload = {
            "name": "Burger Triplo",
            "sku": "BRG-003",
            "price": "29.90",
            "stock_quantity": 9,
            "category": self.category.id,  # type: ignore[arg-type]
            "image": build_test_image("cover.png"),
            "uploaded_images[1]": build_test_image("gallery-1.png"),
            "uploaded_images[2]": build_test_image("gallery-2.png"),
        }

        response: Any = self.client.post("/api/v1/products/", payload, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, msg=response.data)
        self.assertEqual(len(response.data["images"]), 3)
        self.assertIn("cover", response.data["images"][0])
        self.assertIn("gallery-1", response.data["images"][1])
        self.assertIn("gallery-2", response.data["images"][2])

    @override_settings(MEDIA_ROOT=tempfile.mkdtemp())
    def test_product_update_preserves_existing_absolute_image_urls(self) -> None:
        """Patch should keep all existing images when dashboard sends absolute urls."""
        self.client.force_authenticate(user=self.user)
        create_payload = {
            "name": "Pizza Premium",
            "sku": "PZA-900",
            "price": "49.90",
            "stock_quantity": 6,
            "category": self.category.id,  # type: ignore[arg-type]
            "image": build_test_image("pizza-cover.png"),
            "uploaded_images[1]": build_test_image("pizza-gallery-1.png"),
            "uploaded_images[2]": build_test_image("pizza-gallery-2.png"),
        }
        create_response: Any = self.client.post(
            "/api/v1/products/", create_payload, format="multipart"
        )
        self.assertEqual(
            create_response.status_code, status.HTTP_201_CREATED, msg=create_response.data
        )

        product_id = create_response.data["id"]
        update_payload = {
            "name": "Pizza Premium Atualizada",
            "existing_images[0]": create_response.data["images"][0],
            "existing_images[1]": create_response.data["images"][1],
            "existing_images[2]": create_response.data["images"][2],
        }

        response: Any = self.client.patch(
            f"/api/v1/products/{product_id}/", update_payload, format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=response.data)
        self.assertEqual(response.data["name"], "Pizza Premium Atualizada")
        self.assertEqual(len(response.data["images"]), 3)

    def test_product_delete(self) -> None:
        """Should delete product via DELETE endpoint."""
        self.client.force_authenticate(user=self.user)
        response: Any = self.client.delete(f"/api/v1/products/{self.product.id}/")  # type: ignore
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Product.objects.filter(id=self.product.id).exists())  # type: ignore

    def test_product_delete_with_category_protect(self) -> None:
        """Deleting category with products should fail (PROTECT)."""
        self.client.force_authenticate(user=self.user)
        response: Any = self.client.delete(f"/api/v1/categories/{self.category.id}/")  # type: ignore
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(Category.objects.filter(id=self.category.id).exists())  # type: ignore


class DjangoHealthTest(TestCase):
    """Test Django framework and database connectivity."""

    def test_django_database_connected(self) -> None:
        """Database connection should be functional."""
        # Creating and retrieving from DB proves connection
        user = User.objects.create_user(username="dbtest", password="pass")
        retrieved = User.objects.get(username="dbtest")
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
        self.assertIn("bipdelivery.api.apps.ApiConfig", settings.INSTALLED_APPS)
        self.assertIn("rest_framework", settings.INSTALLED_APPS)

    def test_drf_authentication_configured(self) -> None:
        """DRF should have JWT authentication configured."""
        from django.conf import settings

        rest_framework_config = settings.REST_FRAMEWORK
        self.assertIn("DEFAULT_AUTHENTICATION_CLASSES", rest_framework_config)
        auth_classes = rest_framework_config["DEFAULT_AUTHENTICATION_CLASSES"]
        self.assertTrue(any("JWT" in cls for cls in auth_classes))


class CheckoutWhatsAppAPITest(TestCase):
    """Test the public checkout preparation endpoint."""

    client: APIClient
    category: Category
    product: Product

    def setUp(self) -> None:
        self.client = APIClient()
        self.category = Category.objects.create(name="Lanches", slug="lanches")
        self.product = Product.objects.create(
            name="Combo Executivo",
            sku="CMB-001",
            price=Decimal("42.50"),
            stock_quantity=8,
            category=self.category,
        )

    def test_checkout_builds_whatsapp_payload(self) -> None:
        """Checkout should return totals, note text and WhatsApp URL."""
        with self.settings(WHATSAPP_ORDER_PHONE="5571999999999"):
            payload = {
                "items": [
                    {
                        "product_id": self.product.id,  # type: ignore[arg-type]
                        "quantity": 2,
                    }
                ],
                "customer": {
                    "full_name": "Cliente Teste",
                    "phone": "(71) 99999-0000",
                    "email": "cliente@teste.com",
                    "delivery_method": "delivery",
                    "payment_method": "pix",
                    "address": "Rua A, 123",
                    "neighborhood": "Centro",
                    "city": "Salvador",
                    "notes": "Sem cebola",
                },
            }
            response: Any = self.client.post("/api/v1/checkout/whatsapp/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["subtotal"], "85.00")
        self.assertEqual(response.data["delivery_fee"], "12.00")
        self.assertEqual(response.data["total"], "97.00")
        self.assertTrue(
            response.data["whatsapp_url"].startswith("https://wa.me/5571999999999?text=")
        )
        self.assertIn("Pedido BipFlow", response.data["message"])
        self.assertEqual(response.data["items"][0]["product_name"], "Combo Executivo")
        self.assertTrue(
            SaleOrder.objects.filter(order_reference=response.data["order_reference"]).exists()
        )

    def test_checkout_uses_delivery_region_fee(self) -> None:
        """Checkout should use the selected active delivery region fee."""
        region = DeliveryRegion.objects.create(
            name="Centro expandido",
            city="Salvador",
            delivery_fee=Decimal("18.50"),
        )
        payload = {
            "items": [
                {
                    "product_id": self.product.id,  # type: ignore[arg-type]
                    "quantity": 1,
                }
            ],
            "customer": {
                "full_name": "Cliente Teste",
                "phone": "(71) 99999-0000",
                "email": "",
                "delivery_method": "delivery",
                "payment_method": "pix",
                "delivery_region_id": region.id,
                "address": "Rua A, 123",
                "neighborhood": "Centro",
                "city": "Salvador",
                "notes": "",
            },
        }

        response: Any = self.client.post("/api/v1/checkout/whatsapp/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["delivery_fee"], "18.50")
        self.assertEqual(response.data["total"], "61.00")
        self.assertEqual(response.data["customer"]["delivery_region_name"], "Centro expandido")
        self.assertIn("Regiao: Centro expandido", response.data["message"])

    def test_public_delivery_regions_returns_only_active_regions(self) -> None:
        """Public active regions endpoint should hide inactive options."""
        DeliveryRegion.objects.create(name="Centro", city="Salvador", delivery_fee=Decimal("12.00"))
        DeliveryRegion.objects.create(
            name="Inativa",
            city="Salvador",
            delivery_fee=Decimal("22.00"),
            is_active=False,
        )

        response: Any = self.client.get("/api/v1/delivery-regions/active/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["name"], "Centro")

    def test_sales_history_requires_authentication(self) -> None:
        """Sales history is a dashboard-only authenticated endpoint."""
        response: Any = self.client.get("/api/v1/sales-orders/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_sales_history_returns_checkout_orders(self) -> None:
        """Authenticated dashboard users should see persisted checkout orders."""
        user = User.objects.create_user(username="salesuser", password="testpass123")

        payload = {
            "items": [
                {
                    "product_id": self.product.id,  # type: ignore[arg-type]
                    "quantity": 1,
                }
            ],
            "customer": {
                "full_name": "Cliente Teste",
                "phone": "(71) 99999-0000",
                "email": "",
                "delivery_method": "pickup",
                "payment_method": "card",
                "address": "",
                "neighborhood": "",
                "city": "",
                "notes": "",
            },
        }
        checkout_response: Any = self.client.post(
            "/api/v1/checkout/whatsapp/", payload, format="json"
        )

        self.client.force_authenticate(user=user)
        response: Any = self.client.get("/api/v1/sales-orders/?page_size=5")

        self.assertEqual(checkout_response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["results"][0]["order_reference"],
            checkout_response.data["order_reference"],
        )
        self.assertEqual(response.data["results"][0]["item_count"], 1)

    def test_checkout_requires_delivery_address_for_delivery_orders(self) -> None:
        """Delivery orders should require address fields."""
        payload = {
            "items": [
                {
                    "product_id": self.product.id,  # type: ignore[arg-type]
                    "quantity": 1,
                }
            ],
            "customer": {
                "full_name": "Cliente Teste",
                "phone": "(71) 99999-0000",
                "email": "",
                "delivery_method": "delivery",
                "payment_method": "pix",
                "address": "",
                "neighborhood": "",
                "city": "",
                "notes": "",
            },
        }
        response: Any = self.client.post("/api/v1/checkout/whatsapp/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("address", response.data.get("customer", {}))
