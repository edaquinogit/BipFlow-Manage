"""Security/isolation guarantees for Etapa 1 of the multi-tenant evolution.

These tests do not exercise business-table scoping (Category/Product/etc. do
not carry store_id until Etapa 2) — they guard the two things Etapa 1 does
introduce: Store resolution must stay stable once more than one store exists,
and StoreMembership rows must never cross between stores. Both are the exact
building blocks Etapa 3 (API isolation) will depend on, so regressions here
would silently become real cross-tenant data leakage later.
"""
from typing import Any

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from bipdelivery.api.models import Store, StoreMembership

PUBLIC_STORE_FIELDS = {
    "id",
    "name",
    "slug",
    "logo_url",
    "tagline",
    "whatsapp_phone",
    "theme",
    "is_active",
    "status",
    # PDV receipt settings: same public-info tier as tagline/whatsapp_phone
    # above (a return policy and a printer paper-format preference are not
    # sensitive) -- added to StoreSerializer for the PDV receipt/print-format
    # feature (exchange-policy text + paper-size presets shown on the
    # printed sale receipt).
    "receipt_exchange_policy",
    "receipt_paper_format",
}


class StoreResolutionStaysStableWithMultipleStoresTest(TestCase):
    """Guards Store.get_default() against ever resolving to the wrong tenant."""

    def test_get_default_ignores_other_stores(self) -> None:
        default_store = Store.get_default()
        Store.objects.create(name="Loja B (futura)", slug="loja-b")
        Store.objects.create(name="Loja C (futura)", slug="loja-c")

        resolved = Store.get_default()

        self.assertEqual(resolved.id, default_store.id)
        self.assertEqual(resolved.slug, Store.DEFAULT_SLUG)
        self.assertEqual(Store.objects.count(), 3)

    def test_endpoint_keeps_resolving_default_store_among_many(self) -> None:
        Store.get_default()
        Store.objects.create(name="Loja B (futura)", slug="loja-b")

        response: Any = APIClient().get("/api/v1/store/current/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["slug"], Store.DEFAULT_SLUG)


class CurrentStoreViewDoesNotLeakPrivateDataTest(TestCase):
    """Negative assertions: the public endpoint must expose only an allowlist."""

    def setUp(self) -> None:
        self.store = Store.get_default()
        self.owner = User.objects.create_user(
            username="owner", password="testpass123", is_staff=True
        )
        self.store.owner = self.owner
        self.store.save()
        StoreMembership.objects.create(
            store=self.store, user=self.owner, role=StoreMembership.ROLE_OWNER
        )

    def test_response_exposes_only_the_public_allowlist(self) -> None:
        response: Any = APIClient().get("/api/v1/store/current/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(set(response.data.keys()), PUBLIC_STORE_FIELDS)

    def test_response_never_includes_owner_or_membership_data(self) -> None:
        response: Any = APIClient().get("/api/v1/store/current/")

        self.assertNotIn("owner", response.data)
        self.assertNotIn("owner_id", response.data)
        self.assertNotIn("memberships", response.data)

    def test_response_is_identical_regardless_of_caller_identity(self) -> None:
        """Same public data for anonymous, regular and dashboard-staff callers.

        A common real-world regression is a future patch that conditionally
        adds fields for "trusted" callers. This pins today's contract: this
        endpoint carries no identity-based branching.
        """
        regular_user = User.objects.create_user(username="regular", password="testpass123")

        anonymous_client = APIClient()
        regular_client = APIClient()
        regular_client.force_authenticate(user=regular_user)
        owner_client = APIClient()
        owner_client.force_authenticate(user=self.owner)

        anonymous_response: Any = anonymous_client.get("/api/v1/store/current/")
        regular_response: Any = regular_client.get("/api/v1/store/current/")
        owner_response: Any = owner_client.get("/api/v1/store/current/")

        self.assertEqual(anonymous_response.data, regular_response.data)
        self.assertEqual(anonymous_response.data, owner_response.data)

    def test_endpoint_ignores_malformed_authorization_header(self) -> None:
        """A public endpoint must not reject requests over a broken Bearer token."""
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION="Bearer not-a-real-token")

        response: Any = client.get("/api/v1/store/current/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)


class StoreMembershipCrossTenantIsolationTest(TestCase):
    """Guards the relational building block Etapa 3 isolation will rely on."""

    def setUp(self) -> None:
        self.store_a = Store.get_default()
        self.store_b = Store.objects.create(name="Loja B (futura)", slug="loja-b")
        self.user_a = User.objects.create_user(username="user_a", password="testpass123")
        self.user_b = User.objects.create_user(username="user_b", password="testpass123")
        StoreMembership.objects.create(
            store=self.store_a, user=self.user_a, role=StoreMembership.ROLE_OWNER
        )
        StoreMembership.objects.create(
            store=self.store_b, user=self.user_b, role=StoreMembership.ROLE_OWNER
        )

    def test_store_memberships_do_not_cross_tenants(self) -> None:
        store_a_member_ids = set(self.store_a.memberships.values_list("user_id", flat=True))
        store_b_member_ids = set(self.store_b.memberships.values_list("user_id", flat=True))

        self.assertEqual(store_a_member_ids, {self.user_a.id})
        self.assertEqual(store_b_member_ids, {self.user_b.id})
        self.assertTrue(store_a_member_ids.isdisjoint(store_b_member_ids))

    def test_user_membership_lookup_is_scoped_to_the_correct_store(self) -> None:
        self.assertFalse(
            StoreMembership.objects.filter(store=self.store_b, user=self.user_a).exists()
        )
        self.assertFalse(
            StoreMembership.objects.filter(store=self.store_a, user=self.user_b).exists()
        )

    def test_a_user_can_hold_independent_roles_in_different_stores(self) -> None:
        """Same user, two stores, two roles -- must not collapse into one record."""
        StoreMembership.objects.create(
            store=self.store_b, user=self.user_a, role=StoreMembership.ROLE_VIEWER
        )

        role_in_a = StoreMembership.objects.get(store=self.store_a, user=self.user_a).role
        role_in_b = StoreMembership.objects.get(store=self.store_b, user=self.user_a).role

        self.assertEqual(role_in_a, StoreMembership.ROLE_OWNER)
        self.assertEqual(role_in_b, StoreMembership.ROLE_VIEWER)
