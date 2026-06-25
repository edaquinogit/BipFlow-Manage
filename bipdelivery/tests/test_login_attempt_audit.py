"""
Login Attempt Audit Tests

Validates that every login outcome -- success, bad credentials, and
throttled -- is recorded to LoginAttempt with the right identifier/outcome,
since that table is what the conditional CAPTCHA gate (Fase 2.3) reads from.

Run tests with:
    pytest bipdelivery/tests/test_login_attempt_audit.py -v
"""

import os
from typing import Any

import django
import pytest
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "bipdelivery.core.settings")
django.setup()

from bipdelivery.api.models import LoginAttempt  # noqa: E402
from bipdelivery.tests.throttle_utils import rest_framework_with_rates  # noqa: E402

pytestmark = pytest.mark.django_db


class LoginAttemptAuditTest(TestCase):
    client: APIClient
    user: User

    def setUp(self) -> None:
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="audited@example.com",
            email="audited@example.com",
            password="securepass123",
        )

    def test_successful_login_is_recorded(self) -> None:
        response: Any = self.client.post(
            "/api/auth/token/",
            {"username": "audited@example.com", "password": "securepass123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        attempt = LoginAttempt.objects.order_by("-id").first()
        self.assertTrue(attempt.succeeded)
        self.assertEqual(attempt.failure_reason, "")
        self.assertEqual(attempt.identifier, "audited@example.com")
        self.assertEqual(attempt.user_id, self.user.id)

    def test_invalid_credentials_are_recorded(self) -> None:
        response: Any = self.client.post(
            "/api/auth/token/",
            {"username": "audited@example.com", "password": "wrong-password"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        attempt = LoginAttempt.objects.order_by("-id").first()
        self.assertFalse(attempt.succeeded)
        self.assertEqual(attempt.failure_reason, LoginAttempt.FAILURE_INVALID_CREDENTIALS)
        self.assertIsNone(attempt.user_id)

    def test_unknown_identifier_is_recorded_with_null_user(self) -> None:
        response: Any = self.client.post(
            "/api/auth/token/",
            {"username": "nobody@example.com", "password": "whatever"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        attempt = LoginAttempt.objects.order_by("-id").first()
        self.assertEqual(attempt.identifier, "nobody@example.com")
        self.assertIsNone(attempt.user_id)

    def test_identifier_is_normalized_to_lowercase(self) -> None:
        self.client.post(
            "/api/auth/token/",
            {"username": "AUDITED@EXAMPLE.COM", "password": "securepass123"},
            format="json",
        )

        attempt = LoginAttempt.objects.order_by("-id").first()
        self.assertEqual(attempt.identifier, "audited@example.com")

    def test_throttled_attempt_is_recorded(self) -> None:
        throttled_settings = rest_framework_with_rates(auth_ip="1/minute", auth_login_identity="100/minute")
        with override_settings(REST_FRAMEWORK=throttled_settings):
            from rest_framework.settings import api_settings
            from rest_framework.throttling import SimpleRateThrottle
            from django.core.cache import cache

            api_settings.reload()
            original_rates = SimpleRateThrottle.THROTTLE_RATES
            SimpleRateThrottle.THROTTLE_RATES = throttled_settings["DEFAULT_THROTTLE_RATES"]
            cache.clear()
            try:
                payload = {"username": "audited@example.com", "password": "wrong-password"}
                self.client.post("/api/auth/token/", payload, format="json")
                response: Any = self.client.post("/api/auth/token/", payload, format="json")

                self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
                attempt = LoginAttempt.objects.order_by("-id").first()
                self.assertFalse(attempt.succeeded)
                self.assertEqual(attempt.failure_reason, LoginAttempt.FAILURE_THROTTLED)
            finally:
                SimpleRateThrottle.THROTTLE_RATES = original_rates
                cache.clear()
                api_settings.reload()

    def test_recent_failure_count_only_counts_failures_within_window(self) -> None:
        LoginAttempt.record(identifier="audited@example.com", ip_address="127.0.0.1", succeeded=False)
        LoginAttempt.record(identifier="audited@example.com", ip_address="127.0.0.1", succeeded=False)
        LoginAttempt.record(identifier="audited@example.com", ip_address="127.0.0.1", succeeded=True)

        self.assertEqual(LoginAttempt.recent_failure_count("audited@example.com"), 2)
        self.assertEqual(LoginAttempt.recent_failure_count("AUDITED@example.com"), 2)
        self.assertEqual(LoginAttempt.recent_failure_count("someone-else@example.com"), 0)
