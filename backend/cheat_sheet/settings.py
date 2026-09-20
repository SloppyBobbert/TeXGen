"""
Django settings for cheat_sheet project.
"""

import os
from math import isfinite
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
ORIGINAL_ENV = dict(os.environ)
load_dotenv(BASE_DIR.parent / ".env")
load_dotenv(BASE_DIR / ".env", override=True)
for key, value in ORIGINAL_ENV.items():
    os.environ[key] = value

DEBUG = os.getenv("DJANGO_DEBUG", "True") == "True"


def _positive_int_setting(name, default):
    raw = os.getenv(name, str(default))
    try:
        value = int(raw)
    except (TypeError, ValueError) as error:
        raise ImproperlyConfigured(f"{name} must be a positive integer") from error
    if value < 1:
        raise ImproperlyConfigured(f"{name} must be a positive integer")
    return value


def _nonnegative_int_setting(name, default):
    raw = os.getenv(name, str(default))
    try:
        value = int(raw)
    except (TypeError, ValueError) as error:
        raise ImproperlyConfigured(f"{name} must be a non-negative integer") from error
    if value < 0:
        raise ImproperlyConfigured(f"{name} must be a non-negative integer")
    return value


def _positive_float_setting(name, default):
    raw = os.getenv(name, str(default))
    try:
        value = float(raw)
    except (TypeError, ValueError) as error:
        raise ImproperlyConfigured(f"{name} must be a positive number") from error
    if not isfinite(value) or value <= 0:
        raise ImproperlyConfigured(f"{name} must be a positive number")
    return value

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY")

if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = "django-insecure-dev-secret-key-change-me"
    else:
        raise ImproperlyConfigured(
            "DJANGO_SECRET_KEY environment variable is not set. "
            "Set it to a securely generated value before running in production."
        )

JWT_SIGNING_KEY = os.getenv("JWT_SIGNING_KEY", SECRET_KEY)

ALLOWED_HOSTS = [
    host
    for host in (
        h.strip()
        for h in os.getenv(
            "DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,0.0.0.0"
        ).split(",")
    )
    if host
]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    # Local
    "api",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "cheat_sheet.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "cheat_sheet.wsgi.application"

# Database — uses DATABASE_URL env var, falls back to SQLite for local dev
DATABASES = {
    "default": dj_database_url.config(
        default="sqlite:///" + str(BASE_DIR / "db.sqlite3"),
        # The threaded development server cannot reuse persistent connections.
        conn_max_age=0 if DEBUG else 600,
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# CORS
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173"
    ).split(",")
    if origin.strip()
]

# DRF
DJANGO_NUM_PROXIES = _nonnegative_int_setting("DJANGO_NUM_PROXIES", 0)
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
    "NUM_PROXIES": DJANGO_NUM_PROXIES,
}

SIMPLE_JWT = {
    "SIGNING_KEY": JWT_SIGNING_KEY,
}

COMPILER_BACKEND = os.getenv("COMPILER_BACKEND", "disabled").strip().lower()
if COMPILER_BACKEND not in {"disabled", "local", "sidecar"}:
    raise ImproperlyConfigured("COMPILER_BACKEND must be disabled, local, or sidecar")

COMPILER_SIDECAR_SOCKET = os.getenv("COMPILER_SIDECAR_SOCKET", "/run/texgen/compiler.sock").strip()
if not COMPILER_SIDECAR_SOCKET or not os.path.isabs(COMPILER_SIDECAR_SOCKET):
    raise ImproperlyConfigured("COMPILER_SIDECAR_SOCKET must be an absolute socket path")

COMPILER_SOURCE_MAX_BYTES = _positive_int_setting("COMPILER_SOURCE_MAX_BYTES", 256 * 1024)
COMPILER_TIMEOUT_SECONDS = _positive_float_setting("COMPILER_TIMEOUT_SECONDS", 15)
COMPILER_PDF_MAX_BYTES = _positive_int_setting("COMPILER_PDF_MAX_BYTES", 10 * 1024 * 1024)
COMPILER_DIAGNOSTICS_MAX_BYTES = _nonnegative_int_setting("COMPILER_DIAGNOSTICS_MAX_BYTES", 4 * 1024)
COMPILER_CPU_SECONDS = _positive_int_setting("COMPILER_CPU_SECONDS", 10)
COMPILER_ADDRESS_SPACE_BYTES = _positive_int_setting("COMPILER_ADDRESS_SPACE_BYTES", 512 * 1024 * 1024)
COMPILER_FILE_SIZE_BYTES = _positive_int_setting("COMPILER_FILE_SIZE_BYTES", 10 * 1024 * 1024)
COMPILER_PROCESS_COUNT = _positive_int_setting("COMPILER_PROCESS_COUNT", 32)
COMPILER_OPEN_FILES = _positive_int_setting("COMPILER_OPEN_FILES", 64)
COMPILER_USER_QUOTA = _positive_int_setting("COMPILER_USER_QUOTA", 60)
COMPILER_QUOTA_WINDOW_SECONDS = _positive_int_setting("COMPILER_QUOTA_WINDOW_SECONDS", 3600)
COMPILER_USER_RATE = os.getenv("COMPILER_USER_RATE", "60/hour")

_COMPILER_HARD_MAXIMA = {
    "COMPILER_SOURCE_MAX_BYTES": 256 * 1024,
    "COMPILER_TIMEOUT_SECONDS": 15,
    "COMPILER_PDF_MAX_BYTES": 10 * 1024 * 1024,
    "COMPILER_DIAGNOSTICS_MAX_BYTES": 4 * 1024,
    "COMPILER_CPU_SECONDS": 10,
    "COMPILER_ADDRESS_SPACE_BYTES": 512 * 1024 * 1024,
    "COMPILER_FILE_SIZE_BYTES": 10 * 1024 * 1024,
    "COMPILER_PROCESS_COUNT": 32,
    "COMPILER_OPEN_FILES": 64,
}
for _setting_name, _maximum in _COMPILER_HARD_MAXIMA.items():
    if globals()[_setting_name] > _maximum:
        raise ImproperlyConfigured(f"{_setting_name} exceeds sidecar hard maximum")

if COMPILER_BACKEND == "local" and not DEBUG:
    try:
        import resource
    except ImportError as error:
        raise ImproperlyConfigured("local compiler requires Linux resource limits") from error
    _required_rlimits = ("RLIMIT_CPU", "RLIMIT_AS", "RLIMIT_FSIZE", "RLIMIT_NPROC", "RLIMIT_NOFILE")
    if any(not hasattr(resource, name) for name in _required_rlimits):
        raise ImproperlyConfigured("local compiler requires all configured resource limits")
