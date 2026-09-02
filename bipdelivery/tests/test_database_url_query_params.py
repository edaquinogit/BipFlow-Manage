"""Tests for DATABASE_URL query-parameter handling in build_database_config().

P1.2 -- the parser now forwards a strict allowlist (sslmode, channel_binding)
from the connection string to psycopg, rejects duplicates and invalid values,
ignores everything else with a safe warning, and keeps DATABASE_CONNECT_TIMEOUT
as the single authority for connect_timeout.

Run with:
    pytest bipdelivery/tests/test_database_url_query_params.py -v
"""

import logging

import pytest
from django.core.exceptions import ImproperlyConfigured

from bipdelivery.core.settings import (
    build_database_config,
    build_db_url_query_options,
)

SETTINGS_LOGGER = "bipdelivery.core.settings"


@pytest.fixture
def settings_warnings():
    """Capture records from the settings logger directly.

    The project's LOGGING config stops ``bipdelivery.*`` records from
    propagating to the root logger, so pytest's ``caplog`` (a root handler)
    never sees them -- attach our own handler to the exact logger instead.
    """
    logger = logging.getLogger(SETTINGS_LOGGER)
    records: list[logging.LogRecord] = []

    class _Collector(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            records.append(record)

    handler = _Collector(level=logging.WARNING)
    logger.addHandler(handler)
    try:
        yield records
    finally:
        logger.removeHandler(handler)


@pytest.fixture
def pg_env(monkeypatch):
    """Neutral Postgres DATABASE_URL with resilience env overrides cleared."""
    monkeypatch.delenv("DATABASE_CONN_MAX_AGE", raising=False)
    monkeypatch.delenv("DATABASE_CONNECT_TIMEOUT", raising=False)

    def _set(url: str) -> None:
        monkeypatch.setenv("DATABASE_URL", url)

    return _set


def _options(pg_env, url: str) -> dict:
    pg_env(url)
    return build_database_config()["default"]["OPTIONS"]


BASE = "postgresql://user:pass@db.example.com:5432/bipflow"


# 1. URL without a query string -> connect_timeout only.
def test_no_query_string_yields_connect_timeout_only(pg_env):
    assert _options(pg_env, BASE) == {"connect_timeout": 10}


# 2. sslmode=require is forwarded verbatim.
def test_sslmode_require_is_forwarded(pg_env):
    options = _options(pg_env, f"{BASE}?sslmode=require")

    assert options["sslmode"] == "require"
    assert options["connect_timeout"] == 10


# 3. channel_binding=require is forwarded verbatim.
def test_channel_binding_require_is_forwarded(pg_env):
    options = _options(pg_env, f"{BASE}?channel_binding=require")

    assert options["channel_binding"] == "require"


# 4. Both together (the current production shape) -> both forwarded.
def test_sslmode_and_channel_binding_together(pg_env):
    options = _options(pg_env, f"{BASE}?sslmode=require&channel_binding=require")

    assert options == {
        "connect_timeout": 10,
        "sslmode": "require",
        "channel_binding": "require",
    }


# 5. Unknown parameter -> ignored, not forwarded, warned without its value.
def test_unknown_query_param_is_ignored_and_warned_safely(pg_env, settings_warnings):
    options = _options(pg_env, f"{BASE}?application_name=bipflow-secret")

    assert "application_name" not in options
    assert options == {"connect_timeout": 10}

    messages = [r.getMessage() for r in settings_warnings]
    assert any("application_name" in m for m in messages)
    # The value must never reach the logs.
    assert not any("bipflow-secret" in m for m in messages)


# 6. Duplicate sslmode -> ImproperlyConfigured naming the parameter.
def test_duplicate_sslmode_is_rejected(pg_env):
    with pytest.raises(ImproperlyConfigured, match="sslmode"):
        _options(pg_env, f"{BASE}?sslmode=require&sslmode=disable")


# 7. Duplicate channel_binding -> ImproperlyConfigured naming the parameter.
def test_duplicate_channel_binding_is_rejected(pg_env):
    with pytest.raises(ImproperlyConfigured, match="channel_binding"):
        _options(pg_env, f"{BASE}?channel_binding=require&channel_binding=prefer")


# 8. Blank value -> dropped (keep_blank_values=False), no error.
def test_blank_sslmode_is_ignored(pg_env):
    options = _options(pg_env, f"{BASE}?sslmode=")

    assert "sslmode" not in options
    assert options == {"connect_timeout": 10}


# 9. connect_timeout in the URL -> ignored; env/default stays authoritative.
def test_connect_timeout_in_url_is_ignored(pg_env, settings_warnings):
    options = _options(pg_env, f"{BASE}?connect_timeout=1&sslmode=require")

    assert options["connect_timeout"] == 10
    assert options["sslmode"] == "require"
    assert any("connect_timeout" in r.getMessage() for r in settings_warnings)


# 10. DATABASE_CONNECT_TIMEOUT override coexists with a forwarded sslmode.
def test_env_connect_timeout_override_coexists_with_sslmode(pg_env, monkeypatch):
    monkeypatch.setenv("DATABASE_CONNECT_TIMEOUT", "7")

    options = _options(pg_env, f"{BASE}?sslmode=require")

    assert options["connect_timeout"] == 7
    assert options["sslmode"] == "require"


# 11. SQLite fallback is untouched by the new parsing.
def test_sqlite_fallback_unchanged(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)

    config = build_database_config()["default"]

    assert config["ENGINE"] == "django.db.backends.sqlite3"
    assert "OPTIONS" not in config


# 12. Percent-encoded credentials survive the refactor.
def test_percent_encoded_credentials_are_preserved(pg_env):
    pg_env("postgresql://u%2Fo:p%40ss@db.example.com:5432/bipflow?sslmode=require")

    config = build_database_config()["default"]

    assert config["USER"] == "u/o"
    assert config["PASSWORD"] == "p@ss"
    assert config["OPTIONS"]["sslmode"] == "require"


# 13. Invalid sslmode value -> ImproperlyConfigured.
def test_invalid_sslmode_is_rejected(pg_env):
    with pytest.raises(ImproperlyConfigured, match="sslmode"):
        _options(pg_env, f"{BASE}?sslmode=totally-secure")


# 14. Invalid channel_binding value -> ImproperlyConfigured.
def test_invalid_channel_binding_is_rejected(pg_env):
    with pytest.raises(ImproperlyConfigured, match="channel_binding"):
        _options(pg_env, f"{BASE}?channel_binding=required")


# 15. Malformed / trailing query fragments -> no regression.
@pytest.mark.parametrize("suffix", ["?", "?&", "?=", "?&&", "?foo"])
def test_malformed_query_is_a_noop(pg_env, suffix):
    options = _options(pg_env, f"{BASE}{suffix}")

    assert options == {"connect_timeout": 10}


# Direct unit coverage of the helper (independent of env / build_database_config).
def test_helper_returns_empty_for_no_query():
    assert build_db_url_query_options("") == {}


def test_helper_forwards_valid_verify_full():
    assert build_db_url_query_options("sslmode=verify-full") == {
        "sslmode": "verify-full",
    }
