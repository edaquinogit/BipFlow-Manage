from django.urls import include, path

from bipdelivery.api.views import (
    LoginTokenObtainPairView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RefreshTokenView,
    RegisterUserView,
)

app_name = "api"

urlpatterns = [
    path("auth/register/", RegisterUserView.as_view(), name="register"),
    path("auth/password-reset/", PasswordResetRequestView.as_view(), name="password_reset"),
    path(
        "auth/password-reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="password_reset_confirm",
    ),
    path("auth/token/", LoginTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", RefreshTokenView.as_view(), name="token_refresh"),
    path("v1/", include("bipdelivery.api.v1_urls")),
]
