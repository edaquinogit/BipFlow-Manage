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
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core.cache import cache
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from bipdelivery.api.models import Category, Product, Store, StoreMembership, product_image_upload_to

User = get_user_model()


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
        slugs = set(Store.objects.filter(name="Pizzaria da Nova Loja").values_list("slug", flat=True))
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

    def test_newly_registered_owner_can_create_a_product_in_their_own_store(self) -> None:
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

        self.assertEqual(product_response.status_code, status.HTTP_201_CREATED, msg=product_response.data)
        created = Product.objects.get(id=product_response.data["id"])
        self.assertEqual(created.store_id, store.id)


class StoreSwitchSecurityTest(TestCase):
    """The header can move the active store, but never past a real membership."""

    def setUp(self) -> None:
        self.store_a = Store.get_default()
        self.store_b = Store.objects.create(name="Loja B", slug="loja-b")
        self.user = User.objects.create_user(username="owner_a", password="testpass123")
        StoreMembership.objects.create(store=self.store_a, user=self.user, role=StoreMembership.ROLE_OWNER)

        self.client = APIClient()
        self.client.force_authenticate(user=self.user, token={"store_id": self.store_a.id})

    def test_header_cannot_move_a_user_into_a_store_they_do_not_belong_to(self) -> None:
        response = self.client.get("/api/v1/store/current/", HTTP_X_STORE_SLUG=self.store_b.slug)

        self.assertEqual(response.data["slug"], self.store_a.slug)

    def test_header_can_move_a_user_between_their_own_stores(self) -> None:
        StoreMembership.objects.create(store=self.store_b, user=self.user, role=StoreMembership.ROLE_VIEWER)

        response = self.client.get("/api/v1/store/current/", HTTP_X_STORE_SLUG=self.store_b.slug)

        self.assertEqual(response.data["slug"], self.store_b.slug)

    def test_superuser_can_use_the_header_without_an_explicit_membership(self) -> None:
        superuser = User.objects.create_superuser(username="root", password="testpass123", email="root@example.com")
        client = APIClient()
        client.force_authenticate(user=superuser, token={"store_id": self.store_a.id})

        response = client.get("/api/v1/store/current/", HTTP_X_STORE_SLUG=self.store_b.slug)

        self.assertEqual(response.data["slug"], self.store_b.slug)


class MyStoresEndpointTest(TestCase):
    def setUp(self) -> None:
        self.store_a = Store.get_default()
        self.store_b = Store.objects.create(name="Loja B", slug="loja-b")
        self.user = User.objects.create_user(username="multi_owner", password="testpass123")
        StoreMembership.objects.create(store=self.store_a, user=self.user, role=StoreMembership.ROLE_OWNER)
        StoreMembership.objects.create(store=self.store_b, user=self.user, role=StoreMembership.ROLE_VIEWER)

        self.other_store = Store.objects.create(name="Loja C", slug="loja-c")

        self.client = APIClient()
        self.client.force_authenticate(user=self.user, token={"store_id": self.store_a.id})

    def test_lists_only_stores_the_user_belongs_to(self) -> None:
        response = self.client.get("/api/v1/store/mine/")

        slugs = {item["slug"] for item in response.data}
        self.assertEqual(slugs, {self.store_a.slug, self.store_b.slug})
        self.assertNotIn(self.other_store.slug, slugs)

    def test_can_create_an_additional_store_and_becomes_its_owner(self) -> None:
        response = self.client.post("/api/v1/store/mine/", {"name": "Loja Nova do Dono"}, format="json")

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

        self.category_a = Category.objects.create(name="Categoria A", store=self.store_a)
        self.category_b = Category.objects.create(name="Categoria B", store=self.store_b)

        self.staff_a = User.objects.create_user(
            username="staff_a", password="testpass123", is_staff=True
        )
        StoreMembership.objects.create(store=self.store_a, user=self.staff_a, role=StoreMembership.ROLE_OWNER)
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
