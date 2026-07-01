from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path


def healthz(request):
    # Container/orchestrator liveness probe. Hit directly over plain HTTP by
    # Docker healthchecks (no reverse proxy in front), so it must stay exempt
    # from SECURE_SSL_REDIRECT -- see SECURE_REDIRECT_EXEMPT in settings.py.
    return HttpResponse("ok")


urlpatterns = [
    path("healthz/", healthz),
    # 🔐 ADMINISTRATIVE INTERFACE
    path("admin/", admin.site.urls),
    # 🚀 API GATEWAY (Versioned)
    # Centraliza todas as rotas de negócio e autenticação
    path("api/", include("bipdelivery.api.urls")),
]

# 🖼️ STATIC & MEDIA ASSETS
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
