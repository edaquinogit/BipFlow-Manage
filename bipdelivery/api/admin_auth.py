"""
MFA gate + rate limiting for the Django admin login (/admin/login/).

The app's own login endpoint (LoginTokenObtainPairView + MfaVerifyView) has
always enforced TOTP MFA and IP/identity throttling for staff/superuser
accounts. Django's stock admin login never consulted any of that -- it's
built on plain django.contrib.auth username/password authentication, with no
throttling at all. Since staff/superuser accounts get a cross-tenant
"administrative override" in the admin (see StoreScopedAdminMixin), that made
/admin/login/ the one full-privilege authentication surface in the app with
none of its own hardening. This module closes that gap by installing a
custom AuthenticationForm on the existing admin.site singleton -- no new
AdminSite, no re-registering every model.

Importing this module (done once, from admin.py, which Django's admin
autodiscovery already loads) is what takes effect; nothing here needs to be
called directly.
"""

from __future__ import annotations

from django import forms
from django.conf import settings
from django.contrib import admin
from django.contrib.admin.forms import AdminAuthenticationForm
from django.views.decorators.debug import sensitive_variables

from .mfa import verify_totp_code
from .models import LoginAttempt, MFABackupCode, TOTPDevice
from .throttling import AdminLoginIdentityThrottle, AdminLoginIpThrottle
from .views import _client_ip


class _ThrottleRequestShim:
    """Adapts a plain Django HttpRequest so the DRF throttle classes in
    throttling.py (which expect `.data` and `.META`) can be reused here --
    the admin login view is a regular Django form view, not a DRF APIView,
    so there's no `request.data` and no `throttle_classes` hook to lean on.
    """

    def __init__(self, request):
        self.META = request.META
        self.user = getattr(request, "user", None)
        self.data = request.POST


def _admin_login_is_throttled(request) -> bool:
    shim = _ThrottleRequestShim(request)
    for throttle_cls in (AdminLoginIpThrottle, AdminLoginIdentityThrottle):
        if not throttle_cls().allow_request(shim, view=None):
            return True
    return False


class MfaAdminAuthenticationForm(AdminAuthenticationForm):
    """Standard admin username/password check, plus:

    - Rate limiting (checked first, before touching the password hasher --
      same fail-closed ordering LoginTokenObtainPairView already uses).
    - A required TOTP/backup code for any staff/superuser with a confirmed
      TOTPDevice (never optional once configured, regardless of
      ADMIN_MFA_ENFORCED).
    - When ADMIN_MFA_ENFORCED is True, staff/superuser accounts with no MFA
      device configured yet are blocked outright rather than let through
      password-only.
    """

    mfa_code = forms.CharField(
        required=False,
        label="Codigo de verificacao (MFA)",
        widget=forms.TextInput(attrs={"autocomplete": "one-time-code"}),
    )
    backup_code = forms.CharField(
        required=False,
        label="Codigo de backup",
        widget=forms.TextInput(attrs={"autocomplete": "one-time-code"}),
    )

    @sensitive_variables("code", "backup_code")
    def clean(self):
        if _admin_login_is_throttled(self.request):
            self._record(succeeded=False, failure_reason=LoginAttempt.FAILURE_THROTTLED)
            raise forms.ValidationError(
                "Muitas tentativas. Aguarde um momento e tente novamente.",
                code="throttled",
            )

        try:
            cleaned_data = super().clean()
        except forms.ValidationError:
            # super().clean() raises on bad credentials, an inactive user,
            # or (via AdminAuthenticationForm.confirm_login_allowed) a
            # non-staff user -- self.user_cache is only set in that last
            # case, None otherwise. Record either way, then let the original
            # error propagate unchanged.
            self._record(succeeded=False, failure_reason=LoginAttempt.FAILURE_INVALID_CREDENTIALS, user=self.user_cache)
            raise

        user = self.user_cache
        if user is None:
            # Empty username/password: super().clean() skips authentication
            # entirely rather than raising (AuthenticationForm.clean() only
            # calls authenticate() when both fields are non-empty). The
            # missing-field errors already fail the form, but without this
            # guard the code below would misrecord it as a success.
            self._record(succeeded=False, failure_reason=LoginAttempt.FAILURE_INVALID_CREDENTIALS)
            return cleaned_data

        device = TOTPDevice.objects.filter(user=user, confirmed=True).first()

        if device is not None:
            code = str(self.cleaned_data.get("mfa_code") or "")
            backup_code = self.cleaned_data.get("backup_code")
            verified = verify_totp_code(device.get_secret(), code) if code else False
            if not verified and backup_code:
                verified = MFABackupCode.consume(user, str(backup_code))

            if not verified:
                self._record(succeeded=False, failure_reason=LoginAttempt.FAILURE_MFA_INVALID, user=user)
                self.user_cache = None
                raise forms.ValidationError("Codigo de verificacao invalido.", code="mfa_invalid")
        elif getattr(settings, "ADMIN_MFA_ENFORCED", False):
            self._record(succeeded=False, failure_reason=LoginAttempt.FAILURE_MFA_REQUIRED, user=user)
            self.user_cache = None
            raise forms.ValidationError(
                "Configure a verificacao em duas etapas no painel antes de acessar o admin.",
                code="mfa_setup_required",
            )

        self._record(succeeded=True, user=user)
        return cleaned_data

    def _record(self, *, succeeded: bool, failure_reason: str = "", user=None) -> None:
        identifier = self.cleaned_data.get("username") or self.data.get("username", "")
        LoginAttempt.record(
            identifier=identifier,
            ip_address=_client_ip(self.request),
            user_agent=self.request.META.get("HTTP_USER_AGENT", ""),
            succeeded=succeeded,
            failure_reason=failure_reason,
            user=user,
        )


admin.site.login_form = MfaAdminAuthenticationForm
