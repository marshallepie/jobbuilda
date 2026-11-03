# Local browser-rehearsal profile (Mac)

This is a **local-only, rehearsal-only** coordinator profile. It starts exactly these stdio MCP children: `identity`, `clients`, `quoting`, and `invoicing`. It starts a loopback no-consumer NATS capture for event metadata only. It does not start payments, suppliers, jobs, materials, variations, tests, reporting, or any provider-capable route set.

The profile preserves normal account-data containment. The reviewed owner-verification allowlist is the only account-data exception; it still requires a real Supabase bearer, active server-derived membership and tenant, configured owner UUID, and unexpired server-side UTC expiry. `JOBBUILDA_REHEARSAL_MODE` is prohibited.

## Preconditions

- Use the repair branch and a Mac checkout with Node and pnpm installed.
- Have the already-approved rehearsal project values only; do not create users, projects, keys, paid resources, or provider configuration.
- Keep protected files outside the repository, with owner-only permissions. Never commit, print, paste into chat, or place secrets in `.env`, `.env.local`, shell history, or browser fields.
- The expected Admin URL is `http://localhost:3002`; its API URL must be exactly `http://localhost:3000`.

## Terminal 1 — build only the required artifacts

```bash
cd /path/to/jobbuilda
git switch mepa/tenant-isolation-repair-20261101
corepack enable
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @jobbuilda/contracts build
pnpm --filter @jobbuilda/mcp-sdk build
pnpm --filter @jobbuilda/identity-mcp build
pnpm --filter @jobbuilda/clients-mcp build
pnpm --filter @jobbuilda/quoting-mcp build
pnpm --filter @jobbuilda/invoicing-mcp build
pnpm --filter @jobbuilda/coordinator build
```

The coordinator preflight refuses to start if any of the four required MCP `dist/index.js` artifacts is absent.

## Terminal 1 — create protected external files

Create these files outside the repository, for example under `~/.config/jobbuilda/`, then make them owner-readable only:

```bash
mkdir -p ~/.config/jobbuilda
chmod 700 ~/.config/jobbuilda
umask 077
$EDITOR ~/.config/jobbuilda/rehearsal-coordinator.env
$EDITOR ~/.config/jobbuilda/rehearsal-admin.env
chmod 600 ~/.config/jobbuilda/rehearsal-coordinator.env ~/.config/jobbuilda/rehearsal-admin.env
```

`~/.config/jobbuilda/rehearsal-coordinator.env` must contain only protected rehearsal configuration of this form (replace every placeholder locally; do not put values in this document):

```dotenv
JOBBUILDA_BROWSER_REHEARSAL_PROFILE=true
JOBBUILDA_REHEARSAL_SUPABASE_REF=jwnfweldmfdeapfzfunq
SUPABASE_URL=https://jwnfweldmfdeapfzfunq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<existing rehearsal service-role key>
DATABASE_URL=postgresql://<existing-user>:<existing-password>@db.jwnfweldmfdeapfzfunq.supabase.co:5432/postgres
JWT_SECRET=<existing matching rehearsal JWT secret>
PORT=3000
HOST=127.0.0.1
JOBBUILDA_VERIFICATION_OWNER_AUTH_USER_ID=<existing approved synthetic owner UUID>
JOBBUILDA_VERIFICATION_ACCESS_EXPIRES_AT=2030-01-01T01:00:00.000Z
```

Set a short real expiry before each session. On macOS, generate a canonical UTC expiry without exposing any secret:

```bash
EXPIRY="$(date -u -v+20M '+%Y-%m-%dT%H:%M:%S.000Z')"
printf 'Use this expiry only in the protected coordinator file: %s\n' "$EXPIRY"
```

Replace the expiry line in the protected coordinator file before startup. `DATABASE_URL` must be the direct `db.jwnfweldmfdeapfzfunq.supabase.co:5432/postgres` PostgreSQL target; production, foreign, malformed, pooler, and local-proxy URLs are rejected. Do **not** set `NATS_URL`, `JOBBUILDA_REHEARSAL_MODE`, `STRIPE_*`, `RESEND_*`, `ANTHROPIC_*`, SMTP, cloud-provider, or any payment/email/provider key. If either OpenTelemetry endpoint variable is set, it must be a loopback `http(s)` URL; the profile supplies an inert `http://127.0.0.1:4318/v1/traces` endpoint to the four children. The profile fails closed if the ref/URL is malformed or production (`jnwxueomquywrqcgbgfd`), or if the host is not `127.0.0.1`.

`~/.config/jobbuilda/rehearsal-admin.env` must contain only:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://jwnfweldmfdeapfzfunq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<existing rehearsal anon key>
```

## Terminal 1 — start coordinator and capture

```bash
cd /path/to/jobbuilda
JOBBUILDA_REHEARSAL_ENV_FILE="$HOME/.config/jobbuilda/rehearsal-coordinator.env" \
  pnpm --filter @jobbuilda/coordinator start:browser-rehearsal
```

Expected output identifies `http://127.0.0.1:3000` and a `nats://127.0.0.1:<ephemeral-port>` no-consumer capture. Do not alter that NATS URL or attach consumers.

## Terminal 2 — start Admin

```bash
cd /path/to/jobbuilda
set -a
source "$HOME/.config/jobbuilda/rehearsal-admin.env"
set +a
pnpm --filter @jobbuilda/admin dev
```

The Admin `dev` script binds `127.0.0.1:3002`. The rehearsal coordinator permits browser CORS only from the exact origin `http://localhost:3002` (not a configured Admin, Portal, App, IP-address, or alternate localhost origin). Use only `http://localhost:3002/login` in the browser. Do not enter credentials unless the approved browser-vault workflow supplies an existing rehearsal credential; do not request, paste, or create credentials.

## Terminal 3 — validate before browser interaction

```bash
curl --fail --silent --show-error http://127.0.0.1:3000/health
curl --silent --show-error -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/api/jobs
curl --silent --show-error -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/api/identity/profile
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:3002 -sTCP:LISTEN
```

Expected: health `200`; excluded `/api/jobs` containment `503`; uncredentialed allowlisted profile `401`; both listeners loopback-only. A valid approved owner session may then check profile, clients, quotes, and invoices only. Verify a non-owner or expired session is denied; confirm no browser action reaches payments/provider capability.

## Browser checklist and boundary

1. Navigate to `http://localhost:3002/login`.
2. Confirm the login page uses the rehearsal project and API `http://localhost:3000`.
3. Authenticate only through the existing approved vault flow; otherwise stop at the login page.
4. Check profile, clients, quotes, and invoices; record only status/result metadata.
5. Do not visit or operate payment, subscription, supplier, jobs, email, portal, reporting, or provider flows.
6. At expiry, repeat one approved route and confirm denial.

This runbook validates local process/readiness and bounded API/browser entry only. It does not make loopback listeners reachable from another machine and is not proof of a completed authenticated browser flow.

## Shutdown and close the window

In Terminal 1 press `Ctrl-C`; in Terminal 2 press `Ctrl-C`. Then remove both owner verification lines from the protected coordinator file (or set neither):

```bash
perl -i -ne 'print unless /^JOBBUILDA_VERIFICATION_(OWNER_AUTH_USER_ID|ACCESS_EXPIRES_AT)=/' \
  "$HOME/.config/jobbuilda/rehearsal-coordinator.env"
lsof -nP -iTCP:3000 -sTCP:LISTEN || true
lsof -nP -iTCP:3002 -sTCP:LISTEN || true
```

The coordinator closes its MCP children and no-consumer capture on `SIGINT`/`SIGTERM`. Do not delete fixtures or modify rehearsal data as shutdown.
