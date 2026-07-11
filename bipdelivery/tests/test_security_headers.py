"""
HSTS header tests.

DJANGO_ENV=production gates SECURE_HSTS_SECONDS/etc in settings.py, but the
header itself is emitted by Django's own SecurityMiddleware based on the
*settings values*, not on IS_PRODUCTION directly -- so these tests just
override the settings and don't need to fake a production environment.
"""

import os

import django
import pytest
from django.test import Client, override_settings

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "bipdelivery.core.settings")
django.setup()

pytestmark = pytest.mark.django_db


@override_settings(
    SECURE_HSTS_SECONDS=3600,
    SECURE_HSTS_INCLUDE_SUBDOMAINS=True,
    SECURE_HSTS_PRELOAD=False,
    SECURE_SSL_REDIRECT=False,
)
def test_hsts_header_present_on_secure_requests() -> None:
    client = Client()
    response = client.get("/healthz/", secure=True)

    assert response.status_code == 200
    assert response["Strict-Transport-Security"] == "max-age=3600; includeSubDomains"


@override_settings(
    SECURE_HSTS_SECONDS=0,
    SECURE_SSL_REDIRECT=False,
)
def test_hsts_header_absent_when_disabled() -> None:
    client = Client()
    response = client.get("/healthz/", secure=True)

    assert response.status_code == 200
    assert "Strict-Transport-Security" not in response


@override_settings(
    SECURE_HSTS_SECONDS=31536000,
    SECURE_HSTS_INCLUDE_SUBDOMAINS=True,
    SECURE_HSTS_PRELOAD=True,
    SECURE_SSL_REDIRECT=False,
)
def test_hsts_header_includes_preload_when_enabled() -> None:
    client = Client()
    response = client.get("/healthz/", secure=True)

    assert response["Strict-Transport-Security"] == "max-age=31536000; includeSubDomains; preload"
