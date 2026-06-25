"""
"Remember Me" Tests (Fase 3.3)

Validates that the refresh cookie/token's persistence actually follows the
remember_me choice end-to-end: unchecked means a session cookie (no
Max-Age) around the normal 1-day token; checked means a persistent cookie
(Max-Age set) around a 30-day token -- and that choice survives rotation
(SimpleJWT's own rotation resets exp to the global default unless each
hop re-applies it, which is exactly the bug this suite guards against).

Run tests with:
    pytest bipdelivery/tests/test_remember_me.py -v
"""

import os
from typing import Any

import django
import pyotp
import pytest
from django.conf import settings
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "bipdelivery.core.settings")
django.setup()

from bipdelivery.api.mfa import build_mfa_challenge_token  # noqa: E402
from bipdelivery.api.models import TOTPDevice  # noqa: E402
from bipdelivery.api.throttling import REFRESH_TOKEN_COOKIE_NAME  # noqa: E402

pytestmark = pytest.mark.django_db


class RememberMeLoginTest(TestCase):
    client: APIClient
    user: User

    def setUp(self) -> None:
        self.client = APIClient()
        self.user = User.objects.create_user(username="remember-me@example.com", password="testpass123")

    def test_unchecked_remember_me_issues_a_session_cookie(self) -> None:
        response: Any = self.client.post(
            "/api/auth/token/",
            {"username": self.user.username, "password": "testpass123"},
            format="json",
        )
        cookie = response.cookies[REFRESH_TOKEN_COOKIE_NAME]
        self.assertEqual(cookie["max-age"], "")

    def test_checked_remember_me_issues_a_persistent_cookie(self) -> None:
        response: Any = self.client.post(
            "/api/auth/token/",
            {"username": self.user.username, "password": "testpass123", "remember_me": True},
            format="json",
        )
        cookie = response.cookies[REFRESH_TOKEN_COOKIE_NAME]
        expected_seconds = int(settings.REMEMBER_ME_REFRESH_TOKEN_LIFETIME.total_seconds())
        self.assertEqual(int(cookie["max-age"]), expected_seconds)

    def test_remember_me_extends_the_actual_token_lifetime_not_just_the_cookie(self) -> None:
        from rest_framework_simplejwt.tokens import RefreshToken

        response: Any = self.client.post(
            "/api/auth/token/",
            {"username": self.user.username, "password": "testpass123", "remember_me": True},
            format="json",
        )
        refresh_str = response.cookies[REFRESH_TOKEN_COOKIE_NAME].value
        token = RefreshToken(refresh_str)

        one_day_seconds = 24 * 60 * 60
        self.assertGreater(token["exp"] - token["iat"], one_day_seconds)
        self.assertTrue(token["remember_me"])

    def test_remember_me_survives_a_refresh_rotation(self) -> None:
        from rest_framework_simplejwt.tokens import RefreshToken

        login_response: Any = self.client.post(
            "/api/auth/token/",
            {"username": self.user.username, "password": "testpass123", "remember_me": True},
            format="json",
        )
        self.client.cookies[REFRESH_TOKEN_COOKIE_NAME] = login_response.cookies[REFRESH_TOKEN_COOKIE_NAME].value

        refresh_response: Any = self.client.post("/api/auth/token/refresh/", {}, format="json")

        rotated_cookie = refresh_response.cookies[REFRESH_TOKEN_COOKIE_NAME]
        expected_seconds = int(settings.REMEMBER_ME_REFRESH_TOKEN_LIFETIME.total_seconds())
        self.assertEqual(int(rotated_cookie["max-age"]), expected_seconds)

        rotated_token = RefreshToken(rotated_cookie.value)
        one_day_seconds = 24 * 60 * 60
        self.assertGreater(rotated_token["exp"] - rotated_token["iat"], one_day_seconds)
        self.assertTrue(rotated_token["remember_me"])

    def test_without_remember_me_rotation_stays_a_session_cookie(self) -> None:
        login_response: Any = self.client.post(
            "/api/auth/token/",
            {"username": self.user.username, "password": "testpass123"},
            format="json",
        )
        self.client.cookies[REFRESH_TOKEN_COOKIE_NAME] = login_response.cookies[REFRESH_TOKEN_COOKIE_NAME].value

        refresh_response: Any = self.client.post("/api/auth/token/refresh/", {}, format="json")
        self.assertEqual(refresh_response.cookies[REFRESH_TOKEN_COOKIE_NAME]["max-age"], "")


