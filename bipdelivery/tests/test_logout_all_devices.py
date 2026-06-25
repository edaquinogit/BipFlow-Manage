"""
Logout-All-Devices Tests (Fase 3.2)

Validates that POST /api/auth/logout-all/ revokes every outstanding refresh
token for the caller -- including ones minted in separate "sessions" the
caller isn't currently holding -- while leaving other users untouched.

Run tests with:
    pytest bipdelivery/tests/test_logout_all_devices.py -v
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

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "bipdelivery.core.settings")
django.setup()

from bipdelivery.api.throttling import REFRESH_TOKEN_COOKIE_NAME  # noqa: E402

pytestmark = pytest.mark.django_db


class LogoutAllDevicesTest(TestCase):
    client: APIClient
    user: User
    other_user: User

    def setUp(self) -> None:
        self.client = APIClient()
        self.user = User.objects.create_user(username="multi-device-user", password="testpass123")
        self.other_user = User.objects.create_user(username="other-device-user", password="testpass123")

    def test_logout_all_revokes_every_outstanding_token_for_the_user(self) -> None:
        # Three separate "sessions" (e.g. phone, laptop, tablet).
        session_a = RefreshToken.for_user(self.user)
        session_b = RefreshToken.for_user(self.user)
        session_c = RefreshToken.for_user(self.user)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {session_a.access_token}")
        response: Any = self.client.post("/api/auth/logout-all/", {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["revoked_count"], 3)

        self.client.credentials()
        for session in (session_a, session_b, session_c):
            self.client.cookies[REFRESH_TOKEN_COOKIE_NAME] = str(session)
            refresh_response: Any = self.client.post("/api/auth/token/refresh/", {}, format="json")
            self.assertEqual(refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_all_requires_authentication(self) -> None:
        response: Any = self.client.post("/api/auth/logout-all/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_all_does_not_affect_other_users_sessions(self) -> None:
        my_session = RefreshToken.for_user(self.user)
        other_session = RefreshToken.for_user(self.other_user)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {my_session.access_token}")
        self.client.post("/api/auth/logout-all/", {}, format="json")

        self.client.credentials()
        self.client.cookies[REFRESH_TOKEN_COOKIE_NAME] = str(other_session)
        other_refresh_response: Any = self.client.post("/api/auth/token/refresh/", {}, format="json")
        self.assertEqual(other_refresh_response.status_code, status.HTTP_200_OK)

    def test_logout_all_is_idempotent(self) -> None:
        """Calling it twice (e.g. a retried request) must not error on the unique constraint."""
        session = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {session.access_token}")

        first: Any = self.client.post("/api/auth/logout-all/", {}, format="json")
        second: Any = self.client.post("/api/auth/logout-all/", {}, format="json")

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data["revoked_count"], 1)
        self.assertEqual(second.data["revoked_count"], 0)

    def test_logout_all_clears_the_refresh_cookie(self) -> None:
        session = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {session.access_token}")
        self.client.cookies[REFRESH_TOKEN_COOKIE_NAME] = str(session)

        response: Any = self.client.post("/api/auth/logout-all/", {}, format="json")
        self.assertEqual(response.cookies[REFRESH_TOKEN_COOKIE_NAME].value, "")
