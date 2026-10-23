#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ "$(node --version)" != 'v24.15.0' ]; then
  printf '%s\n' 'This checkout is verified with Node.js 24.15.0. Toolchain installation needs separate approval.' >&2
  exit 1
fi
case "$(rustc --version)" in
  'rustc 1.92.0 '*) ;;
  *) printf '%s\n' 'This checkout is verified with Rust 1.92.0. Toolchain installation needs separate approval.' >&2; exit 1 ;;
esac
printf '%s\n' 'Tool versions match. This script did not install or download dependencies.'
printf '%s\n' 'Read README.md before you install the locked dependency set.'
