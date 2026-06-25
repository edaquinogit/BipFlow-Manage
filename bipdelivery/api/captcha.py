"""
Cloudflare Turnstile verification for the conditional login CAPTCHA gate
(Fase 2.3 of the auth-security plan).

Stdlib-only HTTP client on purpose: this is a single outbound call, not worth
a new HTTP-client dependency. Fails closed -- if Turnstile is unreachable or
misconfigured, the token is treated as invalid, never as "skip the check".
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request

from django.conf import settings

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def verify_turnstile(token: str | None, remote_ip: str) -> bool:
    """Return True only if Cloudflare confirms the submitted widget token."""
    if not token:
        return False

    secret_key = getattr(settings, "TURNSTILE_SECRET_KEY", "")
    if not secret_key:
        return False

    payload = json.dumps(
        {"secret": secret_key, "response": token, "remoteip": remote_ip}
    ).encode("utf-8")
    request = urllib.request.Request(
        TURNSTILE_VERIFY_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            result = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, ValueError, OSError):
        return False

    return bool(result.get("success"))
