from django.urls import include, path

from bipdelivery.api.views import (
    CurrentUserView,
    LoginTokenObtainPairView,
    LogoutAllDevicesView,
    LogoutView,
    MfaDisableView,
    MfaSetupConfirmView,
    MfaSetupView,
    MfaVerifyView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RefreshTokenView,
    RegisterUserView,
)

app_name = "api"

urlpatterns = [
    path("auth/register/", RegisterUserView.as_view(), name="register"),
    path("auth/me/", CurrentUserView.as_view(), name="current_user"),
    path("auth/password-reset/", PasswordResetRequestView.as_view(), name="password_reset"),
    path(
        "auth/password-reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="password_reset_confirm",
    ),
    path("auth/token/", LoginTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", RefreshTokenView.as_view(), name="token_refresh"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/logout-all/", LogoutAllDevicesView.as_view(), name="logout_all"),
    path("auth/mfa/setup/", MfaSetupView.as_view(), name="mfa_setup"),
    path("auth/mfa/setup/confirm/", MfaSetupConfirmView.as_view(), name="mfa_setup_confirm"),
    path("auth/mfa/disable/", MfaDisableView.as_view(), name="mfa_disable"),
    path("auth/mfa/verify/", MfaVerifyView.as_view(), name="mfa_verify"),
    path("v1/", include("bipdelivery.api.v1_urls")),
]
