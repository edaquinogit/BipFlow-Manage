# bipdelivery/api/throttling.py
"""
Rate limiting controls for the public API and sensitive authentication flows.
"""

from __future__ import annotations

import hashlib
from typing import Iterable

from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle, UserRateThrottle

from .models import StoreSettings

# The refresh token travels exclusively in this httpOnly cookie (never the
# request body or localStorage) so it can't be exfiltrated via XSS. Shared
# with views.py, which sets/reads/clears the cookie itself.
REFRESH_TOKEN_COOKIE_NAME = "refresh_token"


def _hash_cache_identifier(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _request_field_value(data, field_path: str):
    current_value = data

    for field_name in field_path.split("."):
        if isinstance(current_value, (list, tuple)):
            current_value = current_value[0] if current_value else None

        if current_value is None or not hasattr(current_value, "get"):
            return None

        current_value = current_value.get(field_name)

    if isinstance(current_value, (list, tuple)):
        current_value = current_value[0] if current_value else None

    return current_value


def _request_data_value(request, fields: Iterable[str]) -> str | None:
    data = getattr(request, "data", {})
    if not hasattr(data, "get"):
        return None

    for field in fields:
        value = _request_field_value(data, field)
        if value is None:
            continue

        normalized_value = str(value).strip()
        if not normalized_value:
            continue

        return normalized_value

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


class CheckoutIpThrottle(SimpleRateThrottle):
    """
    Limit checkout creation bursts by client IP, regardless of auth status.

    Etapa 3 of docs/architecture/customer-profile-checkout-evolution.md:
    checkout now requires authentication. Plain AnonRateThrottle's
    get_cache_key() returns None -- "don't throttle" -- for any
    authenticated request, which would have silently disabled this IP
    throttle entirely the moment checkout stopped being anonymous.
    Overriding get_cache_key() to always key by IP, regardless of auth
    status, is what keeps it doing its job.
    """

    scope = "checkout_ip"

    def get_cache_key(self, request, view):
        return self.cache_format % {
            "scope": self.scope,
            "ident": self.get_ident(request),
        }


class BotMessageIpThrottle(AnonRateThrottle):
    """
    Limit public rule-based bot messages by client IP.
    """

    scope = "bot_message_ip"


class PdvReceiptEmailThrottle(UserRateThrottle):
    """
    Limit how often a dashboard user can trigger a PDV receipt email send --
    this endpoint accepts an arbitrary destination address, so without a
    limit a compromised/malicious dashboard account could turn it into a
    mail-spam relay riding on the app's own SMTP reputation.
    """

    scope = "pdv_receipt_email"


class MfaVerifyIpThrottle(AnonRateThrottle):
    """
    IP-based control for the MFA second-factor verification endpoint --
    without this, a 6-digit TOTP code (1e6 combinations) is brute-forceable
    in well under the ~90s validity window once unthrottled.
    """

    scope = "mfa_verify_ip"


class SubmittedFieldThrottle(SimpleRateThrottle):
    """
    Base throttle that keys the rate limit by submitted sensitive fields.
    """

    identity_fields: tuple[str, ...] = ()
    lower_identity = True

    def normalize_identifier(self, identifier: str) -> str:
        return identifier.lower() if self.lower_identity else identifier

    def get_cache_key(self, request, view):
        identifier = _request_data_value(request, self.identity_fields)
        if identifier is None:
            return None

        identifier = self.normalize_identifier(identifier)

        return self.cache_format % {
            "scope": self.scope,
            "ident": _hash_cache_identifier(identifier),
        }


class CheckoutCustomerThrottle(SubmittedFieldThrottle):
    """
    Limit repeated checkout attempts by customer identity: the authenticated
    user when logged in, the submitted phone number when a guest.

    Guest checkout reinstated: this used to be a plain UserRateThrottle
    (keyed only by the authenticated user), which is exactly the landmine
    already hit once in this project with TokenRefreshIdentityThrottle
    during the cookie-auth migration -- UserRateThrottle.get_cache_key()
    returns None ("don't throttle") for any request where
    request.user.is_authenticated is False, so a guest could bypass this
    throttle entirely. Rebased on SubmittedFieldThrottle (already used by
    LoginIdentityThrottle etc.) so the anonymous path reuses the same
    submitted-field keying instead of a bespoke implementation; the
    authenticated path still keys by user, same as before.
    """

    scope = "checkout_phone"
    identity_fields = ("customer.phone",)

    def normalize_identifier(self, identifier: str) -> str:
        return StoreSettings.normalize_phone(identifier)

    def get_cache_key(self, request, view):
        user = request.user
        if user and user.is_authenticated:
            return self.cache_format % {"scope": self.scope, "ident": user.pk}
        return super().get_cache_key(request, view)


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


class TokenRefreshIdentityThrottle(SimpleRateThrottle):
    """
    Limit repeated refresh attempts for the same refresh token.

    The token lives in the httpOnly `refresh_token` cookie, not the request
    body, so identity is read from there instead of via SubmittedFieldThrottle.
    """

    scope = "auth_token_refresh_identity"

    def get_cache_key(self, request, view):
        identifier = request.COOKIES.get(REFRESH_TOKEN_COOKIE_NAME)
        if not identifier:
            return None

        return self.cache_format % {
            "scope": self.scope,
            "ident": _hash_cache_identifier(identifier),
        }
