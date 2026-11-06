#!/bin/bash
# Step-35 local browser-rehearsal runner for the restricted repair profile.
# Run from the root of the checked-out repair branch on macOS. It never opens a
# browser, prints dotenv values, or stops processes it did not start.

set -euo pipefail

BRANCH='mepa/tenant-isolation-repair-20261101'
REHEARSAL_REF='jwnfweldmfdeapfzfunq'
COORDINATOR_ENV="$HOME/.config/jobbuilda/rehearsal-coordinator.env"
ADMIN_ENV="$HOME/.config/jobbuilda/rehearsal-admin.env"
COORDINATOR_PID=''
ADMIN_PID=''
CLEANUP_ARMED=0

progress() { printf '[step-35] %s\n' "$*"; }
fail() { printf '[step-35] ERROR: %s\n' "$*" >&2; exit 1; }

require_macos() {
  [ "$(uname -s)" = 'Darwin' ] || fail 'this runner is for a macOS checkout only'
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command is unavailable: $1"
}

# Do not source either dotenv file while validating it: validation must not put
# secret values into this shell or its diagnostic output.
require_owner_mode_600() {
  local file=$1 owner mode
  [ -f "$file" ] || fail "protected file is missing: $file"
  owner="$(stat -f '%u' "$file")"
  mode="$(stat -f '%Lp' "$file")"
  [ "$owner" = "$(id -u)" ] || fail "protected file is not owned by the current user: $file"
  [ "$mode" = '600' ] || fail "protected file must have mode 600: $file"
}

require_single_exact_line() {
  local file=$1 expected=$2 count
  count="$(grep -Fxc "$expected" "$file" || true)"
  [ "$count" = '1' ] || fail "required non-secret marker is absent or duplicated in: $file"
}

require_single_nonempty_key() {
  local file=$1 key=$2 count
  count="$(grep -Ec "^${key}=.+$" "$file" || true)"
  [ "$count" = '1' ] || fail "required protected value is absent or duplicated in: $file"
}

