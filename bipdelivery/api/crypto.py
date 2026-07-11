"""
Symmetric encryption for secrets that must be stored at rest but never in
plaintext (Fase 3.1: TOTP device secrets).

There's no dedicated KMS in this stack. By default the Fernet key is
deterministically derived from DJANGO_SECRET_KEY, which ties TOTP secret
rotation to a key rotation this app doesn't otherwise support -- rotating
DJANGO_SECRET_KEY would make every stored TOTP secret unreadable, forcing
every user to redo MFA setup -- and means a SECRET_KEY leak compromises both
JWT signing and every stored TOTP secret at once.

Setting the optional TOTP_ENCRYPTION_KEY env var decouples the two: when
present, it's used directly as the Fernet key instead of the derived one.
Deliberately NOT required even in production (unlike DJANGO_SECRET_KEY) --
flipping this on for a deployment that already has confirmed TOTPDevice rows
under the old derived key would make their secrets undecryptable without
first running `manage.py rotate_totp_encryption_key`. Safe to leave unset;
existing behavior is unchanged either way.
"""

from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


def _derived_key() -> bytes:
    digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _fernet(key: bytes | str | None = None) -> Fernet:
    if key is not None:
        return Fernet(key)

    configured_key = getattr(settings, "TOTP_ENCRYPTION_KEY", "") or ""
    if configured_key:
        return Fernet(configured_key)

    return Fernet(_derived_key())


def encrypt_secret(plain_text: str) -> bytes:
    return _fernet().encrypt(plain_text.encode("utf-8"))


def decrypt_secret(token: bytes) -> str:
    try:
        return _fernet().decrypt(bytes(token)).decode("utf-8")
    except InvalidToken as error:
        raise ValueError("Stored secret could not be decrypted.") from error
