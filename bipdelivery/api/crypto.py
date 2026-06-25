"""
Symmetric encryption for secrets that must be stored at rest but never in
plaintext (Fase 3.1: TOTP device secrets).

There's no dedicated KMS in this stack, so the Fernet key is deterministically
derived from DJANGO_SECRET_KEY. That ties secret rotation to a key rotation
this app doesn't otherwise support -- rotating DJANGO_SECRET_KEY would make
every stored TOTP secret unreadable, forcing every user to redo MFA setup.
Acceptable for this stage; a dedicated FIELD_ENCRYPTION_KEY would decouple
the two if that trade-off ever becomes a problem.
"""

from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


def _fernet() -> Fernet:
    digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_secret(plain_text: str) -> bytes:
    return _fernet().encrypt(plain_text.encode("utf-8"))


def decrypt_secret(token: bytes) -> str:
    try:
        return _fernet().decrypt(bytes(token)).decode("utf-8")
    except InvalidToken as error:
        raise ValueError("Stored secret could not be decrypted.") from error
