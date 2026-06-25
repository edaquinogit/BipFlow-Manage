"""
Logout / Refresh Token Revocation Tests

Validates that POST /api/auth/logout/ actually revokes the refresh token
(not just a client-side no-op) and that the endpoint rejects requests that
don't belong to the authenticated caller.

The refresh token travels exclusively via the httpOnly `refresh_token`
cookie (never the request body), so every test sets/reads that cookie
through `self.client.cookies` instead of the POST payload.

Run tests with:
    pytest bipdelivery/tests/test_logout_flow.py -v
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


class LogoutFlowTest(TestCase):
    client: APIClient
    user: User
    other_user: User

    def setUp(self) -> None:
        self.client = APIClient()
        self.user = User.objects.create_user(username="logout-user", password="testpass123")
        self.other_user = User.objects.create_user(username="other-user", password="testpass123")

    def _set_refresh_cookie(self, refresh: str) -> None:
        self.client.cookies[REFRESH_TOKEN_COOKIE_NAME] = refresh

    def _authenticate(self, user: User) -> RefreshToken:
        tokens = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens.access_token}")
        return tokens

    def test_logout_revokes_the_refresh_token(self) -> None:
        tokens = self._authenticate(self.user)
        refresh_str = str(tokens)
        self._set_refresh_cookie(refresh_str)

        response: Any = self.client.post("/api/auth/logout/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # logout's Set-Cookie already cleared the cookie in this client's jar
        # (the real-world, non-adversarial case). To prove the token itself
        # is dead server-side -- not just absent client-side -- replay the
        # captured value directly, as a stale tab or a token thief would.
        self.client.credentials()  # drop the now-irrelevant access token header
        self._set_refresh_cookie(refresh_str)
        refresh_response: Any = self.client.post("/api/auth/token/refresh/", {}, format="json")
        self.assertEqual(refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_clears_the_cookie(self) -> None:
        tokens = self._authenticate(self.user)
        self._set_refresh_cookie(str(tokens))

        response: Any = self.client.post("/api/auth/logout/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.cookies[REFRESH_TOKEN_COOKIE_NAME].value, "")

    def test_logout_requires_authentication(self) -> None:
        tokens = RefreshToken.for_user(self.user)
        self._set_refresh_cookie(str(tokens))

        response: Any = self.client.post("/api/auth/logout/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_requires_refresh_cookie(self) -> None:
        self._authenticate(self.user)

        response: Any = self.client.post("/api/auth/logout/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_logout_rejects_garbage_refresh_token(self) -> None:
        self._authenticate(self.user)
        self._set_refresh_cookie("not-a-real-token")

        response: Any = self.client.post("/api/auth/logout/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_logout_rejects_another_users_refresh_token(self) -> None:
        """A caller authenticated as user A must not be able to blacklist user B's token."""
        other_tokens = RefreshToken.for_user(self.other_user)
        self._authenticate(self.user)
        self._set_refresh_cookie(str(other_tokens))

        response: Any = self.client.post("/api/auth/logout/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # The other user's token must remain usable.
        self.client.credentials()
        self._set_refresh_cookie(str(other_tokens))
        refresh_response: Any = self.client.post("/api/auth/token/refresh/", {}, format="json")
        self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)

    def test_logout_after_real_login_blocks_the_issued_refresh_token(self) -> None:
        """End-to-end: login -> logout -> the issued refresh cookie is dead."""
        login_response: Any = self.client.post(
            "/api/auth/token/",
            {"username": self.user.username, "password": "testpass123"},
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        access = login_response.data["access"]
        self.assertNotIn("refresh", login_response.data)
        issued_refresh = login_response.cookies[REFRESH_TOKEN_COOKIE_NAME].value

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        logout_response: Any = self.client.post("/api/auth/logout/", {}, format="json")
        self.assertEqual(logout_response.status_code, status.HTTP_200_OK)

        self.client.credentials()
        self._set_refresh_cookie(issued_refresh)
        refresh_response: Any = self.client.post("/api/auth/token/refresh/", {}, format="json")
        self.assertEqual(refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)
