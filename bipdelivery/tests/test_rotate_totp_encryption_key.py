"""
Tests for the rotate_totp_encryption_key management command (Fase 7 of the
security hardening plan): migrates TOTPDevice secrets from the
SECRET_KEY-derived Fernet key to an explicit TOTP_ENCRYPTION_KEY.
"""

import os
from io import StringIO

import django
import pytest
from cryptography.fernet import Fernet
from django.contrib.auth.models import User
from django.core.management import CommandError, call_command
from django.test import TestCase, override_settings

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "bipdelivery.core.settings")
django.setup()

from bipdelivery.api.crypto import _derived_key  # noqa: E402
from bipdelivery.api.models import TOTPDevice  # noqa: E402

pytestmark = pytest.mark.django_db


class RotateTotpEncryptionKeyTest(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(username="rotate-user", password="testpass123")
        # Created with TOTP_ENCRYPTION_KEY unset -- encrypted under the
        # SECRET_KEY-derived key, same as any pre-existing production device.
        self.device = TOTPDevice(user=self.user)
        self.device.set_secret("JBSWY3DPEHPK3PXP")
        self.device.save()
        self.new_key = Fernet.generate_key().decode("ascii")

    def test_refuses_to_run_without_totp_encryption_key_configured(self) -> None:
        with self.assertRaises(CommandError):
            call_command("rotate_totp_encryption_key", stdout=StringIO())

    def test_refuses_an_invalid_totp_encryption_key(self) -> None:
        with override_settings(TOTP_ENCRYPTION_KEY="not-a-valid-fernet-key"):
            with self.assertRaises(CommandError):
                call_command("rotate_totp_encryption_key", stdout=StringIO())

    def test_dry_run_does_not_change_stored_ciphertext(self) -> None:
        original_ciphertext = bytes(TOTPDevice.objects.get(pk=self.device.pk).encrypted_secret)

        with override_settings(TOTP_ENCRYPTION_KEY=self.new_key):
            call_command("rotate_totp_encryption_key", dry_run=True, stdout=StringIO())

        unchanged = TOTPDevice.objects.get(pk=self.device.pk)
        self.assertEqual(bytes(unchanged.encrypted_secret), original_ciphertext)
        # Still decryptable under the old derived key -- rotation never committed.
        self.assertEqual(
            Fernet(_derived_key()).decrypt(original_ciphertext).decode("utf-8"),
            "JBSWY3DPEHPK3PXP",
        )

    def test_rotates_secret_from_derived_key_to_totp_encryption_key(self) -> None:
        with override_settings(TOTP_ENCRYPTION_KEY=self.new_key):
            call_command("rotate_totp_encryption_key", stdout=StringIO())

            rotated = TOTPDevice.objects.get(pk=self.device.pk)
            # get_secret() uses whatever crypto._fernet() resolves to right
            # now, which is TOTP_ENCRYPTION_KEY under this override -- so a
            # successful round-trip here proves the ciphertext is readable
            # under the new key.
            self.assertEqual(rotated.get_secret(), "JBSWY3DPEHPK3PXP")

        # And no longer decryptable under the old derived key.
        with self.assertRaises(Exception):
            Fernet(_derived_key()).decrypt(bytes(rotated.encrypted_secret))

    def test_running_twice_does_not_double_encrypt_or_error(self) -> None:
        with override_settings(TOTP_ENCRYPTION_KEY=self.new_key):
            call_command("rotate_totp_encryption_key", stdout=StringIO())
            first_pass_ciphertext = bytes(TOTPDevice.objects.get(pk=self.device.pk).encrypted_secret)

            call_command("rotate_totp_encryption_key", stdout=StringIO())
            second_pass_ciphertext = bytes(TOTPDevice.objects.get(pk=self.device.pk).encrypted_secret)

            self.assertEqual(first_pass_ciphertext, second_pass_ciphertext)
            reloaded = TOTPDevice.objects.get(pk=self.device.pk)
            self.assertEqual(reloaded.get_secret(), "JBSWY3DPEHPK3PXP")

    def test_reports_success_with_no_devices_to_rotate(self) -> None:
        TOTPDevice.objects.all().delete()
        output = StringIO()

        with override_settings(TOTP_ENCRYPTION_KEY=self.new_key):
            call_command("rotate_totp_encryption_key", stdout=output)

        self.assertIn("nothing to rotate", output.getvalue().lower())
