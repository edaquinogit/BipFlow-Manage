# bipdelivery/api/throttling.py
"""
Rate limiting controls for the public API and sensitive authentication flows.
"""

from __future__ import annotations

import hashlib
from typing import Iterable

from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle, UserRateThrottle


def _hash_cache_identifier(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _request_data_value(request, fields: Iterable[str], *, lower: bool = True) -> str | None:
    data = getattr(request, "data", {})
    if not hasattr(data, "get"):
        return None

    for field in fields:
        value = data.get(field)
        if isinstance(value, (list, tuple)):
            value = value[0] if value else None

        if value is None:
            continue

        normalized_value = str(value).strip()
        if not normalized_value:
            continue

        return normalized_value.lower() if lower else normalized_value

    return None


class UserThrottle(UserRateThrottle):
    """
    Limit requests from authenticated users.
    """

    scope = "user"


class AnonThrottle(AnonRateThrottle):
    """
    Limit requests from anonymous users.
    """

    scope = "anon"


class ProductListThrottle(UserRateThrottle):
    """
    More permissive rate limit for product list reads.
    """

    scope = "product_list"

    def get_cache_key(self, request, view):
        user = request.user
        ident = user.id if user and user.is_authenticated else self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


class AuthIpThrottle(AnonRateThrottle):
    """
    Shared IP-based control for high-risk authentication write endpoints.
    """

    scope = "auth_ip"


class SubmittedFieldThrottle(SimpleRateThrottle):
    """
    Base throttle that keys the rate limit by submitted sensitive fields.
    """

    identity_fields: tuple[str, ...] = ()
    lower_identity = True

    def get_cache_key(self, request, view):
        identifier = _request_data_value(
            request,
            self.identity_fields,
            lower=self.lower_identity,
        )
        if identifier is None:
            return None

        return self.cache_format % {
            "scope": self.scope,
            "ident": _hash_cache_identifier(identifier),
        }


class LoginIdentityThrottle(SubmittedFieldThrottle):
    """
    Limit repeated login attempts for the same submitted username/email.
    """

    scope = "auth_login_identity"
    identity_fields = ("username", "email")


class RegistrationIdentityThrottle(SubmittedFieldThrottle):
    """
    Limit registration attempts for the same submitted email address.
    """

    scope = "auth_register_identity"
    identity_fields = ("email",)


class PasswordResetIdentityThrottle(SubmittedFieldThrottle):
    """
    Limit password reset requests for the same submitted email address.
    """

    scope = "auth_password_reset_identity"
    identity_fields = ("email",)


class PasswordResetConfirmIdentityThrottle(SubmittedFieldThrottle):
    """
    Limit password reset confirmation attempts for the same reset subject.
    """

    scope = "auth_password_reset_confirm_identity"
    identity_fields = ("uid",)
    lower_identity = False


class TokenRefreshIpThrottle(AnonRateThrottle):
    """
    IP-based control for refresh-token replay and retry storms.
    """

    scope = "auth_token_refresh_ip"


class TokenRefreshIdentityThrottle(SubmittedFieldThrottle):
    """
    Limit repeated refresh attempts for the same submitted refresh token.
    """

    scope = "auth_token_refresh_identity"
    identity_fields = ("refresh",)
    lower_identity = False
