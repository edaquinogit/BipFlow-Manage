"""Etapa 0 of docs/architecture/customer-profile-checkout-evolution.md.

CustomerProfileView is the only place a storefront customer can read or
edit their own profile after RegisterUserView (storefront_customer context)
creates it. Also covers the store_scope.py gap this evolution closes: an
authenticated customer used to be invisible to resolve_request_store /
_user_belongs_to, which only checked StoreMembership.
"""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from bipdelivery.api.models import CustomerProfile, DeliveryRegion, SaleOrder, Store, StoreMembership
from bipdelivery.api.serializers import StoreScopedTokenObtainPairSerializer

User = get_user_model()


class CustomerProfileEndpointTest(TestCase):
    def setUp(self) -> None:
        self.store = Store.get_default()
        self.other_store = Store.objects.create(name="Loja B", slug="loja-b")
        self.user = User.objects.create_user(
            username="cliente@example.com",
            email="cliente@example.com",
            password="testpass123",
        )
        self.profile = CustomerProfile.objects.create(
            user=self.user,
            store=self.store,
            full_name="Cliente Teste",
            phone="11999999999",
            address="Rua A, 100",
            neighborhood="Centro",
            city="Sao Paulo",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user, token={"store_id": self.store.id})

    def test_get_returns_own_profile(self) -> None:
        response = self.client.get("/api/v1/customers/me/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["full_name"], "Cliente Teste")
        self.assertEqual(response.data["phone"], "11999999999")
        self.assertEqual(response.data["email"], "cliente@example.com")
        self.assertEqual(response.data["address"], "Rua A, 100")
        self.assertIsNone(response.data["delivery_region_id"])

    def test_get_requires_authentication(self) -> None:
        response = APIClient().get("/api/v1/customers/me/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_get_returns_404_when_user_has_no_profile_for_the_resolved_store(self) -> None:
        other_user = User.objects.create_user(username="sem_perfil@example.com", password="testpass123")
        client = APIClient()
        client.force_authenticate(user=other_user, token={"store_id": self.store.id})

        response = client.get("/api/v1/customers/me/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_a_customer_of_store_a_has_no_profile_visible_at_store_b(self) -> None:
        client = APIClient()
        client.force_authenticate(user=self.user, token={"store_id": self.other_store.id})

        response = client.get("/api/v1/customers/me/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_patch_updates_editable_fields_without_touching_the_rest(self) -> None:
        response = self.client.patch(
            "/api/v1/customers/me/",
            {"full_name": "Novo Nome", "city": "Rio de Janeiro"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.full_name, "Novo Nome")
        self.assertEqual(self.profile.city, "Rio de Janeiro")
        self.assertEqual(self.profile.address, "Rua A, 100")

    def test_patch_rejects_blank_full_name(self) -> None:
        """Regression: CheckoutWhatsAppView trusts profile.full_name
        unconditionally when building an order -- a blank name must never
        be saveable, or checkout would create an order with no customer
        name on it."""
        response = self.client.patch("/api/v1/customers/me/", {"full_name": ""}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.full_name, "Cliente Teste")

    def test_patch_rejects_blank_phone(self) -> None:
        response = self.client.patch("/api/v1/customers/me/", {"phone": ""}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.phone, "11999999999")

    def test_patch_accepts_a_delivery_region_from_the_same_store(self) -> None:
        region = DeliveryRegion.objects.create(name="Regiao A", store=self.store, delivery_fee="7.00")

        response = self.client.patch(
            "/api/v1/customers/me/", {"delivery_region_id": region.id}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.delivery_region_id, region.id)

    def test_patch_rejects_a_delivery_region_from_another_store(self) -> None:
        foreign_region = DeliveryRegion.objects.create(
            name="Regiao B", store=self.other_store, delivery_fee="5.00"
        )

        response = self.client.patch(
            "/api/v1/customers/me/", {"delivery_region_id": foreign_region.id}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.profile.refresh_from_db()
        self.assertIsNone(self.profile.delivery_region_id)


class CustomerBelongsToStoreScopeTest(TestCase):
    """The store_scope.py gap this evolution closes."""

    def setUp(self) -> None:
        self.store = Store.get_default()
        self.other_store = Store.objects.create(name="Loja B", slug="loja-b")
        self.user = User.objects.create_user(username="cliente2@example.com", password="testpass123")
        CustomerProfile.objects.create(
            user=self.user, store=self.store, full_name="Cliente", phone="11988887777"
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_customer_header_resolves_to_their_own_store(self) -> None:
        response = self.client.get("/api/v1/store/current/", HTTP_X_STORE_SLUG=self.store.slug)

        self.assertEqual(response.data["slug"], self.store.slug)

    def test_customer_header_cannot_move_into_an_unrelated_store(self) -> None:
        response = self.client.get("/api/v1/store/current/", HTTP_X_STORE_SLUG=self.other_store.slug)

        self.assertEqual(response.data["slug"], self.store.slug)


class CustomerJwtStoreClaimTest(TestCase):
    """StoreScopedTokenObtainPairSerializer must also claim a customer's store."""

    def test_login_token_carries_store_id_from_customer_profile(self) -> None:
        store = Store.get_default()
        user = User.objects.create_user(username="cliente3@example.com", password="SenhaForte123")
        CustomerProfile.objects.create(user=user, store=store, full_name="Cliente", phone="11977776666")

        token = StoreScopedTokenObtainPairSerializer.get_token(user)

        self.assertEqual(token["store_id"], store.id)

    def test_dashboard_membership_still_wins_over_a_customer_profile(self) -> None:
        """A user can plausibly hold both; StoreMembership stays the priority claim."""
        from bipdelivery.api.models import StoreMembership

        owner_store = Store.get_default()
        customer_store = Store.objects.create(name="Loja C", slug="loja-c")
        user = User.objects.create_user(username="dono_e_cliente@example.com", password="SenhaForte123")
        StoreMembership.objects.create(store=owner_store, user=user, role=StoreMembership.ROLE_OWNER)
        CustomerProfile.objects.create(user=user, store=customer_store, full_name="Fulano", phone="11966665555")

        token = StoreScopedTokenObtainPairSerializer.get_token(user)

        self.assertEqual(token["store_id"], owner_store.id)


class CustomerProfileCannotLeakDashboardAccessTest(TestCase):
    """Security regression caught in code review, not by an existing test:
    _user_belongs_to() recognizing CustomerProfile let a user with a
    StoreMembership at one store (dashboard-capable) pivot into ANOTHER
    store's private dashboard data merely by having a CustomerProfile
    there, since has_dashboard_read_access() only checks "any membership
    exists", never "membership at the resolved store".
    """

    def test_store_owner_cannot_view_another_stores_orders_via_their_customer_profile(self) -> None:
        owner_store = Store.get_default()
        other_store = Store.objects.create(name="Loja B", slug="loja-b")
        user = User.objects.create_user(username="dono_e_cliente_leak@example.com", password="SenhaForte123")
        StoreMembership.objects.create(store=owner_store, user=user, role=StoreMembership.ROLE_OWNER)
        CustomerProfile.objects.create(
            user=user, store=other_store, full_name="Fulano", phone="11955554444"
        )

        private_order = SaleOrder.objects.create(
            store=other_store,
            order_reference="BPF-LEAK-TEST",
            customer_name="Vitima",
            customer_phone="11900000000",
            delivery_method="pickup",
            payment_method="pix",
            subtotal=Decimal("10.00"),
            delivery_fee=Decimal("0.00"),
            total=Decimal("10.00"),
        )

        client = APIClient()
        client.force_authenticate(user=user, token={"store_id": owner_store.id})

        response = client.get("/api/v1/sales-orders/", HTTP_X_STORE_SLUG=other_store.slug)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        order_references = {item["order_reference"] for item in response.data["results"]}
        self.assertNotIn(private_order.order_reference, order_references)

    def test_pure_customer_with_no_membership_anywhere_can_still_switch_via_header(self) -> None:
        """The fix must not break the legitimate case: a user with NO
        StoreMembership anywhere (a pure customer) can still use the header
        to resolve their own CustomerProfile's store."""
        store = Store.get_default()
        other_store = Store.objects.create(name="Loja B", slug="loja-b")
        user = User.objects.create_user(username="cliente_puro@example.com", password="SenhaForte123")
        CustomerProfile.objects.create(user=user, store=other_store, full_name="Cliente", phone="11944443333")

        client = APIClient()
        client.force_authenticate(user=user, token={"store_id": store.id})

        response = client.get("/api/v1/store/current/", HTTP_X_STORE_SLUG=other_store.slug)

        self.assertEqual(response.data["slug"], other_store.slug)
