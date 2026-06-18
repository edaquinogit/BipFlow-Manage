"""Etapa 1 of the multi-tenant evolution: Store/StoreMembership foundation.

pytest runs with --nomigrations (see pytest.ini), so the data migration that
backfills the default Store/StoreMembership rows in real deployments never
executes here. These tests instead verify the lazy-creation contract that
covers both paths: Store.get_default() and the public endpoint built on it.
"""
from typing import Any

from django.contrib.auth.models import User
from django.db import IntegrityError
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from bipdelivery.api.models import Store, StoreMembership


class CurrentStoreEndpointTest(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()

    def test_endpoint_is_public_and_resolves_default_store(self) -> None:
        """Anonymous requests should resolve the single-tenant default store."""
        response: Any = self.client.get("/api/v1/store/current/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["slug"], Store.DEFAULT_SLUG)
        self.assertEqual(response.data["name"], "Loja Principal")
        self.assertTrue(response.data["is_active"])

    def test_endpoint_is_idempotent(self) -> None:
        """Repeated reads should resolve to the same store, never duplicate it."""
        first: Any = self.client.get("/api/v1/store/current/")
        second: Any = self.client.get("/api/v1/store/current/")

        self.assertEqual(first.data["id"], second.data["id"])
        self.assertEqual(Store.objects.count(), 1)


class StoreModelTest(TestCase):
    def test_get_default_creates_lazily_when_missing(self) -> None:
        """Store.get_default() must not require the data migration to have run."""
        self.assertEqual(Store.objects.count(), 0)

        store = Store.get_default()

        self.assertEqual(store.slug, Store.DEFAULT_SLUG)
        self.assertEqual(Store.objects.count(), 1)

    def test_get_default_does_not_duplicate_on_repeated_calls(self) -> None:
        first = Store.get_default()
        second = Store.get_default()

        self.assertEqual(first.id, second.id)
        self.assertEqual(Store.objects.count(), 1)


class StoreMembershipTest(TestCase):
    def setUp(self) -> None:
        self.store = Store.get_default()
        self.user = User.objects.create_user(username="member", password="testpass123")

    def test_user_can_be_a_member_of_a_store(self) -> None:
        membership = StoreMembership.objects.create(
            store=self.store,
            user=self.user,
            role=StoreMembership.ROLE_MANAGER,
        )

        self.assertEqual(membership.role, "manager")
        self.assertIn(membership, self.store.memberships.all())
        self.assertIn(membership, self.user.store_memberships.all())

    def test_store_user_pair_is_unique(self) -> None:
        StoreMembership.objects.create(store=self.store, user=self.user, role=StoreMembership.ROLE_VIEWER)

        with self.assertRaises(IntegrityError):
            StoreMembership.objects.create(store=self.store, user=self.user, role=StoreMembership.ROLE_OWNER)


class BackfillRoleResolutionTest(TestCase):
    """Exercises the same role-precedence rules used by the 0013 data migration.

    The migration itself is not re-run under --nomigrations, so this test
    guards the precedence logic (superuser/staff/admin > manager > viewer)
    against regressions, independent of how it is wired into a migration.
    """

    def test_role_precedence_matches_migration_contract(self) -> None:
        import importlib

        migration = importlib.import_module(
            "bipdelivery.api.migrations.0013_backfill_default_store"
        )

        superuser = User(is_superuser=True, is_staff=False)
        staff_user = User(is_superuser=False, is_staff=True)
        manager_user = User(is_superuser=False, is_staff=False)
        viewer_user = User(is_superuser=False, is_staff=False)
        plain_user = User(is_superuser=False, is_staff=False)

        self.assertEqual(migration.resolve_role(superuser, set()), "owner")
        self.assertEqual(migration.resolve_role(staff_user, set()), "owner")
        self.assertEqual(migration.resolve_role(manager_user, {"manager"}), "manager")
        self.assertEqual(migration.resolve_role(viewer_user, {"viewer"}), "viewer")
        self.assertIsNone(migration.resolve_role(plain_user, set()))
        self.assertEqual(migration.resolve_role(plain_user, {"admin", "viewer"}), "owner")
