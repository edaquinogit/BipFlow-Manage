"""Etapa 4 of the multi-tenant evolution: real onboarding (core slice).

Registration now creates a Store + owner StoreMembership alongside the
User, so a brand-new signup can actually use the dashboard for their own
store without an operator manually assigning a Django group first --
that gap is real now (Etapa 3 deliberately left permissions.py alone
because every user back then already had a global group too).

The other half tested here is the store switcher's security boundary:
`X-Store-Slug` can move an authenticated user's *active* store, but only
to a store they actually belong to. Trusting the header unconditionally
for authenticated requests would reopen exactly the leak Etapa 3 closed.
"""

import os
import shutil
import tempfile
from decimal import Decimal
from io import BytesIO

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient

from bipdelivery.api.models import (
    Category,
    CustomerProfile,
    LabelSettings,
    Product,
    Store,
    StorefrontAppearance,
    StorefrontBanner,
    StoreMembership,
    product_image_upload_to,
)

User = get_user_model()


def build_storefront_test_image(filename: str = "storefront.png") -> SimpleUploadedFile:
    image_buffer = BytesIO()
    Image.new("RGB", (16, 16), color=(216, 27, 96)).save(image_buffer, format="PNG")
    image_buffer.seek(0)
    return SimpleUploadedFile(
        filename,
        image_buffer.read(),
        content_type="image/png",
    )


def build_large_storefront_test_image(filename: str = "storefront-large.png") -> SimpleUploadedFile:
    image_buffer = BytesIO()
    Image.frombytes("RGB", (900, 900), os.urandom(900 * 900 * 3)).save(
        image_buffer,
        format="PNG",
    )
    image_buffer.seek(0)
    return SimpleUploadedFile(
        filename,
        image_buffer.read(),
        content_type="image/png",
    )


