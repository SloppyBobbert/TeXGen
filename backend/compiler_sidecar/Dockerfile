FROM python:3.14-slim-bookworm@sha256:416f0db2a2b561945630cef9877a7ea0581b27449eb9fd9df42f03e1b74b5b63

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    TMPDIR=/work \
    XDG_CACHE_HOME=/opt/compiler-assets/formats \
    TECTONIC_CACHE_DIR=/opt/compiler-assets/cache

WORKDIR /app

# Assets are acquired and verified before the image build; this image never downloads them.
COPY compiler_sidecar/container/verify_assets.py /usr/local/bin/verify-compiler-assets
COPY --chown=10001:10001 .compiler-assets/ /opt/compiler-assets/
RUN python /usr/local/bin/verify-compiler-assets /opt/compiler-assets

COPY --chown=10001:10001 compiler_sidecar/ /app/compiler_sidecar/
COPY --chown=10001:10001 api/ /app/api/
RUN mkdir -p /run/texgen /work && chown 10001:10001 /run/texgen /work

USER 10001:10001

CMD ["python", "-m", "compiler_sidecar.server"]
