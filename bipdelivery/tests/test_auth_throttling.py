"""
Authentication endpoint throttling tests.

These tests keep the production defaults independent from the assertions by
overriding throttle rates to small windows and clearing Django's cache between
cases.
"""

import os
from copy import deepcopy
from typing import Any

import django
import pytest
from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.settings import api_settings
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.test import APIClient

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "bipdelivery.core.settings")
django.setup()

pytestmark = pytest.mark.django_db


def rest_framework_with_rates(**rates: str) -> dict[str, Any]:
    rest_framework_settings = deepcopy(settings.REST_FRAMEWORK)
    default_rates = rest_framework_settings.get("DEFAULT_THROTTLE_RATES", {}).copy()
    default_rates.update(rates)
    rest_framework_settings["DEFAULT_THROTTLE_RATES"] = default_rates
    return rest_framework_settings


AUTH_THROTTLE_TEST_REST_FRAMEWORK = rest_framework_with_rates(
    auth_ip="2/minute",
    auth_login_identity="2/minute",
    auth_register_identity="1/minute",
    auth_password_reset_identity="1/minute",
    auth_password_reset_confirm_identity="1/minute",
    auth_token_refresh_ip="20/minute",
    auth_token_refresh_identity="1/minute",
)


class AuthEndpointThrottlingTest(TestCase):
    client: APIClient
    user: User

    def setUp(self) -> None:
        self.settings_override = override_settings(REST_FRAMEWORK=AUTH_THROTTLE_TEST_REST_FRAMEWORK)
        self.settings_override.enable()
        api_settings.reload()
        self.original_throttle_rates = SimpleRateThrottle.THROTTLE_RATES
        SimpleRateThrottle.THROTTLE_RATES = settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="admin@example.com",
            email="admin@example.com",
            password="securepass123",
        )

    def tearDown(self) -> None:
        cache.clear()
        SimpleRateThrottle.THROTTLE_RATES = self.original_throttle_rates
        self.settings_override.disable()
        api_settings.reload()

    def test_login_is_throttled_by_client_ip(self) -> None:
        payload = {"username": "unknown@example.com", "password": "wrong-password"}

        for _ in range(2):
            response: Any = self.client.post("/api/auth/token/", payload, format="json")
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        response = self.client.post("/api/auth/token/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn("Retry-After", response)

    def test_login_is_throttled_by_submitted_identity_across_ips(self) -> None:
        payload = {"username": self.user.username, "password": "wrong-password"}

        for index in range(2):
            response: Any = self.client.post(
                "/api/auth/token/",
                payload,
                format="json",
                REMOTE_ADDR=f"198.51.100.{index + 1}",
            )
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        response = self.client.post(
            "/api/auth/token/",
            payload,
            format="json",
            REMOTE_ADDR="198.51.100.10",
        )

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_register_is_throttled_by_submitted_email(self) -> None:
        payload = {
            "email": "new-user@example.com",
            "password": "short",
            "confirm_password": "short",
        }

        response: Any = self.client.post("/api/auth/register/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        response = self.client.post(
            "/api/auth/register/",
            payload,
            format="json",
            REMOTE_ADDR="198.51.100.20",
        )

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_password_reset_request_is_throttled_by_submitted_email(self) -> None:
        payload = {"email": "customer@example.com"}

        response: Any = self.client.post("/api/auth/password-reset/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.post(
            "/api/auth/password-reset/",
            payload,
            format="json",
            REMOTE_ADDR="198.51.100.30",
        )

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_password_reset_confirm_is_throttled_by_submitted_uid(self) -> None:
        payload = {
            "uid": urlsafe_base64_encode(force_bytes(9999)),
            "token": "invalid-token",
            "password": "new-secure-pass123",
            "confirm_password": "new-secure-pass123",
        }

        response: Any = self.client.post(
            "/api/auth/password-reset/confirm/",
            payload,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        response = self.client.post(
            "/api/auth/password-reset/confirm/",
            payload,
            format="json",
            REMOTE_ADDR="198.51.100.40",
        )

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_token_refresh_is_throttled_by_submitted_refresh_token(self) -> None:
        payload = {"refresh": "invalid-refresh-token"}

        response: Any = self.client.post("/api/auth/token/refresh/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        response = self.client.post(
            "/api/auth/token/refresh/",
            payload,
            format="json",
            REMOTE_ADDR="198.51.100.50",
        )

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
