FROM python:3.14.3 AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    fontconfig \
    libpq-dev \
    pkg-config \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-bootstrap.txt .
RUN python -m pip install --no-cache-dir --only-binary=:all: --no-deps --require-hashes -r requirements-bootstrap.txt

COPY requirements.txt requirements.lock ./
RUN python -m pip install --no-cache-dir -r requirements.txt -c requirements.lock

COPY . .

FROM base AS production

RUN groupadd --gid 10001 texgen \
    && useradd --uid 10001 --gid texgen --no-create-home --shell /usr/sbin/nologin texgen \
    && mkdir -p /run/texgen-web /app/staticfiles \
    && chown 10001:10001 /run/texgen-web /app/staticfiles \
    && chmod 0750 /run/texgen-web

ENV DJANGO_SETTINGS_MODULE=cheat_sheet.production \
    DJANGO_DEBUG=False

USER 10001:10001
CMD ["gunicorn", "--config", "gunicorn.conf.py", "cheat_sheet.wsgi:application"]

# Keep the existing development behavior as the default build target.
FROM base AS development

EXPOSE 8000

CMD ["sh", "-c", "until pg_isready -h db -U cheatsheet_user; do sleep 2; done && python manage.py migrate && python manage.py runserver 0.0.0.0:8000"]
