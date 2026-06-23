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
from datetime import timedelta
from decimal import Decimal
from io import BytesIO, StringIO
from pathlib import Path
from typing import Any
from uuid import uuid4

import django
import pytest
from django.contrib.auth.models import Group, User
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command, CommandError
from django.test import TestCase
from django.test.utils import override_settings
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient

# Configure Django before importing models (required for app initialization)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "bipdelivery.core.settings")
django.setup()

from bipdelivery.api.models import (  # noqa: E402
    BotConversation,
    Category,
    DeliveryRegion,
    Product,
    SaleOrder,
    SaleOrderItem,
    Store,
    StoreSettings,
)

pytestmark = pytest.mark.django_db

TEST_TEMP_ROOT = Path(__file__).resolve().parents[2] / ".codex-tmp" / "django-test-media"
TEST_TEMP_ROOT.mkdir(parents=True, exist_ok=True)


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


def build_test_media_root() -> str:
    """Create a writable media root for upload tests on Windows sandboxes."""
    media_root = TEST_TEMP_ROOT / f"media-{uuid4().hex}"
    media_root.mkdir(parents=True)
    return str(media_root)


class CurrentUserAPITest(TestCase):
    """Test authenticated user summary endpoint."""

    client: APIClient
    user: User

    def setUp(self) -> None:
        """Initialize test client and authenticated user data."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="ednaldo@example.com",
            email="ednaldo@example.com",
            password="testpass123",
            first_name="Ednaldo",
            last_name="Aquino",
        )

    def test_current_user_requires_authentication(self) -> None:
        """Current user endpoint should be available only to authenticated users."""
        response: Any = self.client.get("/api/auth/me/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_current_user_returns_display_name(self) -> None:
        """Current user endpoint should expose a human-friendly display name."""
        self.client.force_authenticate(user=self.user)

        response: Any = self.client.get("/api/auth/me/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], "ednaldo@example.com")
        self.assertEqual(response.data["display_name"], "Ednaldo Aquino")
        self.assertFalse(response.data["can_access_dashboard"])
        self.assertFalse(response.data["can_manage_catalog"])

    def test_current_user_exposes_dashboard_role_capabilities(self) -> None:
        """Current user endpoint should expose dashboard RBAC capabilities."""
        self.user.is_staff = True
        self.user.save(update_fields=["is_staff"])
        self.client.force_authenticate(user=self.user)

        response: Any = self.client.get("/api/auth/me/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["can_access_dashboard"])
        self.assertTrue(response.data["can_manage_catalog"])
        self.assertIn("staff", response.data["roles"])


class CategoryAPIHealthTest(TestCase):
    """Test Category endpoints are functioning."""

    client: APIClient
    user: User
    category: Category

    def setUp(self) -> None:
        """Initialize test client and create test data."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
            is_staff=True,
        )
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
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
            is_staff=True,
        )
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

    def test_regular_authenticated_user_cannot_create_product(self) -> None:
        """Registered non-staff users should not receive catalog write access."""
        regular_user = User.objects.create_user(username="regular", password="testpass123")
        self.client.force_authenticate(user=regular_user)
        payload = {
            "name": "Blocked Product",
            "sku": "BLK-001",
            "price": "19.99",
            "stock_quantity": 2,
            "category": self.category.id,  # type: ignore[arg-type]
        }

        response: Any = self.client.post("/api/v1/products/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Product.objects.filter(sku="BLK-001").exists())

    def test_manager_group_user_can_create_product(self) -> None:
        """Manager group members should be able to mutate catalog resources."""
        manager_group = Group.objects.create(name="manager")
        manager_user = User.objects.create_user(username="manager", password="testpass123")
        manager_user.groups.add(manager_group)
        self.client.force_authenticate(user=manager_user)
        payload = {
            "name": "Manager Product",
            "sku": "MGR-001",
            "price": "39.99",
            "stock_quantity": 5,
            "category": self.category.id,  # type: ignore[arg-type]
        }

        response: Any = self.client.post("/api/v1/products/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["sku"], "MGR-001")

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

    @override_settings(MEDIA_ROOT=build_test_media_root())
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

    @override_settings(MEDIA_ROOT=build_test_media_root())
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


class DashboardRoleSeedCommandTest(TestCase):
    """Test reproducible dashboard RBAC bootstrapping."""

    def test_seed_dashboard_roles_creates_expected_groups(self) -> None:
        """Management command should create the canonical dashboard groups."""
        call_command("seed_dashboard_roles", stdout=StringIO())

        self.assertTrue(Group.objects.filter(name="admin").exists())
        self.assertTrue(Group.objects.filter(name="manager").exists())
        self.assertTrue(Group.objects.filter(name="viewer").exists())

    def test_seed_dashboard_roles_can_create_staff_admin_user(self) -> None:
        """Management command should provision the Cypress-compatible admin user."""
        call_command(
            "seed_dashboard_roles",
            email="admin@example.com",
            password="admin123",
            role="admin",
            staff=True,
            stdout=StringIO(),
        )

        user = User.objects.get(email="admin@example.com")
        self.assertTrue(user.is_active)
        self.assertTrue(user.is_staff)
        self.assertTrue(user.check_password("admin123"))
        self.assertTrue(user.groups.filter(name="admin").exists())


class StoreSettingsAPITest(TestCase):
    """Test dashboard-owned store settings endpoint."""

    client: APIClient
    user: User

    def setUp(self) -> None:
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="settingsuser",
            password="testpass123",
            is_staff=True,
        )

    def test_store_settings_requires_authentication(self) -> None:
        """Store settings should be private to dashboard users."""
        response: Any = self.client.get("/api/v1/store-settings/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_public_store_settings_exposes_only_catalog_contact(self) -> None:
        """Public catalog should read the configured WhatsApp without private metadata."""
        StoreSettings.objects.create(whatsapp_phone="5571999999999")

        response: Any = self.client.get("/api/v1/store-settings/public/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["whatsapp_phone_digits"], "5571999999999")
        self.assertTrue(response.data["is_whatsapp_configured"])
        self.assertNotIn("id", response.data)
        self.assertNotIn("created_at", response.data)
        self.assertNotIn("updated_at", response.data)

    def test_public_store_settings_does_not_create_empty_settings_row(self) -> None:
        """Anonymous catalog reads should not mutate settings storage."""
        response: Any = self.client.get("/api/v1/store-settings/public/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["whatsapp_phone_digits"], "")
        self.assertFalse(response.data["is_whatsapp_configured"])
        self.assertEqual(StoreSettings.objects.count(), 0)

    def test_dashboard_user_can_update_store_whatsapp(self) -> None:
        """Dashboard writers should be able to persist the store WhatsApp number."""
        self.client.force_authenticate(user=self.user)

        response: Any = self.client.patch(
            "/api/v1/store-settings/",
            {"whatsapp_phone": "+55 (71) 99999-9999"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=response.data)
        self.assertEqual(response.data["whatsapp_phone"], "5571999999999")
        self.assertEqual(response.data["whatsapp_phone_digits"], "5571999999999")
        self.assertTrue(response.data["is_whatsapp_configured"])
        self.assertEqual(StoreSettings.get_solo().whatsapp_phone, "5571999999999")
        self.assertEqual(Store.get_default().whatsapp_phone, "5571999999999")

    def test_regular_user_cannot_update_store_settings(self) -> None:
        """Regular authenticated users should not mutate operational settings."""
        regular_user = User.objects.create_user(username="regularsettings", password="testpass123")
        self.client.force_authenticate(user=regular_user)

        response: Any = self.client.patch(
            "/api/v1/store-settings/",
            {"whatsapp_phone": "5571999999999"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(StoreSettings.objects.count(), 0)


class GoLiveReadinessCommandTest(TestCase):
    """Validate the executable production readiness checklist."""

    go_live_settings = {
        "DEBUG": False,
        "ALLOWED_HOSTS": ["shop.example.com"],
        "CSRF_TRUSTED_ORIGINS": ["https://shop.example.com"],
        "CORS_ALLOWED_ORIGINS": ["https://shop.example.com"],
        "IS_PRODUCTION": False,
    }

    @override_settings(**go_live_settings)
    def test_go_live_readiness_passes_with_operational_setup(self) -> None:
        """Readiness command should pass when the storefront can receive orders."""
        User.objects.create_user(
            username="operator@example.com",
            email="operator@example.com",
            password="testpass123",
            is_staff=True,
        )
        category = Category.objects.create(name="Prontos", slug="prontos")
        Product.objects.create(
            name="Produto pronto",
            sku="READY-001",
            price=Decimal("19.90"),
            stock_quantity=5,
            category=category,
        )
        DeliveryRegion.objects.create(
            name="Centro",
            city="Salvador",
            delivery_fee=Decimal("12.00"),
        )
        StoreSettings.objects.create(whatsapp_phone="5571999999999")
        output = StringIO()

        call_command("check_go_live_readiness", stdout=output)

        self.assertIn("Go-live readiness checks passed.", output.getvalue())

    @override_settings(**go_live_settings)
    def test_go_live_readiness_fails_without_catalog_and_operator(self) -> None:
        """Readiness command should fail closed when operational data is missing."""
        output = StringIO()

        with self.assertRaises(CommandError):
            call_command("check_go_live_readiness", stdout=output)

        self.assertIn("dashboard_operator", output.getvalue())
        self.assertIn("catalog", output.getvalue())


class CheckoutWhatsAppAPITest(TestCase):
    """Test the public checkout preparation endpoint."""

    client: APIClient
    category: Category
    product: Product

    def setUp(self) -> None:
        cache.clear()
        self.client = APIClient()
        self.category = Category.objects.create(name="Lanches", slug="lanches")
        self.product = Product.objects.create(
            name="Combo Executivo",
            sku="CMB-001",
            price=Decimal("42.50"),
            stock_quantity=8,
            category=self.category,
        )

    def _build_pickup_payload(self, items: list[dict[str, int]]) -> dict[str, Any]:
        return {
            "items": items,
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
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 6)
        self.assertTrue(self.product.is_available)

    def test_checkout_links_a_bot_conversation_to_the_resulting_order(self) -> None:
        """A bot_session_id on checkout should mark that conversation as converted."""
        bot_response: Any = self.client.post("/api/v1/bot/messages/", {"message": "Oi"}, format="json")
        session_id = bot_response.data["session_id"]

        payload = self._build_pickup_payload([{"product_id": self.product.id, "quantity": 1}])
        payload["bot_session_id"] = session_id

        response: Any = self.client.post("/api/v1/checkout/whatsapp/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        conversation = BotConversation.objects.get(session_id=session_id)
        self.assertIsNotNone(conversation.sale_order)
        self.assertEqual(conversation.sale_order.order_reference, response.data["order_reference"])

    def test_checkout_without_a_bot_session_id_leaves_conversations_unlinked(self) -> None:
        """Checkout should still work for customers who never used the bot."""
        bot_response: Any = self.client.post("/api/v1/bot/messages/", {"message": "Oi"}, format="json")
        session_id = bot_response.data["session_id"]

        payload = self._build_pickup_payload([{"product_id": self.product.id, "quantity": 1}])

        response: Any = self.client.post("/api/v1/checkout/whatsapp/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        conversation = BotConversation.objects.get(session_id=session_id)
        self.assertIsNone(conversation.sale_order)

    def test_checkout_ignores_a_bot_session_id_from_another_store(self) -> None:
        """A session id from a different tenant must never be linked across stores."""
        other_store = Store.objects.create(name="Outra loja", slug="outra-loja-checkout")
        bot_client = APIClient()
        bot_response: Any = bot_client.post(
            "/api/v1/bot/messages/",
            {"message": "Oi"},
            format="json",
            HTTP_X_STORE_SLUG=other_store.slug,
        )
        session_id = bot_response.data["session_id"]

        payload = self._build_pickup_payload([{"product_id": self.product.id, "quantity": 1}])
        payload["bot_session_id"] = session_id

        response: Any = self.client.post("/api/v1/checkout/whatsapp/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        conversation = BotConversation.objects.get(session_id=session_id)
        self.assertIsNone(conversation.sale_order)

    def test_checkout_uses_dashboard_whatsapp_before_env_fallback(self) -> None:
        """Checkout should redirect to the WhatsApp configured for the store.

        Etapa 3: CheckoutWhatsAppView reads `request.store.whatsapp_phone`,
        not the StoreSettings singleton directly -- this is what
        StoreSettingsView.patch() keeps in sync today (see
        test_dashboard_user_can_update_store_whatsapp).
        """
        Store.objects.filter(id=Store.get_default().id).update(whatsapp_phone="5588999999999")
        payload = self._build_pickup_payload(
            [
                {
                    "product_id": self.product.id,  # type: ignore[arg-type]
                    "quantity": 1,
                }
            ]
        )

        with self.settings(WHATSAPP_ORDER_PHONE="5571000000000"):
            response: Any = self.client.post(
                "/api/v1/checkout/whatsapp/",
                payload,
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            response.data["whatsapp_url"].startswith("https://wa.me/5588999999999?text=")
        )

    def test_checkout_marks_product_unavailable_when_stock_is_consumed(self) -> None:
        """Checkout should reserve stock and update availability when stock reaches zero."""
        payload = self._build_pickup_payload(
            [
                {
                    "product_id": self.product.id,  # type: ignore[arg-type]
                    "quantity": 8,
                }
            ]
        )

        response: Any = self.client.post("/api/v1/checkout/whatsapp/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 0)
        self.assertFalse(self.product.is_available)

    def test_checkout_merges_duplicate_product_lines_before_reserving_stock(self) -> None:
        """Duplicate cart lines should become one reserved quantity for the product."""
        payload = self._build_pickup_payload(
            [
                {
                    "product_id": self.product.id,  # type: ignore[arg-type]
                    "quantity": 2,
                },
                {
                    "product_id": self.product.id,  # type: ignore[arg-type]
                    "quantity": 3,
                },
            ]
        )

        response: Any = self.client.post("/api/v1/checkout/whatsapp/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["items"][0]["quantity"], 5)
        self.assertEqual(response.data["subtotal"], "212.50")
        self.assertEqual(len(response.data["items"]), 1)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 3)

        order = SaleOrder.objects.get(order_reference=response.data["order_reference"])
        self.assertEqual(order.items.get().quantity, 5)

    def test_checkout_rejects_duplicate_lines_when_aggregated_quantity_exceeds_stock(
        self,
    ) -> None:
        """Aggregated duplicate quantities should not bypass stock validation."""
        payload = self._build_pickup_payload(
            [
                {
                    "product_id": self.product.id,  # type: ignore[arg-type]
                    "quantity": 5,
                },
                {
                    "product_id": self.product.id,  # type: ignore[arg-type]
                    "quantity": 4,
                },
            ]
        )

        response: Any = self.client.post("/api/v1/checkout/whatsapp/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 8)
        self.assertFalse(SaleOrder.objects.exists())

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

    def test_delivery_region_list_hides_inactive_for_anonymous_users(self) -> None:
        """Public delivery region list should not expose inactive regions."""
        DeliveryRegion.objects.create(name="Centro", city="Salvador", delivery_fee=Decimal("12.00"))
        DeliveryRegion.objects.create(
            name="Inativa",
            city="Salvador",
            delivery_fee=Decimal("22.00"),
            is_active=False,
        )

        response: Any = self.client.get("/api/v1/delivery-regions/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["name"], "Centro")

    def test_delivery_region_list_hides_inactive_for_regular_authenticated_users(self) -> None:
        """Authenticated users without dashboard role should only see active regions."""
        user = User.objects.create_user(username="regularregion", password="testpass123")
        DeliveryRegion.objects.create(name="Centro", city="Salvador", delivery_fee=Decimal("12.00"))
        DeliveryRegion.objects.create(
            name="Inativa",
            city="Salvador",
            delivery_fee=Decimal("22.00"),
            is_active=False,
        )

        self.client.force_authenticate(user=user)
        response: Any = self.client.get("/api/v1/delivery-regions/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["name"], "Centro")

    def test_delivery_region_list_exposes_inactive_for_dashboard_users(self) -> None:
        """Dashboard users should see active and inactive delivery regions."""
        user = User.objects.create_user(
            username="dashboardregion",
            password="testpass123",
            is_staff=True,
        )
        DeliveryRegion.objects.create(name="Centro", city="Salvador", delivery_fee=Decimal("12.00"))
        DeliveryRegion.objects.create(
            name="Inativa",
            city="Salvador",
            delivery_fee=Decimal("22.00"),
            is_active=False,
        )

        self.client.force_authenticate(user=user)
        response: Any = self.client.get("/api/v1/delivery-regions/")

        region_names = {region["name"] for region in response.data["results"]}
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)
        self.assertSetEqual(region_names, {"Centro", "Inativa"})

    def test_regular_authenticated_user_cannot_create_delivery_region(self) -> None:
        """Registered non-dashboard users should not mutate freight rules."""
        user = User.objects.create_user(username="regularfreight", password="testpass123")
        self.client.force_authenticate(user=user)
        payload = {
            "name": "Bloqueada",
            "city": "Salvador",
            "delivery_fee": "30.00",
            "is_active": True,
        }

        response: Any = self.client.post("/api/v1/delivery-regions/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(DeliveryRegion.objects.filter(name="Bloqueada").exists())

    def test_sales_history_requires_authentication(self) -> None:
        """Sales history is a dashboard-only authenticated endpoint."""
        response: Any = self.client.get("/api/v1/sales-orders/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_sales_history_denies_regular_authenticated_users(self) -> None:
        """Registered users without a dashboard role should not see private sales data."""
        user = User.objects.create_user(username="regularsales", password="testpass123")
        self.client.force_authenticate(user=user)

        response: Any = self.client.get("/api/v1/sales-orders/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_authenticated_sales_history_returns_checkout_orders(self) -> None:
        """Authenticated dashboard users should see persisted checkout orders."""
        user = User.objects.create_user(
            username="salesuser",
            password="testpass123",
            is_staff=True,
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

    def test_dashboard_writer_can_update_sale_order_status(self) -> None:
        """Dashboard operators should move orders through operational states."""
        user = User.objects.create_user(
            username="saleswriter",
            password="testpass123",
            is_staff=True,
        )
        order = SaleOrder.objects.create(
            order_reference=f"BPF-{uuid4().hex[:8].upper()}",
            customer_name="Cliente Teste",
            customer_phone="71999990000",
            delivery_method="pickup",
            payment_method="pix",
            subtotal=Decimal("42.50"),
            delivery_fee=Decimal("0.00"),
            total=Decimal("42.50"),
        )

        self.client.force_authenticate(user=user)
        response: Any = self.client.patch(
            f"/api/v1/sales-orders/{order.id}/status/",
            {"status": "sent"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "sent")
        order.refresh_from_db()
        self.assertEqual(order.status, "sent")

    def test_dashboard_reader_cannot_update_sale_order_status(self) -> None:
        """Read-only dashboard users can inspect orders but cannot mutate them."""
        viewer_group, _ = Group.objects.get_or_create(name="viewer")
        user = User.objects.create_user(username="salesviewer", password="testpass123")
        user.groups.add(viewer_group)
        order = SaleOrder.objects.create(
            order_reference=f"BPF-{uuid4().hex[:8].upper()}",
            customer_name="Cliente Teste",
            customer_phone="71999990000",
            delivery_method="pickup",
            payment_method="pix",
            subtotal=Decimal("42.50"),
            delivery_fee=Decimal("0.00"),
            total=Decimal("42.50"),
        )

        self.client.force_authenticate(user=user)
        response: Any = self.client.patch(
            f"/api/v1/sales-orders/{order.id}/status/",
            {"status": "cancelled"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        order.refresh_from_db()
        self.assertEqual(order.status, SaleOrder.STATUS_PREPARED)

    def test_sale_order_status_update_rejects_invalid_status(self) -> None:
        """Status updates should stay inside the explicit order workflow."""
        user = User.objects.create_user(
            username="salesinvalid",
            password="testpass123",
            is_staff=True,
        )
        order = SaleOrder.objects.create(
            order_reference=f"BPF-{uuid4().hex[:8].upper()}",
            customer_name="Cliente Teste",
            customer_phone="71999990000",
            delivery_method="pickup",
            payment_method="pix",
            subtotal=Decimal("42.50"),
            delivery_fee=Decimal("0.00"),
            total=Decimal("42.50"),
        )

        self.client.force_authenticate(user=user)
        response: Any = self.client.patch(
            f"/api/v1/sales-orders/{order.id}/status/",
            {"status": "shipped"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        order.refresh_from_db()
        self.assertEqual(order.status, SaleOrder.STATUS_PREPARED)

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


class SaleOrderSummaryAPITest(TestCase):
    """Real sales revenue aggregation backing the dashboard's revenue card."""

    def setUp(self) -> None:
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="salessummary", password="testpass123", is_staff=True
        )
        self.client.force_authenticate(user=self.user)

    def _make_order(self, total: Decimal, days_ago: int, order_status: str = "prepared") -> SaleOrder:
        order = SaleOrder.objects.create(
            order_reference=f"BPF-{uuid4().hex[:8].upper()}",
            customer_name="Cliente Teste",
            customer_phone="71999990000",
            delivery_method="pickup",
            payment_method="pix",
            subtotal=total,
            delivery_fee=Decimal("0.00"),
            total=total,
            status=order_status,
        )
        SaleOrder.objects.filter(pk=order.pk).update(
            created_at=timezone.now() - timedelta(days=days_ago)
        )
        return order

    def test_summary_aggregates_revenue_orders_and_average_ticket(self) -> None:
        """Revenue, order count and average ticket should reflect real sales, not stock."""
        self._make_order(Decimal("50.00"), days_ago=1)
        self._make_order(Decimal("30.00"), days_ago=2)

        response: Any = self.client.get("/api/v1/sales-orders/summary/?period=7d")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["orders_count"], 2)
        self.assertEqual(response.data["revenue_total"], "80.00")
        self.assertEqual(response.data["average_ticket"], "40.00")

    def test_summary_excludes_cancelled_orders(self) -> None:
        """Cancelled orders never reached the customer and should not count as revenue."""
        self._make_order(Decimal("50.00"), days_ago=1)
        self._make_order(Decimal("999.00"), days_ago=1, order_status="cancelled")

        response: Any = self.client.get("/api/v1/sales-orders/summary/?period=7d")

        self.assertEqual(response.data["orders_count"], 1)
        self.assertEqual(response.data["revenue_total"], "50.00")

    def test_summary_compares_against_previous_period(self) -> None:
        """The comparison field is a % change against the immediately preceding window."""
        self._make_order(Decimal("100.00"), days_ago=1)
        self._make_order(Decimal("50.00"), days_ago=10)

        response: Any = self.client.get("/api/v1/sales-orders/summary/?period=7d")

        self.assertEqual(response.data["revenue_total"], "100.00")
        self.assertEqual(response.data["comparison_previous_period"], "100.00")

    def test_summary_compares_against_same_period_last_year(self) -> None:
        """A second comparison field measures growth against the same window, one year back."""
        self._make_order(Decimal("100.00"), days_ago=5)
        self._make_order(Decimal("50.00"), days_ago=380)

        response: Any = self.client.get("/api/v1/sales-orders/summary/?period=30d")

        self.assertEqual(response.data["revenue_total"], "100.00")
        self.assertEqual(response.data["comparison_same_period_last_year"], "100.00")

    def test_summary_unknown_period_falls_back_to_30d(self) -> None:
        """An invalid period query param should not error out the dashboard."""
        response: Any = self.client.get("/api/v1/sales-orders/summary/?period=invalid")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["period"], "30d")

    def test_summary_requires_dashboard_read_role(self) -> None:
        """Registered users without a dashboard role should not see revenue data."""
        viewer = User.objects.create_user(username="summaryregular", password="testpass123")
        client = APIClient()
        client.force_authenticate(user=viewer)

        response: Any = client.get("/api/v1/sales-orders/summary/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class SaleOrderTimeseriesAPITest(TestCase):
    """Daily revenue/order points backing the dashboard's trend chart."""

    def setUp(self) -> None:
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="salestimeseries", password="testpass123", is_staff=True
        )
        self.client.force_authenticate(user=self.user)

    def _make_order(self, total: Decimal, days_ago: int, order_status: str = "prepared") -> SaleOrder:
        order = SaleOrder.objects.create(
            order_reference=f"BPF-{uuid4().hex[:8].upper()}",
            customer_name="Cliente Teste",
            customer_phone="71999990000",
            delivery_method="pickup",
            payment_method="pix",
            subtotal=total,
            delivery_fee=Decimal("0.00"),
            total=total,
            status=order_status,
        )
        SaleOrder.objects.filter(pk=order.pk).update(
            created_at=timezone.now() - timedelta(days=days_ago)
        )
        return order

    def test_timeseries_returns_one_point_per_day_with_zero_filled_gaps(self) -> None:
        """Days with no sales must still appear as zero-revenue points, not gaps."""
        self._make_order(Decimal("50.00"), days_ago=0)
        self._make_order(Decimal("30.00"), days_ago=2)

        response: Any = self.client.get("/api/v1/sales-orders/timeseries/?period=7d")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 7)
        revenue_by_date = {point["date"]: point["revenue"] for point in response.data}
        today_local = timezone.localtime(timezone.now()).date()
        self.assertEqual(revenue_by_date[today_local.isoformat()], "50.00")
        self.assertEqual(revenue_by_date[(today_local - timedelta(days=2)).isoformat()], "30.00")
        self.assertEqual(revenue_by_date[(today_local - timedelta(days=1)).isoformat()], "0.00")

    def test_timeseries_excludes_cancelled_orders(self) -> None:
        """A cancelled order's total should not inflate the trend chart."""
        self._make_order(Decimal("999.00"), days_ago=0, order_status="cancelled")

        response: Any = self.client.get("/api/v1/sales-orders/timeseries/?period=7d")

        today_local = timezone.localtime(timezone.now()).date()
        revenue_by_date = {point["date"]: point["revenue"] for point in response.data}
        self.assertEqual(revenue_by_date[today_local.isoformat()], "0.00")

    def test_timeseries_unknown_period_falls_back_to_30d(self) -> None:
        """An invalid period query param should not error out the dashboard."""
        response: Any = self.client.get("/api/v1/sales-orders/timeseries/?period=invalid")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 30)


class SaleOrderBreakdownAPITest(TestCase):
    """Top products, payment method and status breakdown for the dashboard."""

    def setUp(self) -> None:
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="salesbreakdown", password="testpass123", is_staff=True
        )
        self.client.force_authenticate(user=self.user)
        self.category = Category.objects.create(name="Lanches")
        self.product = Product.objects.create(
            name="Combo Executivo",
            sku="CMB-BRK",
            price=Decimal("25.00"),
            stock_quantity=20,
            category=self.category,
        )

    def _make_order(
        self,
        total: Decimal,
        days_ago: int = 0,
        order_status: str = "prepared",
        payment_method: str = "pix",
        delivery_method: str = "pickup",
        delivery_region_name: str = "",
    ) -> SaleOrder:
        order = SaleOrder.objects.create(
            order_reference=f"BPF-{uuid4().hex[:8].upper()}",
            customer_name="Cliente Teste",
            customer_phone="71999990000",
            delivery_method=delivery_method,
            delivery_region_name=delivery_region_name,
            payment_method=payment_method,
            subtotal=total,
            delivery_fee=Decimal("0.00"),
            total=total,
            status=order_status,
        )
        SaleOrder.objects.filter(pk=order.pk).update(
            created_at=timezone.now() - timedelta(days=days_ago)
        )
        return order

    def test_breakdown_ranks_top_products_by_revenue(self) -> None:
        """The best seller by revenue should be first, with quantity and revenue summed."""
        order = self._make_order(Decimal("50.00"))
        SaleOrderItem.objects.create(
            order=order,
            product=self.product,
            product_name=self.product.name,
            sku=self.product.sku,
            quantity=2,
            unit_price=Decimal("25.00"),
            line_total=Decimal("50.00"),
        )

        response: Any = self.client.get("/api/v1/sales-orders/breakdown/?period=30d")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        top_products = response.data["top_products"]
        self.assertEqual(len(top_products), 1)
        self.assertEqual(top_products[0]["product_name"], "Combo Executivo")
        self.assertEqual(top_products[0]["quantity_total"], 2)
        self.assertEqual(top_products[0]["revenue_total"], "50.00")

    def test_breakdown_groups_revenue_by_payment_method(self) -> None:
        """Active orders should be grouped by how the customer paid."""
        self._make_order(Decimal("40.00"), payment_method="pix")
        self._make_order(Decimal("60.00"), payment_method="card")
        self._make_order(Decimal("999.00"), payment_method="cash", order_status="cancelled")

        response: Any = self.client.get("/api/v1/sales-orders/breakdown/?period=30d")

        by_payment_method = {
            row["payment_method"]: row["revenue_total"] for row in response.data["by_payment_method"]
        }
        self.assertEqual(by_payment_method, {"card": "60.00", "pix": "40.00"})

    def test_breakdown_includes_cancelled_orders_in_status_distribution(self) -> None:
        """Status distribution is the one place cancelled orders should still count."""
        self._make_order(Decimal("40.00"), order_status="prepared")
        self._make_order(Decimal("999.00"), order_status="cancelled")

        response: Any = self.client.get("/api/v1/sales-orders/breakdown/?period=30d")

        by_status = {row["status"]: row["orders_count"] for row in response.data["by_status"]}
        self.assertEqual(by_status, {"prepared": 1, "cancelled": 1})

    def test_breakdown_groups_revenue_by_delivery_region(self) -> None:
        """Pickup orders, named regions and unnamed deliveries each bucket separately."""
        self._make_order(Decimal("30.00"), delivery_method="pickup")
        self._make_order(Decimal("50.00"), delivery_method="delivery", delivery_region_name="Centro")
        self._make_order(Decimal("20.00"), delivery_method="delivery", delivery_region_name="")

        response: Any = self.client.get("/api/v1/sales-orders/breakdown/?period=30d")

        by_region = {row["region"]: row["revenue_total"] for row in response.data["by_region"]}
        self.assertEqual(
            by_region,
            {"Retirada na loja": "30.00", "Centro": "50.00", "Sem regiao": "20.00"},
        )

    def test_breakdown_unknown_period_falls_back_to_30d(self) -> None:
        """An invalid period query param should not error out the dashboard."""
        response: Any = self.client.get("/api/v1/sales-orders/breakdown/?period=invalid")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["period"], "30d")

    def test_breakdown_accepts_90d_to_match_the_trend_chart_period_switcher(self) -> None:
        """The dashboard's period switcher offers 7d/30d/90d for both endpoints."""
        self._make_order(Decimal("40.00"), days_ago=45)

        response: Any = self.client.get("/api/v1/sales-orders/breakdown/?period=90d")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["period"], "90d")
        by_status = {row["status"]: row["orders_count"] for row in response.data["by_status"]}
        self.assertEqual(by_status, {"prepared": 1})


class SaleOrderAggregateCacheTest(TestCase):
    """Dashboard aggregate endpoints cache briefly, scoped per store."""

    def setUp(self) -> None:
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="salescache", password="testpass123", is_staff=True
        )
        self.client.force_authenticate(user=self.user)

    def _make_order(self, total: Decimal) -> SaleOrder:
        return SaleOrder.objects.create(
            order_reference=f"BPF-{uuid4().hex[:8].upper()}",
            customer_name="Cliente Teste",
            customer_phone="71999990000",
            delivery_method="pickup",
            payment_method="pix",
            subtotal=total,
            delivery_fee=Decimal("0.00"),
            total=total,
        )

    def test_summary_response_is_cached_between_identical_requests(self) -> None:
        """Two requests with no write in between must reuse the cached value."""
        self._make_order(Decimal("50.00"))
        first: Any = self.client.get("/api/v1/sales-orders/summary/?period=30d")
        self.assertEqual(first.data["revenue_total"], "50.00")

        second: Any = self.client.get("/api/v1/sales-orders/summary/?period=30d")
        self.assertEqual(second.data["revenue_total"], "50.00")

    def test_new_order_invalidates_the_cached_summary(self) -> None:
        """A new SaleOrder must bust the cache so the dashboard never serves stale revenue."""
        self._make_order(Decimal("50.00"))
        first: Any = self.client.get("/api/v1/sales-orders/summary/?period=30d")
        self.assertEqual(first.data["revenue_total"], "50.00")

        self._make_order(Decimal("100.00"))
        second: Any = self.client.get("/api/v1/sales-orders/summary/?period=30d")
        self.assertEqual(second.data["revenue_total"], "150.00")

    def test_status_update_invalidates_the_cached_summary(self) -> None:
        """Cancelling an order must immediately drop it out of the cached revenue total."""
        order = self._make_order(Decimal("50.00"))
        first: Any = self.client.get("/api/v1/sales-orders/summary/?period=30d")
        self.assertEqual(first.data["revenue_total"], "50.00")

        response: Any = self.client.patch(
            f"/api/v1/sales-orders/{order.id}/status/",  # type: ignore
            {"status": "cancelled"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        second: Any = self.client.get("/api/v1/sales-orders/summary/?period=30d")
        self.assertEqual(second.data["revenue_total"], "0.00")

    def test_cached_summary_does_not_leak_across_stores(self) -> None:
        """Two different stores must never share a cached aggregate, even by coincidence."""
        self._make_order(Decimal("50.00"))
        self.client.get("/api/v1/sales-orders/summary/?period=30d")

        other_store = Store.objects.create(name="Outra Loja", slug="outra-loja")
        other_user = User.objects.create_user(
            username="salescacheother", password="testpass123", is_staff=True
        )
        other_client = APIClient()
        other_client.force_authenticate(user=other_user, token={"store_id": other_store.id})

        response: Any = other_client.get("/api/v1/sales-orders/summary/?period=30d")
        self.assertEqual(response.data["revenue_total"], "0.00")


class SaleOrderCustomRangeAPITest(TestCase):
    """An explicit ?start=&end= range overrides the period shorthand on all three endpoints."""

    def setUp(self) -> None:
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="salescustomrange", password="testpass123", is_staff=True
        )
        self.client.force_authenticate(user=self.user)

    def _make_order(self, total: Decimal, days_ago: int) -> SaleOrder:
        order = SaleOrder.objects.create(
            order_reference=f"BPF-{uuid4().hex[:8].upper()}",
            customer_name="Cliente Teste",
            customer_phone="71999990000",
            delivery_method="pickup",
            payment_method="pix",
            subtotal=total,
            delivery_fee=Decimal("0.00"),
            total=total,
        )
        SaleOrder.objects.filter(pk=order.pk).update(
            created_at=timezone.now() - timedelta(days=days_ago)
        )
        return order

    def _date_str(self, days_ago: int) -> str:
        return (timezone.localtime(timezone.now()) - timedelta(days=days_ago)).date().isoformat()

    def test_summary_uses_custom_range_instead_of_period(self) -> None:
        self._make_order(Decimal("40.00"), days_ago=10)
        self._make_order(Decimal("999.00"), days_ago=40)

        response: Any = self.client.get(
            f"/api/v1/sales-orders/summary/?start={self._date_str(15)}&end={self._date_str(5)}"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["period"], "custom")
        self.assertEqual(response.data["revenue_total"], "40.00")

    def test_timeseries_uses_custom_range_instead_of_period(self) -> None:
        self._make_order(Decimal("40.00"), days_ago=10)

        response: Any = self.client.get(
            f"/api/v1/sales-orders/timeseries/?start={self._date_str(15)}&end={self._date_str(5)}"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 11)
        revenue_by_date = {point["date"]: point["revenue"] for point in response.data}
        self.assertEqual(revenue_by_date[self._date_str(10)], "40.00")

    def test_breakdown_uses_custom_range_instead_of_period(self) -> None:
        self._make_order(Decimal("40.00"), days_ago=10)

        response: Any = self.client.get(
            f"/api/v1/sales-orders/breakdown/?start={self._date_str(15)}&end={self._date_str(5)}"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["period"], "custom")
        by_status = {row["status"]: row["orders_count"] for row in response.data["by_status"]}
        self.assertEqual(by_status, {"prepared": 1})

    def test_invalid_custom_range_falls_back_to_default_period(self) -> None:
        response: Any = self.client.get(
            "/api/v1/sales-orders/summary/?start=not-a-date&end=also-not-a-date"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["period"], "30d")

    def test_start_after_end_falls_back_to_default_period(self) -> None:
        response: Any = self.client.get(
            f"/api/v1/sales-orders/summary/?start={self._date_str(5)}&end={self._date_str(15)}"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["period"], "30d")

    def test_custom_ranges_do_not_share_a_cache_entry(self) -> None:
        """A different start/end must never reuse another range's cached aggregate."""
        self._make_order(Decimal("40.00"), days_ago=10)

        first: Any = self.client.get(
            f"/api/v1/sales-orders/summary/?start={self._date_str(15)}&end={self._date_str(5)}"
        )
        second: Any = self.client.get(
            f"/api/v1/sales-orders/summary/?start={self._date_str(45)}&end={self._date_str(35)}"
        )

        self.assertEqual(first.data["revenue_total"], "40.00")
        self.assertEqual(second.data["revenue_total"], "0.00")


class SaleOrderCustomerInsightsAPITest(TestCase):
    """Bot-to-sale conversion rate and new-vs-returning customer mix."""

    def setUp(self) -> None:
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="salescustomers", password="testpass123", is_staff=True
        )
        self.client.force_authenticate(user=self.user)

    def _make_order(self, customer_phone: str, days_ago: int = 0) -> SaleOrder:
        order = SaleOrder.objects.create(
            order_reference=f"BPF-{uuid4().hex[:8].upper()}",
            customer_name="Cliente Teste",
            customer_phone=customer_phone,
            delivery_method="pickup",
            payment_method="pix",
            subtotal=Decimal("10.00"),
            delivery_fee=Decimal("0.00"),
            total=Decimal("10.00"),
        )
        SaleOrder.objects.filter(pk=order.pk).update(
            created_at=timezone.now() - timedelta(days=days_ago)
        )
        return order

    def _make_conversation(self, days_ago: int = 0, converted: bool = False) -> BotConversation:
        conversation = BotConversation.objects.create(store=Store.get_default())
        if converted:
            conversation.sale_order = self._make_order("71900000000", days_ago=days_ago)
            conversation.save(update_fields=["sale_order"])
        BotConversation.objects.filter(pk=conversation.pk).update(
            created_at=timezone.now() - timedelta(days=days_ago)
        )
        return conversation

    def test_classifies_new_and_returning_customers_by_phone(self) -> None:
        """A phone seen before the period started counts as returning, not new."""
        self._make_order("71999990000", days_ago=40)
        self._make_order("71999990000", days_ago=5)
        self._make_order("71988880000", days_ago=3)

        response: Any = self.client.get("/api/v1/sales-orders/customers/?period=30d")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["new_customers"], 1)
        self.assertEqual(response.data["returning_customers"], 1)

    def test_normalizes_phone_formatting_before_comparing(self) -> None:
        """Different formatting of the same number should still match as one customer."""
        self._make_order("(71) 99999-0000", days_ago=40)
        self._make_order("71999990000", days_ago=5)

        response: Any = self.client.get("/api/v1/sales-orders/customers/?period=30d")

        self.assertEqual(response.data["returning_customers"], 1)
        self.assertEqual(response.data["new_customers"], 0)

    def test_computes_bot_conversion_rate(self) -> None:
        """Conversion rate is converted conversations over total conversations in the period."""
        self._make_conversation(days_ago=5, converted=True)
        self._make_conversation(days_ago=5, converted=False)

        response: Any = self.client.get("/api/v1/sales-orders/customers/?period=30d")

        self.assertEqual(response.data["bot_conversations_count"], 2)
        self.assertEqual(response.data["bot_converted_count"], 1)
        self.assertEqual(response.data["bot_conversion_rate"], "50.00")

    def test_conversion_rate_is_null_without_any_conversations(self) -> None:
        """An empty denominator should not be reported as a misleading 0%."""
        response: Any = self.client.get("/api/v1/sales-orders/customers/?period=30d")

        self.assertEqual(response.data["bot_conversations_count"], 0)
        self.assertIsNone(response.data["bot_conversion_rate"])

    def test_unknown_period_falls_back_to_30d(self) -> None:
        """An invalid period query param should not error out the dashboard."""
        response: Any = self.client.get("/api/v1/sales-orders/customers/?period=invalid")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["period"], "30d")
