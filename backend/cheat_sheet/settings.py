"""
Django settings for cheat_sheet project.
"""

import os
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


def env_bool(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_int(name, default, minimum=0):
    try:
        return max(minimum, int(os.getenv(name, default)))
    except (TypeError, ValueError):
        return default


def env_positive_int(name, default):
    value = os.getenv(name)
    if value is None:
        return default
    if not value.isascii() or not value.isdecimal():
        return default
    parsed = int(value)
    return parsed if parsed > 0 else default


DEBUG = env_bool("DJANGO_DEBUG", True)

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
    "whitenoise.middleware.WhiteNoiseMiddleware",
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
        conn_max_age=600,
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
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

# Keep local HTTP development convenient while defaulting production deployments
# to HTTPS when DJANGO_DEBUG=False. Set these explicitly for unusual proxies.
SECURE_PROXY_SSL_HEADER = (
    ("HTTP_X_FORWARDED_PROTO", "https")
    if env_bool("DJANGO_TRUST_X_FORWARDED_PROTO", not DEBUG)
    else None
)
SECURE_SSL_REDIRECT = env_bool("DJANGO_SECURE_SSL_REDIRECT", not DEBUG)
SESSION_COOKIE_SECURE = env_bool("DJANGO_SESSION_COOKIE_SECURE", not DEBUG)
CSRF_COOKIE_SECURE = env_bool("DJANGO_CSRF_COOKIE_SECURE", not DEBUG)
SECURE_HSTS_SECONDS = env_int(
    "DJANGO_SECURE_HSTS_SECONDS", 31536000 if not DEBUG else 0
)
SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool(
    "DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS", not DEBUG
)
SECURE_HSTS_PRELOAD = env_bool("DJANGO_SECURE_HSTS_PRELOAD", False)
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",")
    if origin.strip()
]

# Bound request parsing and LaTeX compilation resources. Values are bytes except
# for LATEX_COMPILE_TIMEOUT_SECONDS.
LATEX_MAX_REQUEST_BYTES = env_positive_int("LATEX_MAX_REQUEST_BYTES", 262144)
DATA_UPLOAD_MAX_MEMORY_SIZE = env_positive_int(
    "DJANGO_DATA_UPLOAD_MAX_MEMORY_SIZE", LATEX_MAX_REQUEST_BYTES
)
LATEX_MAX_INPUT_BYTES = env_positive_int("LATEX_MAX_INPUT_BYTES", 200000)
LATEX_MAX_OUTPUT_BYTES = env_positive_int("LATEX_MAX_OUTPUT_BYTES", 10000000)
LATEX_COMPILE_TIMEOUT_SECONDS = env_positive_int("LATEX_COMPILE_TIMEOUT_SECONDS", 15)
LATEX_COMPILE_CPU_SECONDS = env_positive_int("LATEX_COMPILE_CPU_SECONDS", 10)
DEFAULT_LATEX_MEMORY_LIMIT_BYTES = 320 * 1024 * 1024
LATEX_MEMORY_LIMIT_BYTES = env_positive_int(
    "LATEX_MEMORY_LIMIT_BYTES", DEFAULT_LATEX_MEMORY_LIMIT_BYTES
)
LATEX_COMPILE_FILE_SIZE_BYTES = env_positive_int(
    "LATEX_COMPILE_FILE_SIZE_BYTES", 12000000
)
LATEX_COMPILE_PROCESS_LIMIT = env_positive_int("LATEX_COMPILE_PROCESS_LIMIT", 16)
LATEX_COMPILE_DIAGNOSTIC_BYTES = env_positive_int(
    "LATEX_COMPILE_DIAGNOSTIC_BYTES", 16384
)
LATEX_COMPILE_MAX_CONCURRENT = env_positive_int("LATEX_COMPILE_MAX_CONCURRENT", 1)
LATEX_COMPILE_RATE_LIMIT = env_positive_int("LATEX_COMPILE_RATE_LIMIT", 10)
LATEX_COMPILE_RATE_WINDOW_SECONDS = env_positive_int(
    "LATEX_COMPILE_RATE_WINDOW_SECONDS", 60
)
DEFAULT_TECTONIC_CACHE_SEED_DIR = "/var/cache/tectonic"
TECTONIC_CACHE_SEED_DIR = os.getenv(
    "TECTONIC_CACHE_SEED_DIR", DEFAULT_TECTONIC_CACHE_SEED_DIR
)

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
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
}

SIMPLE_JWT = {
    "SIGNING_KEY": JWT_SIGNING_KEY,
}
