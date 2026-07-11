"""
MFA Endpoint Tests (Fase 3.1)

Covers the full lifecycle: setup -> confirm -> a real login that gets
gated into a two-step challenge -> verify with a TOTP code or a backup
code -> disable. Each step is the actual HTTP contract the frontend uses,
not just the model layer (already covered in test_mfa_models.py).

Run tests with:
    pytest bipdelivery/tests/test_mfa_endpoints.py -v
"""

import os
from typing import Any

import django
import pyotp
import pytest
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "bipdelivery.core.settings")
django.setup()

from bipdelivery.api.mfa import build_mfa_challenge_token  # noqa: E402
from bipdelivery.api.models import LoginAttempt, MFABackupCode, TOTPDevice  # noqa: E402
from bipdelivery.api.throttling import REFRESH_TOKEN_COOKIE_NAME  # noqa: E402

pytestmark = pytest.mark.django_db


class MfaSetupFlowTest(TestCase):
    client: APIClient
    user: User

    def setUp(self) -> None:
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="mfa-setup@example.com", email="mfa-setup@example.com", password="testpass123"
        )
        tokens = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens.access_token}")

    def test_setup_requires_authentication(self) -> None:
        anon_client = APIClient()
        response: Any = anon_client.post("/api/auth/mfa/setup/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_setup_returns_secret_and_qr_code(self) -> None:
        response: Any = self.client.post("/api/auth/mfa/setup/", {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("secret", response.data)
        self.assertIn("provisioning_uri", response.data)
        self.assertTrue(response.data["qr_code"].startswith("data:image/png;base64,"))

        device = TOTPDevice.objects.get(user=self.user)
        self.assertFalse(device.confirmed)
        self.assertEqual(device.get_secret(), response.data["secret"])

    def test_confirm_without_pending_setup_is_rejected(self) -> None:
        response: Any = self.client.post("/api/auth/mfa/setup/confirm/", {"code": "123456"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_confirm_with_wrong_code_is_rejected(self) -> None:
        self.client.post("/api/auth/mfa/setup/", {}, format="json")

        response: Any = self.client.post("/api/auth/mfa/setup/confirm/", {"code": "000000"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(TOTPDevice.objects.get(user=self.user).confirmed)

    def test_confirm_with_correct_code_activates_mfa_and_issues_backup_codes(self) -> None:
        setup_response: Any = self.client.post("/api/auth/mfa/setup/", {}, format="json")
        secret = setup_response.data["secret"]
        current_code = pyotp.TOTP(secret).now()

        response: Any = self.client.post(
            "/api/auth/mfa/setup/confirm/", {"code": current_code}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["backup_codes"]), 8)

        device = TOTPDevice.objects.get(user=self.user)
        self.assertTrue(device.confirmed)
        self.assertIsNotNone(device.confirmed_at)

    def test_setup_refuses_to_overwrite_a_confirmed_device(self) -> None:
        setup_response: Any = self.client.post("/api/auth/mfa/setup/", {}, format="json")
        secret = setup_response.data["secret"]
        self.client.post(
            "/api/auth/mfa/setup/confirm/", {"code": pyotp.TOTP(secret).now()}, format="json"
        )

        response: Any = self.client.post("/api/auth/mfa/setup/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_disable_requires_correct_password(self) -> None:
        setup_response: Any = self.client.post("/api/auth/mfa/setup/", {}, format="json")
        secret = setup_response.data["secret"]
        self.client.post(
            "/api/auth/mfa/setup/confirm/", {"code": pyotp.TOTP(secret).now()}, format="json"
        )

        wrong_password_response: Any = self.client.post(
            "/api/auth/mfa/disable/",
            {"password": "not-the-password", "code": pyotp.TOTP(secret).now()},
            format="json",
        )
        self.assertEqual(wrong_password_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(TOTPDevice.objects.filter(user=self.user, confirmed=True).exists())

        response: Any = self.client.post(
            "/api/auth/mfa/disable/",
            {"password": "testpass123", "code": pyotp.TOTP(secret).now()},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(TOTPDevice.objects.filter(user=self.user).exists())
        self.assertFalse(MFABackupCode.objects.filter(user=self.user).exists())

    def test_disable_rejects_correct_password_without_totp_code(self) -> None:
        setup_response: Any = self.client.post("/api/auth/mfa/setup/", {}, format="json")
        secret = setup_response.data["secret"]
        self.client.post(
            "/api/auth/mfa/setup/confirm/", {"code": pyotp.TOTP(secret).now()}, format="json"
        )

        response: Any = self.client.post(
            "/api/auth/mfa/disable/", {"password": "testpass123"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(TOTPDevice.objects.filter(user=self.user, confirmed=True).exists())

    def test_disable_accepts_valid_backup_code_instead_of_totp_code(self) -> None:
        setup_response: Any = self.client.post("/api/auth/mfa/setup/", {}, format="json")
        secret = setup_response.data["secret"]
        confirm_response: Any = self.client.post(
            "/api/auth/mfa/setup/confirm/", {"code": pyotp.TOTP(secret).now()}, format="json"
        )
        backup_code = confirm_response.data["backup_codes"][0]

        response: Any = self.client.post(
            "/api/auth/mfa/disable/",
            {"password": "testpass123", "backup_code": backup_code},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(TOTPDevice.objects.filter(user=self.user).exists())

    def test_disable_without_a_confirmed_device_only_needs_password(self) -> None:
        # No TOTPDevice exists at all -- nothing to step up against.
        response: Any = self.client.post(
            "/api/auth/mfa/disable/", {"password": "testpass123"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_current_user_reflects_mfa_enabled_state(self) -> None:
        before: Any = self.client.get("/api/auth/me/")
        self.assertFalse(before.data["mfa_enabled"])

        setup_response: Any = self.client.post("/api/auth/mfa/setup/", {}, format="json")
        secret = setup_response.data["secret"]
        self.client.post(
            "/api/auth/mfa/setup/confirm/", {"code": pyotp.TOTP(secret).now()}, format="json"
        )

        after: Any = self.client.get("/api/auth/me/")
        self.assertTrue(after.data["mfa_enabled"])


class MfaLoginFlowTest(TestCase):
    """End-to-end: a user with MFA enabled cannot get real tokens from /auth/token/ alone."""

    client: APIClient
    user: User
    secret: str

    def setUp(self) -> None:
        from django.core.cache import cache

        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="mfa-login@example.com", email="mfa-login@example.com", password="testpass123"
        )
        device = TOTPDevice(user=self.user)
        self.secret = pyotp.random_base32()
        device.set_secret(self.secret)
        device.confirmed = True
        device.save()

    def test_login_with_correct_password_returns_mfa_challenge_not_tokens(self) -> None:
        response: Any = self.client.post(
            "/api/auth/token/",
            {"username": self.user.username, "password": "testpass123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get("mfa_required"))
        self.assertIn("mfa_token", response.data)
        self.assertNotIn("access", response.data)
        self.assertNotIn(REFRESH_TOKEN_COOKIE_NAME, response.cookies)

    def test_login_with_wrong_password_still_fails_normally(self) -> None:
        response: Any = self.client.post(
            "/api/auth/token/",
            {"username": self.user.username, "password": "wrong-password"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_verify_with_correct_totp_code_issues_real_tokens(self) -> None:
        login_response: Any = self.client.post(
            "/api/auth/token/",
            {"username": self.user.username, "password": "testpass123"},
            format="json",
        )
        mfa_token = login_response.data["mfa_token"]

        response: Any = self.client.post(
            "/api/auth/mfa/verify/",
            {"mfa_token": mfa_token, "code": pyotp.TOTP(self.secret).now()},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn(REFRESH_TOKEN_COOKIE_NAME, response.cookies)

    def test_verify_with_wrong_code_is_rejected(self) -> None:
        mfa_token = build_mfa_challenge_token(self.user.id)

        response: Any = self.client.post(
            "/api/auth/mfa/verify/", {"mfa_token": mfa_token, "code": "000000"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        attempt = LoginAttempt.objects.order_by("-id").first()
        self.assertEqual(attempt.failure_reason, LoginAttempt.FAILURE_MFA_INVALID)

    def test_verify_with_tampered_mfa_token_is_rejected(self) -> None:
        response: Any = self.client.post(
            "/api/auth/mfa/verify/",
            {"mfa_token": "not-a-real-token", "code": "123456"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_verify_rejects_a_replayed_mfa_token_even_with_the_still_valid_code(self) -> None:
        mfa_token = build_mfa_challenge_token(self.user.id)
        code = pyotp.TOTP(self.secret).now()

        first_response: Any = self.client.post(
            "/api/auth/mfa/verify/",
            {"mfa_token": mfa_token, "code": code},
            format="json",
        )
        self.assertEqual(first_response.status_code, status.HTTP_200_OK)

        replay_response: Any = self.client.post(
            "/api/auth/mfa/verify/",
            {"mfa_token": mfa_token, "code": code},
            format="json",
        )
        self.assertEqual(replay_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_verify_with_valid_backup_code_issues_real_tokens_and_consumes_it(self) -> None:
        backup_codes = MFABackupCode.generate_for_user(self.user, count=3)
        mfa_token = build_mfa_challenge_token(self.user.id)

        response: Any = self.client.post(
            "/api/auth/mfa/verify/",
            {"mfa_token": mfa_token, "backup_code": backup_codes[0]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)

        # Same backup code must not work twice.
        second_token = build_mfa_challenge_token(self.user.id)
        second_response: Any = self.client.post(
            "/api/auth/mfa/verify/",
            {"mfa_token": second_token, "backup_code": backup_codes[0]},
            format="json",
        )
        self.assertEqual(second_response.status_code, status.HTTP_400_BAD_REQUEST)
