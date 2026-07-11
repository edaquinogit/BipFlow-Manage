from __future__ import annotations

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from bipdelivery.api.crypto import _derived_key
from bipdelivery.api.models import TOTPDevice


class Command(BaseCommand):
    """One-off migration: re-encrypt every TOTPDevice secret under the new
    TOTP_ENCRYPTION_KEY, decrypting under the old SECRET_KEY-derived key.

    Run this BEFORE relying on TOTP_ENCRYPTION_KEY in production if any
    confirmed TOTPDevice rows already exist -- otherwise crypto.py starts
    reading a key that can't decrypt what's already stored, and every user
    with MFA enabled gets locked out on their next login.

    TOTP_ENCRYPTION_KEY must already be set in the environment this command
    runs in (it re-encrypts *to* that key); DJANGO_SECRET_KEY must be the
    same one the existing secrets were encrypted under.
    """

    help = "Re-encrypt TOTPDevice secrets from the SECRET_KEY-derived key to TOTP_ENCRYPTION_KEY."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report how many devices would be rotated without writing anything.",
        )

    def handle(self, *args, **options) -> None:
        new_key = (getattr(settings, "TOTP_ENCRYPTION_KEY", "") or "").strip()
        if not new_key:
            raise CommandError(
                "TOTP_ENCRYPTION_KEY is not set. Set it in the environment this command "
                "runs in before rotating -- it's the key devices get re-encrypted TO."
            )

        try:
            new_fernet = Fernet(new_key)
        except (ValueError, TypeError) as error:
            raise CommandError(
                "TOTP_ENCRYPTION_KEY is not a valid Fernet key. Generate one with "
                "`python scripts/generate-secrets.py` or `Fernet.generate_key()`."
            ) from error

        old_fernet = Fernet(_derived_key())
        devices = list(TOTPDevice.objects.all())

        if not devices:
            self.stdout.write(self.style.SUCCESS("No TOTPDevice rows exist -- nothing to rotate."))
            return

        dry_run = options["dry_run"]
        rotated = 0
        already_on_new_key = 0
        failures: list[int] = []

        with transaction.atomic():
            for device in devices:
                raw = bytes(device.encrypted_secret)

                # Already decryptable under the new key -- e.g. a re-run
                # after a partial rotation. Leave it alone.
                try:
                    new_fernet.decrypt(raw)
                    already_on_new_key += 1
                    continue
                except InvalidToken:
                    pass

                try:
                    plaintext = old_fernet.decrypt(raw)
                except InvalidToken:
                    failures.append(device.pk)
                    continue

                if not dry_run:
                    device.encrypted_secret = new_fernet.encrypt(plaintext)
                    device.save(update_fields=["encrypted_secret"])
                rotated += 1

            if dry_run:
                transaction.set_rollback(True)

        if failures:
            self.stdout.write(
                self.style.ERROR(
                    f"{len(failures)} device(s) could not be decrypted under either key "
                    f"(ids: {failures}) -- investigate before proceeding further."
                )
            )

        verb = "Would rotate" if dry_run else "Rotated"
        self.stdout.write(
            self.style.SUCCESS(
                f"{verb} {rotated} device(s); {already_on_new_key} already on the new key."
            )
        )
