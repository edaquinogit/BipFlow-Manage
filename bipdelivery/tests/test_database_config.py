"""Tests for build_database_config() -- Postgres connection-resilience settings.

Covers the CONN_HEALTH_CHECKS / connect_timeout hardening plus regression
guards for the existing CONN_MAX_AGE behaviour and the SQLite fallback.

Run with:
    pytest bipdelivery/tests/test_database_config.py -v
"""

import pytest
from django.core.exceptions import ImproperlyConfigured

from bipdelivery.core.settings import build_database_config

POSTGRES_URL = "postgresql://user:pass@db.example.com:5432/bipflow"


@pytest.fixture
def postgres_env(monkeypatch):
    """DATABASE_URL set to Postgres, resilience env overrides cleared."""
    monkeypatch.setenv("DATABASE_URL", POSTGRES_URL)
    monkeypatch.delenv("DATABASE_CONN_MAX_AGE", raising=False)
    monkeypatch.delenv("DATABASE_CONNECT_TIMEOUT", raising=False)


def test_postgres_enables_conn_health_checks(postgres_env):
    config = build_database_config()["default"]

    assert config["CONN_HEALTH_CHECKS"] is True


def test_postgres_default_connect_timeout_is_10(postgres_env):
    config = build_database_config()["default"]

    assert config["OPTIONS"]["connect_timeout"] == 10


def test_postgres_connect_timeout_env_override_is_respected(postgres_env, monkeypatch):
    monkeypatch.setenv("DATABASE_CONNECT_TIMEOUT", "7")

    config = build_database_config()["default"]

    assert config["OPTIONS"]["connect_timeout"] == 7


def test_postgres_connect_timeout_accepts_minimum_of_one(postgres_env, monkeypatch):
    monkeypatch.setenv("DATABASE_CONNECT_TIMEOUT", "1")

    config = build_database_config()["default"]

    assert config["OPTIONS"]["connect_timeout"] == 1


@pytest.mark.parametrize("value", ["0", "-1"])
def test_postgres_connect_timeout_rejects_zero_or_negative(postgres_env, monkeypatch, value):
    monkeypatch.setenv("DATABASE_CONNECT_TIMEOUT", value)

    with pytest.raises(ImproperlyConfigured, match="DATABASE_CONNECT_TIMEOUT must be greater than 0"):
        build_database_config()


def test_postgres_conn_max_age_default_stays_60(postgres_env):
    config = build_database_config()["default"]

    assert config["CONN_MAX_AGE"] == 60


def test_postgres_conn_max_age_env_override_still_works(postgres_env, monkeypatch):
    monkeypatch.setenv("DATABASE_CONN_MAX_AGE", "120")

    config = build_database_config()["default"]

    assert config["CONN_MAX_AGE"] == 120


def test_sqlite_fallback_has_no_postgres_resilience_keys(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)

    config = build_database_config()["default"]

    assert config["ENGINE"] == "django.db.backends.sqlite3"
    assert "CONN_HEALTH_CHECKS" not in config
    assert "OPTIONS" not in config
