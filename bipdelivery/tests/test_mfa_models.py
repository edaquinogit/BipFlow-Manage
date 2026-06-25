"""
MFA Model and Helper Tests (Fase 3.1)

Covers the building blocks before the endpoints are layered on top:
- TOTPDevice's secret encryption round-trip (crypto.py)
- MFABackupCode generation, single-use consumption, and hashing
- mfa.py's challenge token signing and TOTP code verification

Run tests with:
    pytest bipdelivery/tests/test_mfa_models.py -v
"""

import os

import django
import pyotp
import pytest
from django.contrib.auth.models import User
from django.test import TestCase

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "bipdelivery.core.settings")
django.setup()

from bipdelivery.api.mfa import (  # noqa: E402
    build_mfa_challenge_token,
    generate_totp_secret,
    read_mfa_challenge_payload,
    verify_totp_code,
)
from bipdelivery.api.models import MFABackupCode, TOTPDevice  # noqa: E402

pytestmark = pytest.mark.django_db


class TOTPDeviceEncryptionTest(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(username="mfa-user", password="testpass123")

    def test_secret_round_trips_through_encryption(self) -> None:
        device = TOTPDevice(user=self.user)
        device.set_secret("JBSWY3DPEHPK3PXP")
        device.save()

        reloaded = TOTPDevice.objects.get(pk=device.pk)
        self.assertEqual(reloaded.get_secret(), "JBSWY3DPEHPK3PXP")

    def test_secret_is_not_stored_in_plaintext(self) -> None:
        device = TOTPDevice(user=self.user)
        device.set_secret("JBSWY3DPEHPK3PXP")
        device.save()

        self.assertNotIn(b"JBSWY3DPEHPK3PXP", bytes(device.encrypted_secret))


class MFABackupCodeTest(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(username="backup-code-user", password="testpass123")
        self.other_user = User.objects.create_user(username="other-user", password="testpass123")

    def test_generate_for_user_returns_usable_plaintext_codes(self) -> None:
        codes = MFABackupCode.generate_for_user(self.user, count=8)

        self.assertEqual(len(codes), 8)
        self.assertEqual(len(set(codes)), 8)  # no duplicates
        for code in codes:
            self.assertRegex(code, r"^[A-Z0-9]{4}-[A-Z0-9]{4}$")

    def test_codes_are_hashed_not_stored_in_plaintext(self) -> None:
        codes = MFABackupCode.generate_for_user(self.user, count=1)

        stored = MFABackupCode.objects.get(user=self.user)
        self.assertNotEqual(stored.code_hash, codes[0])

    def test_consume_accepts_a_valid_unused_code_once(self) -> None:
        codes = MFABackupCode.generate_for_user(self.user, count=3)
        target_code = codes[0]

        self.assertTrue(MFABackupCode.consume(self.user, target_code))
        # Same code again must fail -- single use.
        self.assertFalse(MFABackupCode.consume(self.user, target_code))

    def test_consume_is_case_insensitive(self) -> None:
        codes = MFABackupCode.generate_for_user(self.user, count=1)
        self.assertTrue(MFABackupCode.consume(self.user, codes[0].lower()))

    def test_consume_rejects_another_users_code(self) -> None:
        codes = MFABackupCode.generate_for_user(self.user, count=1)
        self.assertFalse(MFABackupCode.consume(self.other_user, codes[0]))

    def test_generate_for_user_replaces_previous_codes(self) -> None:
        old_codes = MFABackupCode.generate_for_user(self.user, count=3)
        MFABackupCode.generate_for_user(self.user, count=3)

        self.assertFalse(MFABackupCode.consume(self.user, old_codes[0]))
        self.assertEqual(MFABackupCode.objects.filter(user=self.user).count(), 3)


class MfaChallengeTokenTest(TestCase):
    def test_token_round_trips_to_the_same_user_id(self) -> None:
        token = build_mfa_challenge_token(42)
        self.assertEqual(read_mfa_challenge_payload(token)["user_id"], 42)

    def test_token_round_trips_the_remember_me_flag(self) -> None:
        token = build_mfa_challenge_token(42, remember_me=True)
        self.assertTrue(read_mfa_challenge_payload(token)["remember_me"])

        token_without = build_mfa_challenge_token(42)
        self.assertFalse(read_mfa_challenge_payload(token_without)["remember_me"])

    def test_garbage_token_is_rejected(self) -> None:
        self.assertIsNone(read_mfa_challenge_payload("not-a-real-token"))

    def test_tampered_token_is_rejected(self) -> None:
        token = build_mfa_challenge_token(42)
        tampered = token[:-1] + ("a" if token[-1] != "a" else "b")
        self.assertIsNone(read_mfa_challenge_payload(tampered))


class TotpCodeVerificationTest(TestCase):
    def test_current_code_is_accepted(self) -> None:
        secret = generate_totp_secret()
        current_code = pyotp.TOTP(secret).now()
        self.assertTrue(verify_totp_code(secret, current_code))

    def test_wrong_code_is_rejected(self) -> None:
        secret = generate_totp_secret()
        self.assertFalse(verify_totp_code(secret, "000000"))

    def test_empty_code_is_rejected_without_raising(self) -> None:
        secret = generate_totp_secret()
        self.assertFalse(verify_totp_code(secret, ""))
