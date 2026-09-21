"""Production settings; development continues to use cheat_sheet.settings."""

import os

from django.core.exceptions import ImproperlyConfigured

from . import settings as base
from .settings import *  # noqa: F403 -- inherit the shared Django configuration

if base.DEBUG:
    raise ImproperlyConfigured("DEBUG must be disabled in production")

if base.DATABASES["default"]["ENGINE"] != "django.db.backends.postgresql":
    raise ImproperlyConfigured("Production requires PostgreSQL")

for _name in ("SECRET_KEY", "JWT_SIGNING_KEY"):
    _value = getattr(base, _name)
    if len(_value) < 50 or _value.startswith("django-insecure-"):
        _label = "DJANGO_SECRET_KEY" if _name == "SECRET_KEY" else _name
        raise ImproperlyConfigured(
            f"{_label} must contain at least 50 characters and not use the development prefix"
        )

if not base.ALLOWED_HOSTS or any("*" in host for host in base.ALLOWED_HOSTS):
    raise ImproperlyConfigured("Production requires explicit allowed hosts without wildcards")

# Reconnect before the next query when a database restart closes a worker's connection.
DATABASES = {**base.DATABASES, "default": {**base.DATABASES["default"], "CONN_HEALTH_CHECKS": True}}

# Approved READY wait: connection stays at 1s, execution at 15s, worker at 30s.
COMPILER_ADMISSION_TIMEOUT_SECONDS = 5.0

REQUEST_THROTTLE_ENABLED = True
REQUEST_THROTTLE_ANON_LIMIT = base._positive_int_setting("REQUEST_THROTTLE_ANON_LIMIT", 60)
REQUEST_THROTTLE_USER_LIMIT = base._positive_int_setting("REQUEST_THROTTLE_USER_LIMIT", 600)

if base.COMPILER_BACKEND not in {"sidecar", "disabled"}:
    raise ImproperlyConfigured("Production requires the isolated sidecar or disabled compiler")

_local_http = os.getenv("TEXGEN_LOCAL_HTTP", "0")
if _local_http not in {"0", "1"}:
    raise ImproperlyConfigured("TEXGEN_LOCAL_HTTP must be 0 or 1")
if _local_http == "1" and not set(base.ALLOWED_HOSTS) <= {"localhost", "127.0.0.1", "[::1]"}:
    raise ImproperlyConfigured("Local HTTP requires loopback hosts")

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_SSL_REDIRECT = _local_http != "1"
SECURE_HSTS_SECONDS = 31536000 if SECURE_SSL_REDIRECT else 0
SECURE_REDIRECT_EXEMPT = [r"^api/health/$"]
SECURE_CONTENT_TYPE_NOSNIFF = True
USE_X_FORWARDED_HOST = False
# Gunicorn derives the scheme from the private Unix peer's sanitized header.
# Do not independently trust raw forwarding headers in Django.
SECURE_PROXY_SSL_HEADER = None
CORS_ALLOWED_ORIGINS = []
REST_FRAMEWORK = {**base.REST_FRAMEWORK, "NUM_PROXIES": 1}
STATIC_ROOT = base.BASE_DIR / "staticfiles"
STATIC_URL = "/static/"
