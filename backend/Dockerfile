FROM python:3.14.3

ARG TECTONIC_CACHE_MAX_BYTES=262144000

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HOME=/app \
    TMPDIR=/tmp \
    TECTONIC_CACHE_SEED_DIR=/var/cache/tectonic \
    XDG_CACHE_HOME=/var/cache/tectonic

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    wget \
    tar \
    fontconfig \
    libpq-dev \
    pkg-config \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Download and extract the appropriate Tectonic binary for the container CPU.
RUN ARCH=$(uname -m) && \
    case "$ARCH" in \
    aarch64) TECTONIC_URL="https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.15.0/tectonic-0.15.0-aarch64-unknown-linux-musl.tar.gz"; TECTONIC_SHA256="1f59f9fb8eb65e8ba18658fc9016767e7d3e12488ded8b8fffa34254e51ce42c" ;; \
    x86_64) TECTONIC_URL="https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.15.0/tectonic-0.15.0-x86_64-unknown-linux-musl.tar.gz"; TECTONIC_SHA256="dfb82876f2986862996e564fa507a9e576e0c1e3bee63c2c1bd677c2543e6407" ;; \
    *) echo "Unsupported architecture: $ARCH" >&2; exit 1 ;; \
    esac && \
    wget -qO /tmp/tectonic.tar.gz "$TECTONIC_URL" && \
    printf '%s  %s\n' "$TECTONIC_SHA256" /tmp/tectonic.tar.gz | sha256sum -c - && \
    tar -xzf /tmp/tectonic.tar.gz && \
    mv tectonic /usr/local/bin/ && \
    rm /tmp/tectonic.tar.gz

# Prime the bundle cache with the package closure used by generated cheat sheets.
RUN mkdir -p /var/cache/tectonic /tmp/tectonic-warmup-out && \
    printf '\\documentclass{article}\n\\begin{document}\nWarmup\\end{document}\n' > /tmp/tectonic-minimal.tex && \
    printf '\\documentclass[9pt,fleqn,letterpaper]{extarticle}\n\\usepackage[letterpaper,margin=0.15in]{geometry}\n\\usepackage{amsmath,amssymb,enumitem,multicol,adjustbox}\n\\begin{document}\n\\begin{multicols}{2}Warmup\\end{multicols}\n\\end{document}\n' > /tmp/tectonic-generated.tex && \
    tectonic --outdir /tmp/tectonic-warmup-out /tmp/tectonic-minimal.tex && \
    tectonic --outdir /tmp/tectonic-warmup-out /tmp/tectonic-generated.tex && \
    test "$(du -sb /var/cache/tectonic | cut -f1)" -le "$TECTONIC_CACHE_MAX_BYTES"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN python manage.py collectstatic --noinput
RUN useradd --uid 10001 --home-dir /app --no-create-home --shell /usr/sbin/nologin app && \
    chown -R app:app /app /tmp/tectonic-warmup-out && \
    chown -R root:root /var/cache/tectonic && \
    chmod -R a+rX /var/cache/tectonic

EXPOSE 8000

USER app

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--worker-class", "gthread", "--workers", "1", "--threads", "2", "--timeout", "30", "--graceful-timeout", "30", "--access-logfile", "-", "--error-logfile", "-", "cheat_sheet.wsgi:application"]
