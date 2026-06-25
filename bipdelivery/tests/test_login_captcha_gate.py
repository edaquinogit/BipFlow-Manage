"""
Conditional Login CAPTCHA Gate Tests (Fase 2.3)

The view-level tests mock `verify_turnstile` so the suite doesn't depend on
network access to Cloudflare on every run. `test_verify_turnstile_against_real_cloudflare_test_endpoint`
is the one test that actually exercises the HTTP plumbing in captcha.py
against Cloudflare's published test keys -- it needs network access.

Run tests with:
    pytest bipdelivery/tests/test_login_captcha_gate.py -v
"""

import os
from typing import Any
from unittest.mock import patch

import django
import pytest
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "bipdelivery.core.settings")
django.setup()

from bipdelivery.api.captcha import verify_turnstile  # noqa: E402
from bipdelivery.api.models import LoginAttempt  # noqa: E402
from bipdelivery.tests.throttle_utils import rest_framework_with_rates  # noqa: E402

pytestmark = pytest.mark.django_db

# Generous so DRF's own login throttle never interferes with these tests --
# the CAPTCHA gate is a separate mechanism from (and sits in front of) the
# IP/identity throttles, and each test fires several requests at the same
# identifier on purpose.
GENEROUS_THROTTLE_SETTINGS = rest_framework_with_rates(
    auth_ip="1000/minute", auth_login_identity="1000/minute"
)


@override_settings(LOGIN_CAPTCHA_FAILURE_THRESHOLD=3, REST_FRAMEWORK=GENEROUS_THROTTLE_SETTINGS)
class LoginCaptchaGateTest(TestCase):
    client: APIClient
    user: User

    def setUp(self) -> None:
        from rest_framework.settings import api_settings
        from rest_framework.throttling import SimpleRateThrottle

        api_settings.reload()
        self.original_throttle_rates = SimpleRateThrottle.THROTTLE_RATES
        SimpleRateThrottle.THROTTLE_RATES = GENEROUS_THROTTLE_SETTINGS["DEFAULT_THROTTLE_RATES"]
        cache.clear()

        self.client = APIClient()
        self.user = User.objects.create_user(
            username="captcha-test@example.com",
            email="captcha-test@example.com",
            password="securepass123",
        )

    def tearDown(self) -> None:
        from rest_framework.settings import api_settings
        from rest_framework.throttling import SimpleRateThrottle

        cache.clear()
        SimpleRateThrottle.THROTTLE_RATES = self.original_throttle_rates
        api_settings.reload()

    def _fail_login(self, times: int) -> None:
        for _ in range(times):
            self.client.post(
                "/api/auth/token/",
                {"username": "captcha-test@example.com", "password": "wrong-password"},
                format="json",
            )

    def test_login_proceeds_without_captcha_below_threshold(self) -> None:
        self._fail_login(2)  # threshold is 3

        response: Any = self.client.post(
            "/api/auth/token/",
            {"username": "captcha-test@example.com", "password": "securepass123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @patch("bipdelivery.api.views.verify_turnstile", return_value=False)
    def test_login_requires_captcha_at_threshold(self, mock_verify) -> None:
        self._fail_login(3)

        response: Any = self.client.post(
            "/api/auth/token/",
            {"username": "captcha-test@example.com", "password": "securepass123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(response.data.get("details", {}).get("requires_captcha"))
        mock_verify.assert_called_once()

        # order_by("-id") rather than .latest("created_at"): several requests
        # in this test land within the same auto_now_add timestamp tick, so
        # only insertion order (id) reliably identifies the newest row.
        attempt = LoginAttempt.objects.order_by("-id").first()
        self.assertEqual(attempt.failure_reason, LoginAttempt.FAILURE_CAPTCHA_REQUIRED)

    @patch("bipdelivery.api.views.verify_turnstile", return_value=False)
    def test_correct_password_without_captcha_still_blocked_at_threshold(self, mock_verify) -> None:
        """Above the threshold, even the right password isn't enough without a valid captcha."""
        self._fail_login(3)

        response: Any = self.client.post(
            "/api/auth/token/",
            {"username": "captcha-test@example.com", "password": "securepass123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(response.data.get("details", {}).get("requires_captcha"))

    @patch("bipdelivery.api.views.verify_turnstile", return_value=True)
    def test_login_succeeds_at_threshold_with_valid_captcha(self, mock_verify) -> None:
        self._fail_login(3)

        response: Any = self.client.post(
            "/api/auth/token/",
            {
                "username": "captcha-test@example.com",
                "password": "securepass123",
                "captcha_token": "a-valid-looking-token",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_verify.assert_called_once()

    @patch("bipdelivery.api.views.verify_turnstile", return_value=True)
    def test_successful_login_resets_the_failure_count(self, mock_verify) -> None:
        self._fail_login(3)
        self.client.post(
            "/api/auth/token/",
            {
                "username": "captcha-test@example.com",
                "password": "securepass123",
                "captcha_token": "a-valid-looking-token",
            },
            format="json",
        )

        # A fresh failure right after a success should not immediately
        # require captcha again -- the count looks at a rolling window of
        # *failures*, and the prior failures are now old news for this check
        # because a success happened, but recent_failure_count only counts
        # `succeeded=False` rows regardless of an interleaved success. This
        # test documents that the threshold is about *failure density*, not
        # a strict consecutive-failures-since-last-success counter.
        response: Any = self.client.post(
            "/api/auth/token/",
            {"username": "captcha-test@example.com", "password": "wrong-password"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class TurnstileVerificationTest(TestCase):
    """Exercises captcha.py's actual HTTP call against Cloudflare's published test endpoint.

    Requires network access. Uses Cloudflare's officially documented
    always-pass/always-fail test secrets -- not real production credentials.
    """

    @override_settings(TURNSTILE_SECRET_KEY="1x0000000000000000000000000000000AA")
    def test_always_pass_test_secret_accepts_any_token(self) -> None:
        result = verify_turnstile("XXXX.DUMMY.TOKEN.XXXX", "127.0.0.1")
        self.assertTrue(result)

    @override_settings(TURNSTILE_SECRET_KEY="2x0000000000000000000000000000000AA")
    def test_always_fail_test_secret_rejects_any_token(self) -> None:
        result = verify_turnstile("XXXX.DUMMY.TOKEN.XXXX", "127.0.0.1")
        self.assertFalse(result)

    def test_missing_token_is_rejected_without_a_network_call(self) -> None:
        self.assertFalse(verify_turnstile(None, "127.0.0.1"))
        self.assertFalse(verify_turnstile("", "127.0.0.1"))

    @override_settings(TURNSTILE_SECRET_KEY="")
    def test_missing_secret_key_fails_closed(self) -> None:
        self.assertFalse(verify_turnstile("XXXX.DUMMY.TOKEN.XXXX", "127.0.0.1"))
