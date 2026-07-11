"""
Django admin (/admin/login/) MFA gate + rate limiting tests.

Uses django.test.Client, not rest_framework.test.APIClient: the admin login
is a regular Django form view (AdminAuthenticationForm), not a DRF APIView.
"""

import os
from typing import Any

import django
import pyotp
import pytest
from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import Client, TestCase, override_settings
from rest_framework.settings import api_settings
from rest_framework.throttling import SimpleRateThrottle

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "bipdelivery.core.settings")
django.setup()

from bipdelivery.api.models import LoginAttempt, MFABackupCode, TOTPDevice  # noqa: E402
from bipdelivery.tests.throttle_utils import rest_framework_with_rates  # noqa: E402

pytestmark = pytest.mark.django_db

ADMIN_LOGIN_URL = "/admin/login/"


class AdminMfaGateTest(TestCase):
    client: Client
    staff_user: User

    def setUp(self) -> None:
        cache.clear()
        self.client = Client()
        self.staff_user = User.objects.create_user(
            username="staffnomfa@example.com",
            email="staffnomfa@example.com",
            password="testpass123",
            is_staff=True,
        )

    def tearDown(self) -> None:
        cache.clear()

    @override_settings(ADMIN_MFA_ENFORCED=False)
    def test_staff_without_mfa_can_log_in_when_not_enforced(self) -> None:
        response: Any = self.client.post(
            ADMIN_LOGIN_URL,
            {"username": self.staff_user.username, "password": "testpass123"},
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(int(self.client.session["_auth_user_id"]), self.staff_user.id)

    @override_settings(ADMIN_MFA_ENFORCED=True)
    def test_staff_without_mfa_is_blocked_when_enforced(self) -> None:
        response: Any = self.client.post(
            ADMIN_LOGIN_URL,
            {"username": self.staff_user.username, "password": "testpass123"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("_auth_user_id", self.client.session)

    @override_settings(ADMIN_MFA_ENFORCED=False)
    def test_staff_with_confirmed_device_needs_a_correct_code_regardless_of_flag(self) -> None:
        secret = pyotp.random_base32()
        device = TOTPDevice(user=self.staff_user)
        device.set_secret(secret)
        device.confirmed = True
        device.save()

        wrong_code_response: Any = self.client.post(
            ADMIN_LOGIN_URL,
            {"username": self.staff_user.username, "password": "testpass123", "mfa_code": "000000"},
        )
        self.assertEqual(wrong_code_response.status_code, 200)
        self.assertNotIn("_auth_user_id", self.client.session)

        missing_code_response: Any = self.client.post(
            ADMIN_LOGIN_URL,
            {"username": self.staff_user.username, "password": "testpass123"},
        )
        self.assertEqual(missing_code_response.status_code, 200)
        self.assertNotIn("_auth_user_id", self.client.session)

        correct_response: Any = self.client.post(
            ADMIN_LOGIN_URL,
            {
                "username": self.staff_user.username,
                "password": "testpass123",
                "mfa_code": pyotp.TOTP(secret).now(),
            },
        )
        self.assertEqual(correct_response.status_code, 302)
        self.assertEqual(int(self.client.session["_auth_user_id"]), self.staff_user.id)

    def test_staff_with_confirmed_device_can_use_a_backup_code_once(self) -> None:
        secret = pyotp.random_base32()
        device = TOTPDevice(user=self.staff_user)
        device.set_secret(secret)
        device.confirmed = True
        device.save()
        backup_codes = MFABackupCode.generate_for_user(self.staff_user, count=3)

        response: Any = self.client.post(
            ADMIN_LOGIN_URL,
            {
                "username": self.staff_user.username,
                "password": "testpass123",
                "backup_code": backup_codes[0],
            },
        )
        self.assertEqual(response.status_code, 302)

        self.client.logout()
        second_response: Any = self.client.post(
            ADMIN_LOGIN_URL,
            {
                "username": self.staff_user.username,
                "password": "testpass123",
                "backup_code": backup_codes[0],
            },
        )
        self.assertEqual(second_response.status_code, 200)
        self.assertNotIn("_auth_user_id", self.client.session)

    def test_successful_login_is_recorded_in_login_attempt(self) -> None:
        self.client.post(
            ADMIN_LOGIN_URL,
            {"username": self.staff_user.username, "password": "testpass123"},
        )
        attempt = LoginAttempt.objects.order_by("-id").first()
        assert attempt is not None
        self.assertTrue(attempt.succeeded)
        self.assertEqual(attempt.user_id, self.staff_user.id)

    def test_failed_login_is_recorded_in_login_attempt(self) -> None:
        self.client.post(
            ADMIN_LOGIN_URL,
            {"username": self.staff_user.username, "password": "wrong-password"},
        )
        attempt = LoginAttempt.objects.order_by("-id").first()
        assert attempt is not None
        self.assertFalse(attempt.succeeded)
        self.assertEqual(attempt.failure_reason, LoginAttempt.FAILURE_INVALID_CREDENTIALS)


ADMIN_LOGIN_THROTTLE_TEST_REST_FRAMEWORK = rest_framework_with_rates(
    admin_login_ip="2/minute",
    admin_login_identity="2/minute",
)


class AdminLoginThrottlingTest(TestCase):
    client: Client
    staff_user: User

    def setUp(self) -> None:
        self.settings_override = override_settings(
            REST_FRAMEWORK=ADMIN_LOGIN_THROTTLE_TEST_REST_FRAMEWORK
        )
        self.settings_override.enable()
        api_settings.reload()
        self.original_throttle_rates = SimpleRateThrottle.THROTTLE_RATES
        SimpleRateThrottle.THROTTLE_RATES = settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]
        cache.clear()
        self.client = Client()
        self.staff_user = User.objects.create_user(
            username="throttleadmin@example.com",
            email="throttleadmin@example.com",
            password="testpass123",
            is_staff=True,
        )

    def tearDown(self) -> None:
        cache.clear()
        SimpleRateThrottle.THROTTLE_RATES = self.original_throttle_rates
        self.settings_override.disable()
        api_settings.reload()

    def test_admin_login_is_throttled_by_client_ip_across_usernames(self) -> None:
        for index in range(2):
            response: Any = self.client.post(
                ADMIN_LOGIN_URL,
                {"username": f"unknown-{index}@example.com", "password": "wrong-password"},
            )
            self.assertEqual(response.status_code, 200)

        response = self.client.post(
            ADMIN_LOGIN_URL,
            {"username": "unknown-final@example.com", "password": "wrong-password"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("Muitas tentativas", response.content.decode())

    def test_admin_login_is_throttled_by_submitted_identity_across_ips(self) -> None:
        payload = {"username": self.staff_user.username, "password": "wrong-password"}

        for index in range(2):
            response: Any = self.client.post(
                ADMIN_LOGIN_URL, payload, REMOTE_ADDR=f"198.51.100.{index + 1}"
            )
            self.assertEqual(response.status_code, 200)

        response = self.client.post(ADMIN_LOGIN_URL, payload, REMOTE_ADDR="198.51.100.10")
        self.assertEqual(response.status_code, 200)
        self.assertIn("Muitas tentativas", response.content.decode())
