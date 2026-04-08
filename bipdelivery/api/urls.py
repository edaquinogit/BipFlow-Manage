from django.urls import include, path

# 🛰️ JWT AUTHENTICATION VIEWS
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

app_name = 'api'

urlpatterns = [
    # 🔐 IDENTITY & ACCESS MANAGEMENT
    # Rotas de autenticação limpas: /api/auth/token/
    path('auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # 🚀 BUSINESS DOMAIN (V1)
    # Protege a lógica de negócio com versionamento explícito
    path('v1/', include('bipdelivery.api.v1_urls')),
]
