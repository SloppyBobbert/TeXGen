"""Production configuration must fail closed before serving requests."""

import json
import os
from pathlib import Path
import subprocess
import sys

import pytest


BACKEND = Path(__file__).resolve().parents[1]


def load_production_settings(*, script=None, **overrides):
    # Synthetic test values only. This process does not connect to a database.
    env = {
        **os.environ,
        "DJANGO_DEBUG": "False",
        "DJANGO_SECRET_KEY": "production-config-test-only-" + "x" * 64,
        "JWT_SIGNING_KEY": "production-jwt-test-only-" + "y" * 64,
        "DATABASE_URL": "postgres://test:test@127.0.0.1/test",
        "DJANGO_ALLOWED_HOSTS": "localhost,127.0.0.1",
        "COMPILER_BACKEND": "disabled",
        "TEXGEN_LOCAL_HTTP": "0",
        **overrides,
    }
    return subprocess.run(
        [sys.executable, "-c", script or (
            "import json; import cheat_sheet.production as config; "
            "print(json.dumps({'enabled': getattr(config, 'REQUEST_THROTTLE_ENABLED', False), "
            "'anon': getattr(config, 'REQUEST_THROTTLE_ANON_LIMIT', None), "
            "'user': getattr(config, 'REQUEST_THROTTLE_USER_LIMIT', None), "
            "'classes': config.REST_FRAMEWORK.get('DEFAULT_THROTTLE_CLASSES', [])}))"
        )],
        cwd=BACKEND,
        env=env,
        capture_output=True,
        text=True,
        timeout=10,
        check=False,
    )


def test_production_settings_accept_valid_configuration():
    result = load_production_settings()

    assert result.returncode == 0, result.stderr


def test_production_checks_persistent_connections_before_reuse():
    result = load_production_settings(script=(
        "import json;import cheat_sheet.production as c;"
        "print(json.dumps([c.DATABASES['default']['CONN_MAX_AGE'],"
        "c.DATABASES['default'].get('CONN_HEALTH_CHECKS',False)]))"
    ))
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == [600, True]


def test_production_separates_connection_and_admission_deadlines():
    result = load_production_settings(
        DJANGO_SETTINGS_MODULE="cheat_sheet.production", COMPILER_BACKEND="sidecar",
        script="import django,json;django.setup();"
               "from api.compilation.service import SettingsCompilerSelector,compile_limits_from_settings;"
               "limits=compile_limits_from_settings();adapter=SettingsCompilerSelector(limits).select();"
               "print(json.dumps([adapter.connect_timeout,adapter.admission_timeout,limits.timeout_seconds]))",
    )
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == [1.0, 5.0, 15.0]


def test_production_settings_reject_debug():
    result = load_production_settings(DJANGO_DEBUG="True")

    assert result.returncode != 0
    assert "DEBUG must be disabled" in result.stderr


@pytest.mark.parametrize(
    "overrides, message",
    [
        ({"DATABASE_URL": "sqlite:///:memory:"}, "Production requires PostgreSQL"),
        ({"DJANGO_SECRET_KEY": "short-test-key"}, "DJANGO_SECRET_KEY must"),
        ({"DJANGO_SECRET_KEY": "django-insecure-" + "x" * 64}, "DJANGO_SECRET_KEY must"),
        ({"JWT_SIGNING_KEY": "short-test-key"}, "JWT_SIGNING_KEY must"),
        ({"JWT_SIGNING_KEY": ""}, "JWT_SIGNING_KEY must"),
        ({"DJANGO_ALLOWED_HOSTS": ""}, "Production requires explicit allowed hosts"),
        ({"DJANGO_ALLOWED_HOSTS": "*"}, "Production requires explicit allowed hosts"),
        ({"DJANGO_ALLOWED_HOSTS": "localhost,*"}, "Production requires explicit allowed hosts"),
    ],
)
def test_production_settings_reject_unsafe_configuration(overrides, message):
    result = load_production_settings(**overrides)

    assert result.returncode != 0
    assert message in result.stderr


def test_production_always_enables_shared_request_limits():
    result = load_production_settings(
        REQUEST_THROTTLE_ENABLED="False",
        REQUEST_THROTTLE_ANON_LIMIT="3",
        REQUEST_THROTTLE_USER_LIMIT="5",
    )
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == {
        "enabled": True, "anon": 3, "user": 5,
        "classes": ["api.request_throttle.SharedRequestThrottle"],
    }


@pytest.mark.parametrize("value", ["0", "-1", "invalid"])
def test_production_rejects_invalid_request_limits(value):
    result = load_production_settings(REQUEST_THROTTLE_ANON_LIMIT=value)
    assert result.returncode != 0
    assert "REQUEST_THROTTLE_ANON_LIMIT must be a positive integer" in result.stderr


SECURITY_SCRIPT = (
    "import json; import cheat_sheet.production as c; "
    "names = ['SESSION_COOKIE_SECURE', 'CSRF_COOKIE_SECURE', 'SECURE_SSL_REDIRECT', "
    "'SECURE_HSTS_SECONDS', 'SECURE_REDIRECT_EXEMPT', 'SECURE_CONTENT_TYPE_NOSNIFF', "
    "'USE_X_FORWARDED_HOST', 'SECURE_PROXY_SSL_HEADER', 'CORS_ALLOWED_ORIGINS', 'STATIC_ROOT']; "
    "values = {name: getattr(c, name, None) for name in names}; "
    "values['NUM_PROXIES'] = c.REST_FRAMEWORK['NUM_PROXIES']; "
    "print(json.dumps(values, default=str))"
)


def test_production_security_and_static_defaults():
    result = load_production_settings(script=SECURITY_SCRIPT)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == {
        "SESSION_COOKIE_SECURE": True, "CSRF_COOKIE_SECURE": True,
        "SECURE_SSL_REDIRECT": True, "SECURE_HSTS_SECONDS": 31536000,
        "SECURE_REDIRECT_EXEMPT": ["^api/health/$"],
        "SECURE_CONTENT_TYPE_NOSNIFF": True,
        "USE_X_FORWARDED_HOST": False, "SECURE_PROXY_SSL_HEADER": None,
        "CORS_ALLOWED_ORIGINS": [], "STATIC_ROOT": str(BACKEND / "staticfiles"),
        "NUM_PROXIES": 1,
    }


def test_local_http_mode_keeps_secure_cookies_but_disables_tls_redirect():
    result = load_production_settings(script=SECURITY_SCRIPT, TEXGEN_LOCAL_HTTP="1")
    assert result.returncode == 0, result.stderr
    values = json.loads(result.stdout)
    assert values["SECURE_SSL_REDIRECT"] is False
    assert values["SECURE_HSTS_SECONDS"] == 0
    assert values["SESSION_COOKIE_SECURE"] is True
    assert values["CSRF_COOKIE_SECURE"] is True


@pytest.mark.parametrize("overrides,message", [
    ({"TEXGEN_LOCAL_HTTP": "1", "DJANGO_ALLOWED_HOSTS": "example.com"}, "Local HTTP requires loopback hosts"),
    ({"TEXGEN_LOCAL_HTTP": "yes"}, "TEXGEN_LOCAL_HTTP must be 0 or 1"),
    ({"COMPILER_BACKEND": "local"}, "Production requires the isolated sidecar or disabled compiler"),
])
def test_production_rejects_unsafe_runtime_modes(overrides, message):
    result = load_production_settings(**overrides)
    assert result.returncode != 0
    assert message in result.stderr
