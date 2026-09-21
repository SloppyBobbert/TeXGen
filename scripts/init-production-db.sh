#!/bin/sh
# Runs once, on an empty verification database volume.
set -eu
: "${POSTGRES_APP_PASSWORD:?Set a separate application password}"

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    --set=ON_ERROR_STOP=1 --set=app_password="$POSTGRES_APP_PASSWORD" <<'SQL'
CREATE ROLE texgen LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'app_password';
ALTER DATABASE texgen OWNER TO texgen;
SQL
