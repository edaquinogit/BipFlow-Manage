import os
from unittest.mock import patch

import django
from django.test import Client

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "bipdelivery.core.settings")
django.setup()


def test_healthz_returns_ok_without_revision() -> None:
    client = Client()

    with patch.dict(
        os.environ,
        {
            "BIPFLOW_COMMIT_SHA": "",
            "RENDER_GIT_COMMIT": "",
            "SOURCE_VERSION": "",
            "GITHUB_SHA": "",
        },
        clear=False,
    ):
        response = client.get("/healthz/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_healthz_exposes_runtime_revision_when_available() -> None:
    client = Client()

    with patch.dict(os.environ, {"BIPFLOW_COMMIT_SHA": "abc123"}, clear=False):
        response = client.get("/healthz/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "revision": "abc123"}
