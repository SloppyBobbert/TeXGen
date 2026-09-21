#!/usr/bin/env bash
# Verify prepared local images and browsers. This script does not install or download dependencies.
set -euo pipefail
cd "$(dirname "$0")/.."

test -s .pi/production-test.project
test -s .pi/production-test.env
test -x frontend/node_modules/.bin/playwright
project=$(<.pi/production-test.project)
[[ "$project" =~ ^texgen-e01s03-[a-z0-9-]+$ ]]
support="$PWD/scripts/verification_support.py"
snapshot=$(mktemp -d "$PWD/.pi/verification.XXXXXXXX")
active_pid=

# Use an interruptible wait and terminate the complete child process group on failure.
run() {
  local result=0
  python3 "$support" run "$@" <&0 &
  active_pid=$!
  wait "$active_pid" || result=$?
  active_pid=
  return "$result"
}

# Keep run() in the outer shell so its PID remains visible to the restoration trap.
capture() {
  local target=$1
  shift
  run "$@" > "$snapshot/captured-output"
  printf -v "$target" '%s' "$(<"$snapshot/captured-output")"
}

stop_active() {
  if [[ -n "$active_pid" ]]; then
    kill -TERM "$active_pid" 2>/dev/null || true
    wait "$active_pid" || true
    active_pid=
  fi
}

finish_preflight() {
  local result=$?
  trap - EXIT
  trap '' INT TERM
  stop_active
  rm -rf -- "$snapshot"
  exit "$result"
}
# Early cancellation only stops owned processes and removes private files. No stack mutation.
trap finish_preflight EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
run python3 "$support" prepare "$project" "$snapshot"
capture TEXGEN_VERIFICATION_ID python3 -c 'import uuid; print(uuid.uuid4().hex)'
export TEXGEN_VERIFICATION_ID
compose=(docker compose --project-directory "$PWD" -p "$project" -f "$snapshot/60.json")

run "${compose[@]}" config --quiet
capture images "${compose[@]}" config --images
while IFS= read -r image; do
  run docker image inspect "$image" >/dev/null
done <<< "$images"

restore() {
  local result=$?
  trap - EXIT
  trap '' INT TERM
  stop_active
  run python3 "$support" cleanup "$TEXGEN_VERIFICATION_ID" || result=1
  compose=(docker compose --project-directory "$PWD" -p "$project" -f "$snapshot/60.json")
  # Never remove application volumes. Restore dependencies and the approved request budget.
  REQUEST_THROTTLE_ANON_LIMIT=60 run "${compose[@]}" up -d --no-build --pull never --wait --wait-timeout 180 || result=1
  run "${compose[@]}" exec -T backend python -c 'import django;django.setup();from django.conf import settings;assert settings.REQUEST_THROTTLE_ANON_LIMIT == 60;print("PASS: live anonymous request budget restored to 60")' || result=1
  rm -rf -- "$snapshot"
  if (( result == 0 )); then
    printf '\nPASS: local production verification; not public TLS or production certification.\n'
  fi
  exit "$result"
}
# Enable stack restoration only after validated configuration and image preflight pass.
trap restore EXIT

printf '\n=== Startup, migrations, roles, isolation and readiness ===\n'
REQUEST_THROTTLE_ANON_LIMIT=60 run "${compose[@]}" up -d --no-build --pull never --wait --wait-timeout 180
run python3 scripts/check-production-stack.py "$project"
capture backend "${compose[@]}" ps -q backend
capture frontend "${compose[@]}" ps -q frontend
capture backend_image docker inspect --format '{{.Image}}' "$backend"
capture frontend_image docker inspect --format '{{.Image}}' "$frontend"

printf '\n=== Static HTTP, proxy scheme and private socket boundary ===\n'
TEXGEN_FRONTEND_IMAGE="$frontend_image" run python3 frontend/scripts/check-production-image.py
TEXGEN_BACKEND_IMAGE="$backend_image" TEXGEN_FRONTEND_IMAGE="$frontend_image" run python3 scripts/check-proxy-scheme.py

printf '\n=== Dependency outage, quota safety and offline PDF recovery ===\n'
run python3 scripts/check-production-failures.py "$project"
run python3 scripts/check-production-stack.py "$project"

printf '\n=== Functional browser regression (test-only anonymous budget 600) ===\n'
compose=(docker compose --project-directory "$PWD" -p "$project" -f "$snapshot/600.json")
REQUEST_THROTTLE_ANON_LIMIT=600 run "${compose[@]}" up -d --no-build --pull never --wait --wait-timeout 180
run "${compose[@]}" exec -T backend python manage.py shell < backend/tests/seed_e2e_template.py
capture frontend "${compose[@]}" ps -q frontend
capture port docker inspect --format '{{(index (index .NetworkSettings.Ports "8080/tcp") 0).HostPort}}' "$frontend"
# Existing browser assertions require this origin; do not weaken those assertions.
test "$port" = 5173
export PLAYWRIGHT_BASE_URL=http://localhost:5173
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$PWD/.pi/playwright-browsers}"
run bash -c 'cd frontend && exec ./node_modules/.bin/playwright test --workers=1 --retries=0 --reporter=line'
printf '\nRuntime/browser checks passed; restoring the default request budget.\n'