# Restrict dotenv syntax to the reviewed key lists. This fails closed on export
# syntax, shell interpolation, and unexpected configuration without echoing it.
require_only_allowed_keys() {
  local file=$1 allowed=$2
  ALLOWED_KEYS="$allowed" perl -e '
    my %allowed = map { $_ => 1 } split /,/, $ENV{ALLOWED_KEYS};
    while (<>) {
      next if /^\s*(?:#|$)/;
      if (/^([A-Za-z_][A-Za-z0-9_]*)=/) {
        exit 1 unless $allowed{$1};
        next;
      }
      exit 1;
    }
  ' "$file" || fail "protected file contains unsupported or forbidden configuration: $file"
}

assert_port_free() {
  local port=$1
  # Keep these lsof checks separate, as required by the Mac runbook.
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    fail "TCP port $port is already listening; do not stop an unrelated process"
  fi
}

assert_exact_loopback_listener() {
  local port=$1 names
  names="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -Fn 2>/dev/null | sed -n 's/^n//p')"
  [ "$names" = "127.0.0.1:$port" ] || fail "TCP port $port is not listening exclusively on 127.0.0.1"
}

wait_for_http_code() {
  local url=$1 expected=$2 label=$3 attempt code
  for attempt in $(seq 1 30); do
    code="$(curl --silent --show-error -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || true)"
    if [ "$code" = "$expected" ]; then return 0; fi
    sleep 1
  done
  fail "$label did not return HTTP $expected"
}

wait_for_listener() {
  local port=$1 attempt
  for attempt in $(seq 1 30); do
    if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  fail "TCP port $port did not start listening"
}

refresh_expiry_atomically() {
  local expiry temp
  expiry="$(date -u -v+20M '+%Y-%m-%dT%H:%M:%S.000Z')"
  temp="$(mktemp "${COORDINATOR_ENV}.tmp.XXXXXX")"
  # Accept zero or one expiry lines: append a fresh one when absent and replace
  # it when present. Duplicate lines fail closed. The temporary file remains
  # owner-only and mv is atomic within the protected file's directory on macOS.
  if ! EXPIRY_VALUE="$expiry" perl -0pe '
    my $replacement = $ENV{EXPIRY_VALUE};
    my $count = s/^JOBBUILDA_VERIFICATION_ACCESS_EXPIRES_AT=.*$/JOBBUILDA_VERIFICATION_ACCESS_EXPIRES_AT=$replacement/mg;
    die "duplicate expiry markers\n" if $count > 1;
    if ($count == 0) {
      $_ .= "\n" unless /\n\z/;
      $_ .= "JOBBUILDA_VERIFICATION_ACCESS_EXPIRES_AT=$replacement\n";
    }
  ' "$COORDINATOR_ENV" >"$temp"; then
    rm -f "$temp"
    fail 'could not refresh the protected verification expiry'
  fi
  chmod 600 "$temp"
  mv -f "$temp" "$COORDINATOR_ENV"
  # Never print the time or any dotenv contents; its existence is sufficient.
  progress 'verification expiry refreshed for the bounded local session'
}

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  progress 'stopping only Step-35 processes and closing the verification gate'
  if [ -n "$COORDINATOR_PID" ] && kill -0 "$COORDINATOR_PID" 2>/dev/null; then
    kill -INT "$COORDINATOR_PID" 2>/dev/null || true
  fi
  if [ -n "$ADMIN_PID" ] && kill -0 "$ADMIN_PID" 2>/dev/null; then
    kill -INT "$ADMIN_PID" 2>/dev/null || true
  fi
  [ -z "$COORDINATOR_PID" ] || wait "$COORDINATOR_PID" 2>/dev/null || true
  [ -z "$ADMIN_PID" ] || wait "$ADMIN_PID" 2>/dev/null || true
  if [ "$CLEANUP_ARMED" = '1' ]; then
    # Preserve the pre-approved owner marker. Removing the expiry alone returns
    # every verification route to the server's missing-expiry default-off state.
    perl -i -ne 'print unless /^JOBBUILDA_VERIFICATION_ACCESS_EXPIRES_AT=/' \
      "$COORDINATOR_ENV"
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

require_macos
for command in git pnpm corepack perl curl lsof stat date mktemp; do require_command "$command"; done

progress 'validating checkout identity and remote tracking reference'
[ "$(git rev-parse --show-toplevel)" = "$PWD" ] || fail 'run this script from the checkout root'
[ "$(git branch --show-current)" = "$BRANCH" ] || fail "current branch must be $BRANCH"
[ "$(git rev-parse --abbrev-ref '@{upstream}')" = "origin/$BRANCH" ] || fail 'the branch must track its named origin repair ref'
git fetch --quiet origin "$BRANCH"
LOCAL_HEAD="$(git rev-parse HEAD)"
TRACKING_HEAD="$(git rev-parse "refs/remotes/origin/$BRANCH")"
REMOTE_HEAD="$(git ls-remote origin "refs/heads/$BRANCH" | awk '{print $1}')"
[ -n "$REMOTE_HEAD" ] || fail 'named origin repair ref was not found'
[ "$LOCAL_HEAD" = "$TRACKING_HEAD" ] || fail 'local HEAD does not exactly match origin tracking ref'
[ "$LOCAL_HEAD" = "$REMOTE_HEAD" ] || fail 'origin tracking ref does not exactly match remote repair ref'
git diff --quiet || fail 'tracked working-tree changes are not allowed'
git diff --cached --quiet || fail 'staged changes are not allowed'

progress 'validating protected rehearsal configuration without reading values'
require_owner_mode_600 "$COORDINATOR_ENV"
require_owner_mode_600 "$ADMIN_ENV"
require_only_allowed_keys "$COORDINATOR_ENV" 'JOBBUILDA_BROWSER_REHEARSAL_PROFILE,JOBBUILDA_REHEARSAL_SUPABASE_REF,SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,DATABASE_URL,PORT,HOST,JOBBUILDA_VERIFICATION_OWNER_AUTH_USER_ID,JOBBUILDA_VERIFICATION_ACCESS_EXPIRES_AT'
require_only_allowed_keys "$ADMIN_ENV" 'NEXT_PUBLIC_API_URL,NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY'
require_single_exact_line "$COORDINATOR_ENV" 'JOBBUILDA_BROWSER_REHEARSAL_PROFILE=true'
require_single_exact_line "$COORDINATOR_ENV" "JOBBUILDA_REHEARSAL_SUPABASE_REF=$REHEARSAL_REF"
require_single_exact_line "$COORDINATOR_ENV" "SUPABASE_URL=https://$REHEARSAL_REF.supabase.co"
require_single_exact_line "$COORDINATOR_ENV" 'HOST=127.0.0.1'
require_single_exact_line "$COORDINATOR_ENV" 'PORT=3000'
require_single_nonempty_key "$COORDINATOR_ENV" 'SUPABASE_SERVICE_ROLE_KEY'
require_single_nonempty_key "$COORDINATOR_ENV" 'DATABASE_URL'
require_single_nonempty_key "$COORDINATOR_ENV" 'JOBBUILDA_VERIFICATION_OWNER_AUTH_USER_ID'
require_single_exact_line "$ADMIN_ENV" 'NEXT_PUBLIC_API_URL=http://127.0.0.1:3000'
require_single_exact_line "$ADMIN_ENV" "NEXT_PUBLIC_SUPABASE_URL=https://$REHEARSAL_REF.supabase.co"
require_single_nonempty_key "$ADMIN_ENV" 'NEXT_PUBLIC_SUPABASE_ANON_KEY'

progress 'checking that the two documented local ports are free'
assert_port_free 3000
assert_port_free 3002

progress 'installing and building the documented restricted artifacts'
corepack enable
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @jobbuilda/contracts run test:clean-build
pnpm --filter @jobbuilda/mcp-sdk build
pnpm --filter @jobbuilda/identity-mcp build
pnpm --filter @jobbuilda/clients-mcp build
pnpm --filter @jobbuilda/quoting-mcp build
pnpm --filter @jobbuilda/invoicing-mcp build
pnpm --filter @jobbuilda/coordinator build
# This tracked incremental metadata is generated by the build. Restore only it;
# do not clean untracked fixture or evidence directories.
git checkout -- packages/mcp-sdk/tsconfig.tsbuildinfo
git diff --quiet || fail 'the build changed tracked source outside the permitted generated metadata'
git diff --cached --quiet || fail 'the build created staged changes'

refresh_expiry_atomically
CLEANUP_ARMED=1

progress 'starting the loopback-only browser rehearsal coordinator'
env -i PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" \
  JOBBUILDA_REHEARSAL_ENV_FILE="$COORDINATOR_ENV" \
  pnpm --filter @jobbuilda/coordinator start:browser-rehearsal &
COORDINATOR_PID=$!
wait_for_http_code 'http://127.0.0.1:3000/health' '200' 'coordinator health check'

progress 'starting Admin with configuration sourced only from its protected file'
env -i PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" ADMIN_ENV="$ADMIN_ENV" /bin/bash -c '
  set -a
  source "$ADMIN_ENV"
  set +a
  exec pnpm --filter @jobbuilda/admin dev
' &
ADMIN_PID=$!
wait_for_listener 3002
wait_for_http_code 'http://127.0.0.1:3002/login' '200' 'Admin login route check'

progress 'running required API and loopback listener preflight checks'
wait_for_http_code 'http://127.0.0.1:3000/health' '200' 'coordinator health check'
wait_for_http_code 'http://127.0.0.1:3000/api/jobs' '503' 'contained jobs route check'
wait_for_http_code 'http://127.0.0.1:3000/api/identity/profile' '401' 'uncredentialed profile check'
assert_exact_loopback_listener 3000
assert_exact_loopback_listener 3002
progress 'preflight passed; no browser was launched. Press Ctrl-C here to stop and close the gate.'

# Keep the bounded local rehearsal alive until the operator interrupts it. Any
# child exit, Ctrl-C, TERM, or normal shell exit reaches the cleanup trap above.
wait "$COORDINATOR_PID"
