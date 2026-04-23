from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from bipdelivery.api.views import (
    PasswordResetConfirmView,
    PasswordResetRequestView,
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
    path("auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("v1/", include("bipdelivery.api.v1_urls")),
]
