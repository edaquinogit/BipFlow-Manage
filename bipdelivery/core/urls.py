from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    # 🔐 ADMINISTRATIVE INTERFACE
    path('admin/', admin.site.urls),

    # 🚀 API GATEWAY (Versioned)
    # Centraliza todas as rotas de negócio e autenticação
    path('api/', include('bipdelivery.api.urls')),
]

# 🖼️ STATIC & MEDIA ASSETS
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
