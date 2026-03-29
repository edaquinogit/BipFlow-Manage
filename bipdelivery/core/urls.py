from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

# 🛰️ JWT AUTHENTICATION VIEWS
# Importação linear para evitar erros de sintaxe por indentação
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

# 🚀 API ROUTES AGGREGATION
api_patterns = [
    # Identity & Security
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Business Logic (Produtos, Categorias, etc)
    path('', include('api.urls')), 
]

# 🌐 MAIN URL CONFIGURATION
urlpatterns = [
    # Administrative Interface
    path('admin/', admin.site.urls),

    # Base API Entrypoint
    path('api/', include(api_patterns)),
]

# 🖼️ STATIC & MEDIA ASSETS (Development Protocol)
# Crucial para que as fotos dos produtos apareçam no Vue.js
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)