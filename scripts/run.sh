#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ ! -d ui/node_modules ]; then
  printf '%s\n' 'UI dependencies are missing. Read README.md and obtain installation approval first.' >&2
  exit 1
fi
npm --prefix ui run build
exec cargo run --offline --locked --release -- "$@"
