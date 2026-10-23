#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
node scripts/verify-catalog.mjs
npm --prefix ui run check
cargo fmt --all -- --check
cargo clippy --offline --locked --release --all-targets -- -D warnings
cargo test --offline --locked --release
cargo build --offline --locked --release
