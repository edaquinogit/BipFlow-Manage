from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularSwaggerView, SpectacularRedocView, SpectacularAPIView

urlpatterns = [
    # 🔐 ADMINISTRATIVE INTERFACE
    path('admin/', admin.site.urls),

    # 📚 AUTOMATIC API DOCUMENTATION (drf-spectacular)
    # OpenAPI 3.0 schema JSON endpoint — consumed by Swagger and ReDoc
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    
    # 🎨 SWAGGER UI — Interactive API documentation (Web UI)
    # Explore, test, and understand all API endpoints with live examples
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    
    # 📖 ReDoc — Alternative API documentation (Reader-friendly format)
    # Better for reading documentation and generating client libraries
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # 🚀 API GATEWAY (Versioned)
    # Centraliza todas as rotas de negócio e autenticação
    path('api/', include('api.urls')),
]

# 🖼️ STATIC & MEDIA ASSETS
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)