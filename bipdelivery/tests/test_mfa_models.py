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
from cryptography.fernet import Fernet
from django.contrib.auth.models import User
from django.test import TestCase, override_settings

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


class MfaAdminFieldExclusionTest(TestCase):
    """TOTPDeviceAdmin/MFABackupCodeAdmin have has_change_permission=False,
    which makes Django render every non-excluded field as read-only text on
    the detail page -- exclude must actually keep the ciphertext/hash out of
    get_fields(), not just out of readonly_fields (redundant with exclude
    and easy to have silently stop mattering)."""

    def setUp(self) -> None:
        from django.test import RequestFactory

        self.request = RequestFactory().get("/admin/")
        self.request.user = User.objects.create_superuser(
            username="mfa-admin-test", email="mfa-admin-test@example.com", password="testpass123"
        )

    def test_totp_device_admin_excludes_encrypted_secret(self) -> None:
        from django.contrib import admin

        model_admin = admin.site._registry[TOTPDevice]
        self.assertNotIn("encrypted_secret", model_admin.get_fields(self.request))

    def test_mfa_backup_code_admin_excludes_code_hash(self) -> None:
        from django.contrib import admin

        model_admin = admin.site._registry[MFABackupCode]
        self.assertNotIn("code_hash", model_admin.get_fields(self.request))


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

    @override_settings(TOTP_ENCRYPTION_KEY=Fernet.generate_key().decode("ascii"))
    def test_secret_round_trips_with_an_explicit_totp_encryption_key(self) -> None:
        device = TOTPDevice(user=self.user)
        device.set_secret("JBSWY3DPEHPK3PXP")
        device.save()

        reloaded = TOTPDevice.objects.get(pk=device.pk)
        self.assertEqual(reloaded.get_secret(), "JBSWY3DPEHPK3PXP")

    def test_same_secret_encrypts_differently_under_different_totp_encryption_keys(self) -> None:
        with override_settings(TOTP_ENCRYPTION_KEY=Fernet.generate_key().decode("ascii")):
            device_a = TOTPDevice(user=self.user)
            device_a.set_secret("JBSWY3DPEHPK3PXP")

        other_user = User.objects.create_user(username="mfa-user-2", password="testpass123")
        with override_settings(TOTP_ENCRYPTION_KEY=Fernet.generate_key().decode("ascii")):
            device_b = TOTPDevice(user=other_user)
            device_b.set_secret("JBSWY3DPEHPK3PXP")

        self.assertNotEqual(bytes(device_a.encrypted_secret), bytes(device_b.encrypted_secret))

    @override_settings(TOTP_ENCRYPTION_KEY=Fernet.generate_key().decode("ascii"))
    def test_secret_encrypted_under_totp_encryption_key_is_not_readable_by_derived_key(self) -> None:
        from bipdelivery.api.crypto import _derived_key

        device = TOTPDevice(user=self.user)
        device.set_secret("JBSWY3DPEHPK3PXP")
        device.save()

        with self.assertRaises(Exception):
            Fernet(_derived_key()).decrypt(bytes(device.encrypted_secret))


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