class RegistrationCreatesStoreTest(TestCase):
    def setUp(self) -> None:
        cache.clear()
        self.client = APIClient()

    def _register(self, **overrides):
        payload = {
            "email": "nova.loja@example.com",
            "password": "SenhaForte123",
            "confirm_password": "SenhaForte123",
            "store_name": "Pizzaria da Nova Loja",
        }
        payload.update(overrides)
        return self.client.post("/api/auth/register/", payload, format="json")

    def _register_customer(
        self, *, email: str = "customer@example.com", store_slug: str = "default"
    ):
        payload = {
            "email": email,
            "password": "SenhaForte123",
            "confirm_password": "SenhaForte123",
            "registration_context": "storefront_customer",
            "store_slug": store_slug,
            "full_name": "Cliente Loja",
            "phone": "11999999999",
        }
        return self.client.post("/api/auth/register/", payload, format="json")

    def test_registration_creates_a_store_owned_by_the_new_user(self) -> None:
        response = self._register()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email="nova.loja@example.com")
        store = Store.objects.get(owner=user)
        self.assertEqual(store.name, "Pizzaria da Nova Loja")
        self.assertTrue(
            StoreMembership.objects.filter(
                store=store, user=user, role=StoreMembership.ROLE_OWNER
            ).exists()
        )

    def test_registration_requires_a_store_name(self) -> None:
        response = self._register(store_name="")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email="nova.loja@example.com").exists())

    def test_two_signups_with_the_same_store_name_get_distinct_slugs(self) -> None:
        self._register(email="dono1@example.com")
        response = self._register(email="dono2@example.com")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        slugs = set(
            Store.objects.filter(name="Pizzaria da Nova Loja").values_list(
                "slug", flat=True
            )
        )
        self.assertEqual(len(slugs), 2)

    def test_newly_registered_owner_can_access_the_dashboard(self) -> None:
        """The exact gap Etapa 3 deferred: a membership with no Django group."""
        self._register()
        user = User.objects.get(email="nova.loja@example.com")
        self.client.force_authenticate(user=user)

        response = self.client.get("/api/auth/me/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["can_access_dashboard"])
        self.assertTrue(response.data["can_manage_catalog"])
        self.assertTrue(response.data["can_manage_orders"])

    def test_newly_registered_owner_can_create_a_product_in_their_own_store(
        self,
    ) -> None:
        self._register()
        user = User.objects.get(email="nova.loja@example.com")
        store = Store.objects.get(owner=user)
        self.client.force_authenticate(user=user, token={"store_id": store.id})

        category_response = self.client.post(
            "/api/v1/categories/", {"name": "Pizzas"}, format="json"
        )
        self.assertEqual(category_response.status_code, status.HTTP_201_CREATED)

        product_response = self.client.post(
            "/api/v1/products/",
            {
                "name": "Pizza Margherita",
                "price": "39.90",
                "category": category_response.data["id"],
            },
            format="json",
        )

        self.assertEqual(
            product_response.status_code,
            status.HTTP_201_CREATED,
            msg=product_response.data,
        )
        created = Product.objects.get(id=product_response.data["id"])
        self.assertEqual(created.store_id, store.id)

    def test_storefront_customer_registration_creates_customer_profile_only(
        self,
    ) -> None:
        store = Store.get_default()

        response = self._register_customer(store_slug=store.slug)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email="customer@example.com")
        self.assertFalse(StoreMembership.objects.filter(user=user).exists())
        self.assertTrue(CustomerProfile.objects.filter(user=user, store=store).exists())
        self.assertEqual(response.data["profile_kind"], "customer")

    def test_storefront_customer_cannot_access_dashboard(self) -> None:
        store = Store.get_default()
        self._register_customer(store_slug=store.slug)
        user = User.objects.get(email="customer@example.com")
        self.client.force_authenticate(user=user)

        response = self.client.get("/api/auth/me/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["can_access_dashboard"])
        self.assertIn("customer", response.data["profile_kinds"])


class StoreSwitchSecurityTest(TestCase):
    """The header can move the active store, but never past a real membership."""

    def setUp(self) -> None:
        self.store_a = Store.get_default()
        self.store_b = Store.objects.create(name="Loja B", slug="loja-b")
        self.user = User.objects.create_user(username="owner_a", password="testpass123")
        StoreMembership.objects.create(
            store=self.store_a, user=self.user, role=StoreMembership.ROLE_OWNER
        )

        self.client = APIClient()
        self.client.force_authenticate(
            user=self.user, token={"store_id": self.store_a.id}
        )

    def test_header_cannot_move_a_user_into_a_store_they_do_not_belong_to(self) -> None:
        response = self.client.get(
            "/api/v1/store/current/", HTTP_X_STORE_SLUG=self.store_b.slug
        )

        self.assertEqual(response.data["slug"], self.store_a.slug)

    def test_header_can_move_a_user_between_their_own_stores(self) -> None:
        StoreMembership.objects.create(
            store=self.store_b, user=self.user, role=StoreMembership.ROLE_VIEWER
        )

        response = self.client.get(
            "/api/v1/store/current/", HTTP_X_STORE_SLUG=self.store_b.slug
        )

        self.assertEqual(response.data["slug"], self.store_b.slug)

    def test_superuser_can_use_the_header_without_an_explicit_membership(self) -> None:
        superuser = User.objects.create_superuser(
            username="root", password="testpass123", email="root@example.com"
        )
        client = APIClient()
        client.force_authenticate(user=superuser, token={"store_id": self.store_a.id})

        response = client.get(
            "/api/v1/store/current/", HTTP_X_STORE_SLUG=self.store_b.slug
        )

        self.assertEqual(response.data["slug"], self.store_b.slug)


class MyStoresEndpointTest(TestCase):
    def setUp(self) -> None:
        self.store_a = Store.get_default()
        self.store_b = Store.objects.create(name="Loja B", slug="loja-b")
        self.user = User.objects.create_user(
            username="multi_owner", password="testpass123"
        )
        StoreMembership.objects.create(
            store=self.store_a, user=self.user, role=StoreMembership.ROLE_OWNER
        )
        StoreMembership.objects.create(
            store=self.store_b, user=self.user, role=StoreMembership.ROLE_VIEWER
        )

        self.other_store = Store.objects.create(name="Loja C", slug="loja-c")

        self.client = APIClient()
        self.client.force_authenticate(
            user=self.user, token={"store_id": self.store_a.id}
        )

    def test_lists_only_stores_the_user_belongs_to(self) -> None:
        response = self.client.get("/api/v1/store/mine/")

        slugs = {item["slug"] for item in response.data}
        self.assertEqual(slugs, {self.store_a.slug, self.store_b.slug})
        self.assertNotIn(self.other_store.slug, slugs)

    def test_can_create_an_additional_store_and_becomes_its_owner(self) -> None:
        response = self.client.post(
            "/api/v1/store/mine/", {"name": "Loja Nova do Dono"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = Store.objects.get(id=response.data["id"])
        self.assertEqual(created.owner_id, self.user.id)
        self.assertTrue(
            StoreMembership.objects.filter(
                store=created, user=self.user, role=StoreMembership.ROLE_OWNER
            ).exists()
        )

    def test_requires_authentication(self) -> None:
        response = APIClient().get("/api/v1/store/mine/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_owner_can_rename_their_store(self) -> None:
        response = self.client.patch(
            f"/api/v1/store/mine/{self.store_a.slug}/",
            {"name": "Boutique Fitness"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.store_a.refresh_from_db()
        self.assertEqual(self.store_a.name, "Boutique Fitness")

    def test_viewer_role_cannot_rename_the_store(self) -> None:
        response = self.client.patch(
            f"/api/v1/store/mine/{self.store_b.slug}/",
            {"name": "Nome Indevido"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.store_b.refresh_from_db()
        self.assertEqual(self.store_b.name, "Loja B")

    def test_user_without_membership_cannot_rename_the_store(self) -> None:
        response = self.client.patch(
            f"/api/v1/store/mine/{self.other_store.slug}/",
            {"name": "Nome Indevido"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_rename_rejects_blank_name(self) -> None:
        response = self.client.patch(
            f"/api/v1/store/mine/{self.store_a.slug}/", {"name": "  "}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rename_unknown_store_returns_404(self) -> None:
        response = self.client.patch(
            "/api/v1/store/mine/does-not-exist/", {"name": "Qualquer"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class StoreReceiptSettingsEndpointTest(TestCase):
    """PDV receipt settings (exchange policy + print paper format) -- a
    dedicated endpoint that mirrors MyStoreDetailView's slug + membership
    permission story exactly, so these tests follow the same shape as
    MyStoresEndpointTest's rename tests above.
    """

    def setUp(self) -> None:
        self.store_a = Store.get_default()
        self.store_b = Store.objects.create(name="Loja B", slug="loja-b")
        self.user = User.objects.create_user(
            username="receipt_owner", password="testpass123"
        )
        StoreMembership.objects.create(
            store=self.store_a, user=self.user, role=StoreMembership.ROLE_OWNER
        )
        StoreMembership.objects.create(
            store=self.store_b, user=self.user, role=StoreMembership.ROLE_VIEWER
        )

        self.other_store = Store.objects.create(name="Loja C", slug="loja-c")

        self.client = APIClient()
        self.client.force_authenticate(
            user=self.user, token={"store_id": self.store_a.id}
        )

    def _url(self, slug: str) -> str:
        return f"/api/v1/store/mine/{slug}/receipt-settings/"

    def test_owner_can_update_both_fields(self) -> None:
        response = self.client.patch(
            self._url(self.store_a.slug),
            {
                "receipt_exchange_policy": "Trocas em ate 15 dias.",
                "receipt_paper_format": "58mm",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.store_a.refresh_from_db()
        self.assertEqual(self.store_a.receipt_exchange_policy, "Trocas em ate 15 dias.")
        self.assertEqual(self.store_a.receipt_paper_format, "58mm")

    def test_partial_update_only_touches_the_field_sent(self) -> None:
        self.store_a.receipt_paper_format = Store.RECEIPT_PAPER_FORMAT_A4
        self.store_a.save(update_fields=["receipt_paper_format"])

        response = self.client.patch(
            self._url(self.store_a.slug),
            {"receipt_exchange_policy": "Trocas em ate 30 dias."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.store_a.refresh_from_db()
        self.assertEqual(self.store_a.receipt_exchange_policy, "Trocas em ate 30 dias.")
        self.assertEqual(
            self.store_a.receipt_paper_format, Store.RECEIPT_PAPER_FORMAT_A4
        )

    def test_blank_exchange_policy_is_allowed(self) -> None:
        """Blank means the printed receipt shows no policy line at all."""
        response = self.client.patch(
            self._url(self.store_a.slug), {"receipt_exchange_policy": ""}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.store_a.refresh_from_db()
        self.assertEqual(self.store_a.receipt_exchange_policy, "")

    def test_invalid_paper_format_is_rejected(self) -> None:
        response = self.client.patch(
            self._url(self.store_a.slug),
            {"receipt_paper_format": "letter"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_viewer_role_cannot_update_receipt_settings(self) -> None:
        response = self.client.patch(
            self._url(self.store_b.slug),
            {"receipt_paper_format": "58mm"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.store_b.refresh_from_db()
        self.assertEqual(
            self.store_b.receipt_paper_format, Store.RECEIPT_PAPER_FORMAT_80MM
        )

    def test_user_without_membership_cannot_update_receipt_settings(self) -> None:
        response = self.client.patch(
            self._url(self.other_store.slug),
            {"receipt_paper_format": "58mm"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unknown_store_returns_404(self) -> None:
        response = self.client.patch(
            "/api/v1/store/mine/does-not-exist/receipt-settings/",
            {"receipt_paper_format": "58mm"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_requires_authentication(self) -> None:
        response = APIClient().patch(
            self._url(self.store_a.slug),
            {"receipt_paper_format": "58mm"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class StoreLabelSettingsEndpointTest(TestCase):
    """Printable product-label settings are tenant-scoped and editable by managers."""

    def setUp(self) -> None:
        self.store_a = Store.get_default()
        self.store_b = Store.objects.create(name="Loja B", slug="loja-b")
        self.user = User.objects.create_user(
            username="label_owner", password="testpass123"
        )
        StoreMembership.objects.create(
            store=self.store_a, user=self.user, role=StoreMembership.ROLE_OWNER
        )
        StoreMembership.objects.create(
            store=self.store_b, user=self.user, role=StoreMembership.ROLE_VIEWER
        )
        self.other_store = Store.objects.create(name="Loja C", slug="loja-c")

        self.client = APIClient()
        self.client.force_authenticate(
            user=self.user, token={"store_id": self.store_a.id}
        )

    def _url(self, slug: str) -> str:
        return f"/api/v1/store/mine/{slug}/label-settings/"

    def test_member_can_read_default_label_settings(self) -> None:
        response = self.client.get(self._url(self.store_a.slug))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["page_format"], "a4")
        self.assertEqual(response.data["columns"], 2)
        self.assertEqual(response.data["rows"], 5)
        self.assertEqual(response.data["labels_per_page"], 10)
        self.assertTrue(LabelSettings.objects.filter(store=self.store_a).exists())

    def test_owner_can_update_label_settings(self) -> None:
        response = self.client.patch(
            self._url(self.store_a.slug),
            {
                "columns": 3,
                "rows": 7,
                "margin_mm": 8,
                "cell_padding_mm": 3,
                "qr_size_mm": 24,
                "show_price": False,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        settings = LabelSettings.objects.get(store=self.store_a)
        self.assertEqual(settings.columns, 3)
        self.assertEqual(settings.rows, 7)
        self.assertEqual(settings.labels_per_page, 21)
        self.assertFalse(settings.show_price)

    def test_viewer_can_read_but_not_update_label_settings(self) -> None:
        read_response = self.client.get(self._url(self.store_b.slug))
        write_response = self.client.patch(
            self._url(self.store_b.slug),
            {"columns": 3},
            format="json",
        )

        self.assertEqual(read_response.status_code, status.HTTP_200_OK)
        self.assertEqual(write_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_invalid_label_settings_are_rejected(self) -> None:
        response = self.client.patch(
            self._url(self.store_a.slug),
            {"columns": 99},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_user_without_membership_cannot_read_label_settings(self) -> None:
        response = self.client.get(self._url(self.other_store.slug))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unknown_store_returns_404(self) -> None:
        response = self.client.get("/api/v1/store/mine/does-not-exist/label-settings/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_requires_authentication(self) -> None:
        response = APIClient().get(self._url(self.store_a.slug))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class StoreAppearanceSettingsEndpointTest(TestCase):
    """Theme engine writes are allowlisted and tenant-scoped."""

    def setUp(self) -> None:
        self.store_a = Store.get_default()
        self.store_b = Store.objects.create(name="Loja B", slug="loja-b")
        self.user = User.objects.create_user(
            username="appearance_owner", password="testpass123"
        )
        StoreMembership.objects.create(
            store=self.store_a, user=self.user, role=StoreMembership.ROLE_OWNER
        )
        StoreMembership.objects.create(
            store=self.store_b, user=self.user, role=StoreMembership.ROLE_VIEWER
        )
        self.other_store = Store.objects.create(name="Loja C", slug="loja-c")

        self.client = APIClient()
        self.client.force_authenticate(
            user=self.user, token={"store_id": self.store_a.id}
        )

    def _url(self, slug: str) -> str:
        return f"/api/v1/store/mine/{slug}/appearance/"

    def _current_url(self) -> str:
        return "/api/v1/store/current/appearance/"

    def test_owner_can_update_storefront_appearance(self) -> None:
        response = self.client.patch(
            self._url(self.store_a.slug),
            {
                "display_name": "Boutique Principal",
                "logo_url": "https://example.com/logo.png",
                "tagline": "Nova vitrine",
                "theme": {
                    "primary": "#111111",
                    "accent": "#22aaee",
                    "ignored": "#FFFFFF",
                },
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.store_a.refresh_from_db()
        self.assertEqual(self.store_a.display_name, "Boutique Principal")
        self.assertEqual(response.data["display_name"], "Boutique Principal")
        self.assertEqual(self.store_a.logo_url, "https://example.com/logo.png")
        self.assertEqual(self.store_a.tagline, "Nova vitrine")
        self.assertEqual(self.store_a.theme["primary"], "#111111")
        self.assertEqual(self.store_a.theme["accent"], "#22AAEE")
        self.assertNotIn("ignored", self.store_a.theme)
        self.assertEqual(
            response.data["theme"], Store.normalize_theme(self.store_a.theme)
        )

    def test_invalid_theme_values_fall_back_to_defaults(self) -> None:
        response = self.client.patch(
            self._url(self.store_a.slug),
            {"theme": {"primary": "red", "accent": "#123456"}},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.store_a.refresh_from_db()
        self.assertEqual(self.store_a.theme["primary"], Store.DEFAULT_THEME["primary"])
        self.assertEqual(self.store_a.theme["accent"], "#123456")

    def test_rejects_logo_url_from_another_storefront_media_path(self) -> None:
        response = self.client.patch(
            self._current_url(),
            {
                "logo_url": (
                    f"http://testserver/media/stores/{self.store_b.id}/"
                    "storefront/logo/logo.png"
                )
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("logo_url", response.data)

    def test_viewer_can_read_but_not_update_appearance(self) -> None:
        read_response = self.client.get(self._url(self.store_b.slug))
        write_response = self.client.patch(
            self._url(self.store_b.slug),
            {"tagline": "Indevido"},
            format="json",
        )

        self.assertEqual(read_response.status_code, status.HTTP_200_OK)
        self.assertEqual(write_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_user_without_membership_cannot_read_appearance(self) -> None:
        response = self.client.get(self._url(self.other_store.slug))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unknown_store_returns_404(self) -> None:
        response = self.client.get("/api/v1/store/mine/does-not-exist/appearance/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_requires_authentication(self) -> None:
        response = APIClient().get(self._url(self.store_a.slug))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_current_endpoint_updates_authenticated_store(self) -> None:
        response = self.client.patch(
            self._current_url(),
            {"tagline": "Atual pela loja ativa"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.store_a.refresh_from_db()
        self.store_b.refresh_from_db()
        self.assertEqual(self.store_a.tagline, "Atual pela loja ativa")
        self.assertNotEqual(self.store_b.tagline, "Atual pela loja ativa")

    def test_staff_without_membership_can_update_current_store_appearance(self) -> None:
        staff_user = User.objects.create_user(
            username="appearance_staff", password="testpass123", is_staff=True
        )
        client = APIClient()
        client.force_authenticate(user=staff_user)

        response = client.patch(
            self._current_url(),
            {"tagline": "Atual pelo admin"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.store_a.refresh_from_db()
        self.assertEqual(self.store_a.tagline, "Atual pelo admin")
        self.assertFalse(
            StoreMembership.objects.filter(
                store=self.store_a, user=staff_user
            ).exists()
        )

    def test_current_endpoint_viewer_cannot_update_selected_store(self) -> None:
        response = self.client.patch(
            self._current_url(),
            {"tagline": "Indevido"},
            format="json",
            HTTP_X_STORE_SLUG=self.store_b.slug,
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.store_b.refresh_from_db()
        self.assertNotEqual(self.store_b.tagline, "Indevido")


class StorefrontAppearanceEndpointTest(TestCase):
    """Extended storefront appearance is tenant-scoped and public-safe."""

    def setUp(self) -> None:
        self.store_a = Store.get_default()
        self.store_b = Store.objects.create(name="Loja B", slug="loja-b")
        self.inactive_store = Store.objects.create(
            name="Loja Inativa", slug="loja-inativa", is_active=False
        )
        self.user = User.objects.create_user(
            username="storefront_appearance_owner", password="testpass123"
        )
        StoreMembership.objects.create(
            store=self.store_a, user=self.user, role=StoreMembership.ROLE_OWNER
        )
        StoreMembership.objects.create(
            store=self.store_b, user=self.user, role=StoreMembership.ROLE_VIEWER
        )

        self.client = APIClient()
        self.client.force_authenticate(
            user=self.user, token={"store_id": self.store_a.id}
        )

    def _dashboard_url(self, slug: str) -> str:
        return f"/api/v1/store/mine/{slug}/storefront-appearance/"

    def _current_dashboard_url(self) -> str:
        return "/api/v1/store/current/storefront-appearance/"

    def _public_url(self, slug: str) -> str:
        return f"/api/v1/public/stores/{slug}/appearance/"

    def test_owner_can_read_defaults_and_update_extended_appearance(self) -> None:
        read_response = self.client.get(self._dashboard_url(self.store_a.slug))

        self.assertEqual(read_response.status_code, status.HTTP_200_OK)
        self.assertFalse(read_response.data["hero_enabled"])
        self.assertEqual(read_response.data["card_style"], "clean")
        self.assertTrue(
            StorefrontAppearance.objects.filter(store=self.store_a).exists()
        )

        write_response = self.client.patch(
            self._dashboard_url(self.store_a.slug),
            {
                "secondary_color": "#22aaee",
                "favicon_url": "https://example.com/favicon.png",
                "hero_enabled": True,
                "hero_image_desktop": "https://example.com/banner.jpg",
                "hero_alt_text": "Banner promocional",
                "card_style": "elevated",
                "radius_style": "soft",
                "density": "compact",
                "font_preset": "editorial",
                "motion_enabled": False,
                "motion_intensity": "subtle",
                "decoration_enabled": True,
                "decoration_style": "geometric",
            },
            format="json",
        )

        self.assertEqual(write_response.status_code, status.HTTP_200_OK)
        appearance = StorefrontAppearance.objects.get(store=self.store_a)
        self.assertEqual(appearance.secondary_color, "#22AAEE")
        self.assertEqual(appearance.favicon_url, "https://example.com/favicon.png")
        self.assertTrue(appearance.hero_enabled)
        self.assertEqual(appearance.card_style, "elevated")
        self.assertEqual(appearance.radius_style, "soft")
        self.assertEqual(appearance.density, "compact")
        self.assertEqual(appearance.font_preset, "editorial")
        self.assertFalse(appearance.motion_enabled)
        self.assertEqual(appearance.decoration_style, "geometric")

    def test_viewer_can_read_but_not_update_extended_appearance(self) -> None:
        read_response = self.client.get(self._dashboard_url(self.store_b.slug))
        write_response = self.client.patch(
            self._dashboard_url(self.store_b.slug),
            {"hero_enabled": True},
            format="json",
        )

        self.assertEqual(read_response.status_code, status.HTTP_200_OK)
        self.assertEqual(write_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_rejects_internal_media_urls_from_another_store(self) -> None:
        response = self.client.patch(
            self._current_dashboard_url(),
            {
                "favicon_url": (
                    f"http://testserver/media/stores/{self.store_b.id}/"
                    "storefront/favicon/favicon.png"
                ),
                "hero_image_desktop": (
                    f"http://testserver/media/stores/{self.store_b.id}/"
                    "storefront/banners/banner.png"
                ),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("favicon_url", response.data)
        self.assertIn("hero_image_desktop", response.data)

    def test_public_active_store_appearance_includes_identity_without_private_ids(self) -> None:
        self.store_a.logo_url = "https://example.com/logo.png"
        self.store_a.display_name = "Boutique Publica"
        self.store_a.tagline = "Catalogo premium"
        self.store_a.theme = {"primary": "#111111", "accent": "#22aaee"}
        self.store_a.save(
            update_fields=["logo_url", "display_name", "tagline", "theme", "updated_at"]
        )
        StorefrontAppearance.objects.create(
            store=self.store_a,
            hero_enabled=True,
            hero_image_desktop="https://example.com/banner.jpg",
            hero_alt_text="Banner principal",
            card_style="bordered",
            font_preset="classic",
        )

        response = APIClient().get(self._public_url(self.store_a.slug))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["store_name"], "Boutique Publica")
        self.assertEqual(response.data["store_slug"], self.store_a.slug)
        self.assertEqual(response.data["logo_url"], "https://example.com/logo.png")
        self.assertEqual(response.data["tagline"], "Catalogo premium")
        self.assertEqual(response.data["theme"]["accent"], "#22AAEE")
        self.assertEqual(response.data["favicon_url"], "")
        self.assertTrue(response.data["hero_enabled"])
        self.assertEqual(response.data["card_style"], "bordered")
        self.assertEqual(response.data["font_preset"], "classic")
        self.assertNotIn("id", response.data)
        self.assertNotIn("store", response.data)

    def test_public_appearance_falls_back_to_registered_store_name(self) -> None:
        StorefrontAppearance.objects.create(store=self.store_a)

        response = APIClient().get(self._public_url(self.store_a.slug))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["store_name"], self.store_a.name)

    def test_public_inactive_store_appearance_returns_404(self) -> None:
        response = APIClient().get(self._public_url(self.inactive_store.slug))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_current_endpoint_reads_defaults_and_initializes_authenticated_store(self) -> None:
        response = self.client.get(self._current_dashboard_url())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["store_id"], self.store_a.id)
        self.assertIsInstance(response.data["id"], int)
        self.assertFalse(response.data["hero_enabled"])
        self.assertTrue(
            StorefrontAppearance.objects.filter(store=self.store_a).exists()
        )

    def test_staff_without_membership_can_read_and_update_current_storefront_appearance(self) -> None:
        staff_user = User.objects.create_user(
            username="storefront_appearance_staff",
            password="testpass123",
            is_staff=True,
        )
        client = APIClient()
        client.force_authenticate(user=staff_user)

        read_response = client.get(self._current_dashboard_url())
        write_response = client.patch(
            self._current_dashboard_url(),
            {"hero_enabled": True, "hero_title": "Admin premium"},
            format="json",
        )

        self.assertEqual(read_response.status_code, status.HTTP_200_OK)
        self.assertEqual(read_response.data["store_id"], self.store_a.id)
        self.assertEqual(write_response.status_code, status.HTTP_200_OK)
        appearance = StorefrontAppearance.objects.get(store=self.store_a)
        self.assertTrue(appearance.hero_enabled)
        self.assertEqual(appearance.hero_title, "Admin premium")
        self.assertFalse(
            StoreMembership.objects.filter(
                store=self.store_a, user=staff_user
            ).exists()
        )

    def test_current_endpoint_uses_selected_store_header_when_member(self) -> None:
        response = self.client.get(
            self._current_dashboard_url(),
            HTTP_X_STORE_SLUG=self.store_b.slug,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["store_id"], self.store_b.id)

    def test_current_endpoint_patches_only_sent_fields(self) -> None:
        appearance = StorefrontAppearance.objects.create(
            store=self.store_a,
            hero_title="Titulo mantido",
            hero_enabled=False,
            card_style="clean",
        )

        response = self.client.patch(
            self._current_dashboard_url(),
            {"hero_enabled": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        appearance.refresh_from_db()
        self.assertTrue(appearance.hero_enabled)
        self.assertEqual(appearance.hero_title, "Titulo mantido")
        self.assertEqual(appearance.card_style, "clean")

    def test_current_endpoint_rejects_invalid_values(self) -> None:
        enum_response = self.client.patch(
            self._current_dashboard_url(),
            {"card_style": "flutuante"},
            format="json",
        )
        font_response = self.client.patch(
            self._current_dashboard_url(),
            {"font_preset": "script-livre"},
            format="json",
        )
        color_response = self.client.patch(
            self._current_dashboard_url(),
            {"secondary_color": "pink"},
            format="json",
        )

        self.assertEqual(enum_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(font_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(color_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_current_endpoint_derives_hero_cta_from_friendly_category_destination(self) -> None:
        category = Category.objects.create(
            name="Promocoes",
            slug="promocoes",
            store=self.store_a,
        )

        response = self.client.patch(
            self._current_dashboard_url(),
            {
                "hero_cta_text": "Ver promocoes",
                "hero_destination_type": "category",
                "hero_destination_value": str(category.id),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["hero_destination_type"], "category")
        self.assertEqual(response.data["hero_destination_value"], str(category.id))
        self.assertEqual(
            response.data["hero_cta_url"],
            f"/l/{self.store_a.slug}/produtos?category={category.id}",
        )

    def test_current_endpoint_rejects_hero_destination_from_other_store(self) -> None:
        other_category = Category.objects.create(
            name="Outra loja",
            slug="outra-loja",
            store=self.store_b,
        )

        response = self.client.patch(
            self._current_dashboard_url(),
            {
                "hero_destination_type": "category",
                "hero_destination_value": str(other_category.id),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_current_endpoint_does_not_read_or_patch_unowned_store_from_header(self) -> None:
        other_user = User.objects.create_user(
            username="other_storefront_owner", password="testpass123"
        )
        store_c = Store.objects.create(name="Loja C", slug="loja-c")
        StoreMembership.objects.create(
            store=store_c, user=other_user, role=StoreMembership.ROLE_OWNER
        )
        StorefrontAppearance.objects.create(
            store=self.store_a, secondary_color="#AA0000"
        )
        StorefrontAppearance.objects.create(
            store=store_c, secondary_color="#00BB00"
        )

        read_response = self.client.get(
            self._current_dashboard_url(),
            HTTP_X_STORE_SLUG=store_c.slug,
        )
        write_response = self.client.patch(
            self._current_dashboard_url(),
            {"secondary_color": "#336699"},
            format="json",
            HTTP_X_STORE_SLUG=store_c.slug,
        )

        self.assertEqual(read_response.status_code, status.HTTP_200_OK)
        self.assertEqual(read_response.data["store_id"], self.store_a.id)
        self.assertEqual(read_response.data["secondary_color"], "#AA0000")
        self.assertEqual(write_response.status_code, status.HTTP_200_OK)
        self.assertEqual(write_response.data["store_id"], self.store_a.id)

        self.assertEqual(
            StorefrontAppearance.objects.get(store=self.store_a).secondary_color,
            "#336699",
        )
        self.assertEqual(
            StorefrontAppearance.objects.get(store=store_c).secondary_color,
            "#00BB00",
        )

    def test_current_endpoint_user_without_store_membership_gets_403(self) -> None:
        client = APIClient()
        orphan_user = User.objects.create_user(
            username="storefront_orphan", password="testpass123"
        )
        client.force_authenticate(user=orphan_user)

        response = client.get(self._current_dashboard_url())

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_current_endpoint_requires_authentication(self) -> None:
        response = APIClient().get(self._current_dashboard_url())

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class StorefrontMediaUploadEndpointTest(TestCase):
    """Storefront media uploads are multipart, validated and tenant-scoped."""

    def setUp(self) -> None:
        self.media_root = tempfile.mkdtemp()
        self.settings_override = override_settings(MEDIA_ROOT=self.media_root)
        self.settings_override.enable()

        self.store_a = Store.get_default()
        self.store_b = Store.objects.create(name="Loja B", slug="loja-b")
        self.user = User.objects.create_user(
            username="storefront_media_owner", password="testpass123"
        )
        StoreMembership.objects.create(
            store=self.store_a, user=self.user, role=StoreMembership.ROLE_OWNER
        )
        StoreMembership.objects.create(
            store=self.store_b, user=self.user, role=StoreMembership.ROLE_VIEWER
        )

        self.client = APIClient()
        self.client.force_authenticate(
            user=self.user, token={"store_id": self.store_a.id}
        )

    def tearDown(self) -> None:
        self.settings_override.disable()
        shutil.rmtree(self.media_root, ignore_errors=True)

    def _url(self) -> str:
        return "/api/v1/store/current/storefront-media/"

    def test_owner_can_upload_logo_to_current_store_path(self) -> None:
        response = self.client.post(
            self._url(),
            {"kind": "logo", "file": build_storefront_test_image("logo.png")},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["kind"], "logo")
        self.assertEqual(response.data["content_type"], "image/png")
        self.assertTrue(
            response.data["path"].startswith(
                f"stores/{self.store_a.id}/storefront/logo/"
            )
        )
        self.assertIn(f"/media/stores/{self.store_a.id}/storefront/logo/", response.data["url"])

    def test_staff_without_membership_can_upload_to_current_store_path(self) -> None:
        staff_user = User.objects.create_user(
            username="storefront_media_staff",
            password="testpass123",
            is_staff=True,
        )
        client = APIClient()
        client.force_authenticate(user=staff_user)

        response = client.post(
            self._url(),
            {"kind": "logo", "file": build_storefront_test_image("admin-logo.png")},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            response.data["path"].startswith(
                f"stores/{self.store_a.id}/storefront/logo/"
            )
        )
        self.assertFalse(
            StoreMembership.objects.filter(
                store=self.store_a, user=staff_user
            ).exists()
        )

    def test_owner_can_upload_banner_to_current_store_path(self) -> None:
        response = self.client.post(
            self._url(),
            {"kind": "banner", "file": build_storefront_test_image("banner.png")},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["kind"], "banner")
        self.assertTrue(
            response.data["path"].startswith(
                f"stores/{self.store_a.id}/storefront/banners/"
            )
        )

    def test_owner_can_upload_favicon_to_current_store_path(self) -> None:
        response = self.client.post(
            self._url(),
            {"kind": "favicon", "file": build_storefront_test_image("favicon.png")},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["kind"], "favicon")
        self.assertTrue(
            response.data["path"].startswith(
                f"stores/{self.store_a.id}/storefront/favicon/"
            )
        )

    def test_owner_can_upload_promotion_to_current_store_path(self) -> None:
        response = self.client.post(
            self._url(),
            {"kind": "promotion", "file": build_storefront_test_image("promo.png")},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["kind"], "promotion")
        self.assertTrue(
            response.data["path"].startswith(
                f"stores/{self.store_a.id}/storefront/promotions/"
            )
        )

    def test_rejects_invalid_file_type(self) -> None:
        response = self.client.post(
            self._url(),
            {
                "kind": "logo",
                "file": SimpleUploadedFile(
                    "payload.txt",
                    b"<script>alert(1)</script>",
                    content_type="text/plain",
                ),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rejects_oversized_logo(self) -> None:
        response = self.client.post(
            self._url(),
            {"kind": "logo", "file": build_large_storefront_test_image()},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("file", response.data)

    def test_viewer_cannot_upload_to_selected_store(self) -> None:
        response = self.client.post(
            self._url(),
            {"kind": "logo", "file": build_storefront_test_image("logo.png")},
            format="multipart",
            HTTP_X_STORE_SLUG=self.store_b.slug,
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unowned_header_does_not_change_upload_tenant(self) -> None:
        other_user = User.objects.create_user(
            username="storefront_media_other", password="testpass123"
        )
        store_c = Store.objects.create(name="Loja C", slug="loja-c")
        StoreMembership.objects.create(
            store=store_c, user=other_user, role=StoreMembership.ROLE_OWNER
        )

        response = self.client.post(
            self._url(),
            {"kind": "logo", "file": build_storefront_test_image("logo.png")},
            format="multipart",
            HTTP_X_STORE_SLUG=store_c.slug,
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            response.data["path"].startswith(
                f"stores/{self.store_a.id}/storefront/logo/"
            )
        )
        self.assertNotIn(f"stores/{store_c.id}/", response.data["path"])


class StorefrontBannerEndpointTest(TestCase):
    """Promotional banners are CRUD-managed, ordered and tenant-scoped."""

    def setUp(self) -> None:
        self.store_a = Store.get_default()
        self.store_b = Store.objects.create(name="Loja B", slug="loja-b")
        self.user = User.objects.create_user(
            username="storefront_banner_owner", password="testpass123"
        )
        StoreMembership.objects.create(
            store=self.store_a, user=self.user, role=StoreMembership.ROLE_OWNER
        )
        StoreMembership.objects.create(
            store=self.store_b, user=self.user, role=StoreMembership.ROLE_VIEWER
        )
        self.category = Category.objects.create(
            name="Promocoes",
            slug="promocoes",
            store=self.store_a,
        )
        self.product = Product.objects.create(
            name="Produto destaque",
            price=Decimal("12.00"),
            category=self.category,
            store=self.store_a,
            slug="produto-destaque",
        )
        self.client = APIClient()
        self.client.force_authenticate(
            user=self.user,
            token={"store_id": self.store_a.id},
        )

    def _list_url(self) -> str:
        return "/api/v1/store/current/storefront-banners/"

    def _detail_url(self, banner: StorefrontBanner) -> str:
        return f"/api/v1/store/current/storefront-banners/{banner.id}/"

    def _reorder_url(self) -> str:
        return "/api/v1/store/current/storefront-banners/reorder/"

    def _public_url(self, slug: str) -> str:
        return f"/api/v1/public/stores/{slug}/banners/"

    def test_owner_can_create_list_update_and_delete_banner(self) -> None:
        create_response = self.client.post(
            self._list_url(),
            {
                "image_url": "https://cdn.example.com/promo.png",
                "alt_text": "Promocao da semana",
                "title": "Semana especial",
                "subtitle": "Itens selecionados",
                "cta_text": "Ver categoria",
                "destination_type": "category",
                "destination_value": str(self.category.id),
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_response.data["position"], 0)
        self.assertEqual(create_response.data["status"], "active")
        self.assertEqual(
            create_response.data["button_url"],
            f"/l/{self.store_a.slug}/produtos?category={self.category.id}",
        )

        banner = StorefrontBanner.objects.get(store=self.store_a)
        list_response = self.client.get(self._list_url())
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)

        update_response = self.client.patch(
            self._detail_url(banner),
            {
                "title": "Produto em destaque",
                "destination_type": "product",
                "destination_value": str(self.product.id),
            },
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            update_response.data["button_url"],
            f"/l/{self.store_a.slug}/produtos/{self.product.slug}",
        )

        delete_response = self.client.delete(self._detail_url(banner))
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(StorefrontBanner.objects.filter(id=banner.id).exists())

    def test_staff_without_membership_can_create_and_list_current_store_banners(self) -> None:
        staff_user = User.objects.create_user(
            username="storefront_banner_staff",
            password="testpass123",
            is_staff=True,
        )
        client = APIClient()
        client.force_authenticate(user=staff_user)

        create_response = client.post(
            self._list_url(),
            {
                "image_url": "https://cdn.example.com/admin-promo.png",
                "title": "Admin premium",
                "is_active": True,
            },
            format="json",
        )
        list_response = client.get(self._list_url())

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual([banner["title"] for banner in list_response.data], ["Admin premium"])
        self.assertTrue(
            StorefrontBanner.objects.filter(
                store=self.store_a, title="Admin premium"
            ).exists()
        )
        self.assertFalse(
            StoreMembership.objects.filter(
                store=self.store_a, user=staff_user
            ).exists()
        )

    def test_reorder_persists_positions_for_full_banner_list(self) -> None:
        first = StorefrontBanner.objects.create(
            store=self.store_a,
            image_url="https://cdn.example.com/first.png",
            title="Primeiro",
            position=0,
        )
        second = StorefrontBanner.objects.create(
            store=self.store_a,
            image_url="https://cdn.example.com/second.png",
            title="Segundo",
            position=1,
        )

        response = self.client.post(
            self._reorder_url(),
            {"ids": [second.id, first.id]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(second.position, 0)
        self.assertEqual(first.position, 1)
        self.assertEqual([banner["id"] for banner in response.data], [second.id, first.id])

    def test_reorder_rejects_partial_or_cross_tenant_id_list(self) -> None:
        own_banner = StorefrontBanner.objects.create(
            store=self.store_a,
            image_url="https://cdn.example.com/own.png",
        )
        other_banner = StorefrontBanner.objects.create(
            store=self.store_b,
            image_url="https://cdn.example.com/other.png",
        )

        partial_response = self.client.post(
            self._reorder_url(),
            {"ids": [own_banner.id, other_banner.id]},
            format="json",
        )

        self.assertEqual(partial_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rejects_banner_image_url_from_another_storefront_media_path(self) -> None:
        response = self.client.post(
            self._list_url(),
            {
                "image_url": (
                    f"http://testserver/media/stores/{self.store_b.id}/"
                    "storefront/promotions/promo.png"
                ),
                "title": "Midia indevida",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("image_url", response.data)

    def test_schedule_status_and_public_endpoint_only_expose_active_window(self) -> None:
        active = StorefrontBanner.objects.create(
            store=self.store_a,
            image_url="https://cdn.example.com/active.png",
            title="Ativo",
            position=0,
        )
        scheduled = StorefrontBanner.objects.create(
            store=self.store_a,
            image_url="https://cdn.example.com/scheduled.png",
            title="Agendado",
            position=1,
            starts_at=timezone.now() + timezone.timedelta(days=1),
        )
        expired = StorefrontBanner.objects.create(
            store=self.store_a,
            image_url="https://cdn.example.com/expired.png",
            title="Expirado",
            position=2,
            ends_at=timezone.now() - timezone.timedelta(days=1),
        )
        inactive = StorefrontBanner.objects.create(
            store=self.store_a,
            image_url="https://cdn.example.com/inactive.png",
            title="Inativo",
            position=3,
            is_active=False,
        )

        list_response = self.client.get(self._list_url())
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        statuses_by_title = {
            banner["title"]: banner["status"] for banner in list_response.data
        }
        self.assertEqual(statuses_by_title[active.title], "active")
        self.assertEqual(statuses_by_title[scheduled.title], "scheduled")
        self.assertEqual(statuses_by_title[expired.title], "expired")
        self.assertEqual(statuses_by_title[inactive.title], "inactive")

        public_response = APIClient().get(self._public_url(self.store_a.slug))
        self.assertEqual(public_response.status_code, status.HTTP_200_OK)
        self.assertEqual([banner["title"] for banner in public_response.data], ["Ativo"])

    def test_viewer_and_cross_tenant_destination_cannot_mutate_banner(self) -> None:
        other_category = Category.objects.create(
            name="Outra",
            slug="outra",
            store=self.store_b,
        )
        banner = StorefrontBanner.objects.create(
            store=self.store_a,
            image_url="https://cdn.example.com/banner.png",
        )

        cross_destination_response = self.client.patch(
            self._detail_url(banner),
            {
                "destination_type": "category",
                "destination_value": str(other_category.id),
            },
            format="json",
        )
        viewer_response = self.client.patch(
            self._detail_url(banner),
            {"title": "Indevido"},
            format="json",
            HTTP_X_STORE_SLUG=self.store_b.slug,
        )

        self.assertEqual(
            cross_destination_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(viewer_response.status_code, status.HTTP_403_FORBIDDEN)
        banner.refresh_from_db()
        self.assertNotEqual(banner.title, "Indevido")


class ProductImageUploadPathTest(TestCase):
    """Etapa 4: media paths are scoped by store_id, not shared across tenants."""

    def test_product_image_upload_path_is_scoped_by_store(self) -> None:
        store = Store.objects.create(name="Loja Media", slug="loja-media")
        category = Category.objects.create(name="Cat", store=store)
        product = Product.objects.create(
            name="Produto", price=Decimal("10.00"), category=category, store=store
        )

        path = product_image_upload_to(product, "foto.jpg")

        self.assertTrue(path.startswith(f"products/{store.id}/"))
        self.assertTrue(path.endswith("/foto.jpg"))


class AdminStoreScopingTest(TestCase):
    """Etapa 4: Django admin staff only see their own store, superusers see all."""

    def setUp(self) -> None:
        self.store_a = Store.get_default()
        self.store_b = Store.objects.create(name="Loja B", slug="loja-b")

        self.category_a = Category.objects.create(
            name="Categoria A", store=self.store_a
        )
        self.category_b = Category.objects.create(
            name="Categoria B", store=self.store_b
        )

        self.staff_a = User.objects.create_user(
            username="staff_a", password="testpass123", is_staff=True
        )
        StoreMembership.objects.create(
            store=self.store_a, user=self.staff_a, role=StoreMembership.ROLE_OWNER
        )
        # Django admin gates by model permission first, independent of the
        # store-scoping under test here -- grant the standard view permission
        # so the request reaches CategoryAdmin.get_queryset() at all.
        view_category_permission = Permission.objects.get(
            codename="view_category", content_type__app_label="api"
        )
        self.staff_a.user_permissions.add(view_category_permission)

        self.superuser = User.objects.create_superuser(
            username="root", password="testpass123", email="root@example.com"
        )

    def test_staff_only_sees_their_own_stores_categories(self) -> None:
        self.client.force_login(self.staff_a)

        response = self.client.get("/admin/api/category/")

        self.assertContains(response, "Categoria A")
        self.assertNotContains(response, "Categoria B")

    def test_superuser_sees_every_stores_categories(self) -> None:
        self.client.force_login(self.superuser)

        response = self.client.get("/admin/api/category/")

        self.assertContains(response, "Categoria A")
        self.assertContains(response, "Categoria B")