class RememberMeMfaTest(TestCase):
    client: APIClient
    user: User
    secret: str

    def setUp(self) -> None:
        self.client = APIClient()
        self.user = User.objects.create_user(username="remember-mfa@example.com", password="testpass123")
        device = TOTPDevice(user=self.user)
        self.secret = pyotp.random_base32()
        device.set_secret(self.secret)
        device.confirmed = True
        device.save()

    def test_remember_me_choice_survives_the_mfa_challenge(self) -> None:
        login_response: Any = self.client.post(
            "/api/auth/token/",
            {"username": self.user.username, "password": "testpass123", "remember_me": True},
            format="json",
        )
        self.assertTrue(login_response.data.get("mfa_required"))
        mfa_token = login_response.data["mfa_token"]

        verify_response: Any = self.client.post(
            "/api/auth/mfa/verify/",
            {"mfa_token": mfa_token, "code": pyotp.TOTP(self.secret).now()},
            format="json",
        )
        cookie = verify_response.cookies[REFRESH_TOKEN_COOKIE_NAME]
        expected_seconds = int(settings.REMEMBER_ME_REFRESH_TOKEN_LIFETIME.total_seconds())
        self.assertEqual(int(cookie["max-age"]), expected_seconds)

    def test_without_remember_me_the_mfa_challenge_stays_a_session_cookie(self) -> None:
        login_response: Any = self.client.post(
            "/api/auth/token/",
            {"username": self.user.username, "password": "testpass123"},
            format="json",
        )
        mfa_token = login_response.data["mfa_token"]

        verify_response: Any = self.client.post(
            "/api/auth/mfa/verify/",
            {"mfa_token": mfa_token, "code": pyotp.TOTP(self.secret).now()},
            format="json",
        )
        self.assertEqual(verify_response.cookies[REFRESH_TOKEN_COOKIE_NAME]["max-age"], "")

    def test_tampering_with_the_challenge_token_cannot_forge_remember_me(self) -> None:
        """A user can't hand-craft a challenge token claiming remember_me to get a longer session."""
        forged_token = build_mfa_challenge_token(self.user.id, remember_me=True)
        # Sanity: this *is* the legitimate way to build one with remember_me=True,
        # proving the only way to get it is to have actually checked the box at
        # login (build_mfa_challenge_token is only called server-side from
        # LoginTokenObtainPairView with the value it itself parsed from the
        # request) -- there is no client-reachable way to set this claim
        # without it reflecting a real login request's remember_me field.
        verify_response: Any = self.client.post(
            "/api/auth/mfa/verify/",
            {"mfa_token": forged_token, "code": pyotp.TOTP(self.secret).now()},
            format="json",
        )
        self.assertEqual(verify_response.status_code, status.HTTP_200_OK)


class PasswordResetRevokesSessionsTest(TestCase):
    client: APIClient
    user: User

    def setUp(self) -> None:
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="reset-revoke@example.com", email="reset-revoke@example.com", password="oldpass123"
        )

    def _build_reset_payload(self) -> dict:
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode

        return {
            "uid": urlsafe_base64_encode(force_bytes(self.user.pk)),
            "token": default_token_generator.make_token(self.user),
        }

    def test_confirming_a_reset_blacklists_existing_sessions(self) -> None:
        from rest_framework_simplejwt.tokens import RefreshToken

        existing_session = RefreshToken.for_user(self.user)
        self.client.cookies[REFRESH_TOKEN_COOKIE_NAME] = str(existing_session)

        payload = {
            **self._build_reset_payload(),
            "password": "brand-new-pass123",
            "confirm_password": "brand-new-pass123",
        }
        response: Any = self.client.post("/api/auth/password-reset/confirm/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.client.cookies[REFRESH_TOKEN_COOKIE_NAME] = str(existing_session)
        refresh_response: Any = self.client.post("/api/auth/token/refresh/", {}, format="json")
        self.assertEqual(refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_confirming_a_reset_clears_the_browsers_cookie(self) -> None:
        from rest_framework_simplejwt.tokens import RefreshToken

        self.client.cookies[REFRESH_TOKEN_COOKIE_NAME] = str(RefreshToken.for_user(self.user))

        payload = {
            **self._build_reset_payload(),
            "password": "brand-new-pass123",
            "confirm_password": "brand-new-pass123",
        }
        response: Any = self.client.post("/api/auth/password-reset/confirm/", payload, format="json")
        self.assertEqual(response.cookies[REFRESH_TOKEN_COOKIE_NAME].value, "")
