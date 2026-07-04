import re

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path, re_path
from django.views.static import serve as serve_static


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
# Static files: only serve directly from Django in DEBUG. In production
# these are served by nginx (see docker-compose.prod.yml's static_data
# volume shared with the frontend container); DEBUG=False + a real server
# in front is the correct setup there.
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# Media: reachable regardless of DEBUG. This project keeps DJANGO_DEBUG=False
# even in local dev (see .env.example), but disk-backed media (R2 off) still
# needs Django to serve it itself -- otherwise /media/* 404s even though the
# file exists on disk. django.conf.urls.static.static() won't do here: it
# no-ops internally whenever DEBUG is False, regardless of any condition
# wrapped around it, so this registers the same view (django.views.static.
# serve) directly instead. Production always requires R2 instead (see
# USE_R2_STORAGE/IS_PRODUCTION guard in settings.py), so this branch never
# applies there.
if not settings.USE_R2_STORAGE:
    urlpatterns += [
        re_path(
            r"^%s(?P<path>.*)$" % re.escape(settings.MEDIA_URL.lstrip("/")),
            serve_static,
            {"document_root": settings.MEDIA_ROOT},
        ),
    ]
