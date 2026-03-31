from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    # 🔐 ADMINISTRATIVE INTERFACE
    path('admin/', admin.site.urls),

    # 🚀 API GATEWAY (Versioned)
    # Centraliza todas as rotas de negócio e autenticação
    path('api/', include('api.urls')),
]

# 🖼️ STATIC & MEDIA ASSETS
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)