#!/bin/sh
# Validate all inputs and the complete TLS configuration before opening listeners.
set -eu
export LC_ALL=C
if ! printf '%s\n' "${TEXGEN_PUBLIC_HOST:-}" | awk '
    length($0) > 253 || NF != 1 { exit 1 }
    {
        n = split($0, labels, ".")
        if (n < 2 || labels[n] !~ /^[a-z][a-z]*$/) exit 1
        for (i = 1; i <= n; i++)
            if (length(labels[i]) > 63 || labels[i] !~ /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/) exit 1
    }
    END { if (NR != 1) exit 1 }
'; then
    echo 'Invalid public DNS hostname' >&2
    exit 1
fi
for file in /run/texgen-tls/fullchain.pem /run/texgen-tls/privkey.pem; do
    if [ ! -f "$file" ] || [ ! -r "$file" ] || [ ! -s "$file" ]; then
        echo 'Missing or unreadable TLS file' >&2
        exit 1
    fi
done
# Explicit allowlist: never expand Nginx $scheme, $host, $uri, etc.
envsubst '${TEXGEN_PUBLIC_HOST}' < /etc/nginx/public.conf.template > /tmp/public-nginx.conf
nginx -t -c /tmp/public-nginx.conf
exec nginx -c /tmp/public-nginx.conf -g 'daemon off;'
