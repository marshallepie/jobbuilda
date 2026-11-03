# GDPR delete local rehearsal

## Boundary

Use this procedure only for the repair commit in an operator-controlled local or isolated rehearsal database containing synthetic data. It does not authorize a deployment, production access, provider calls, or a browser test. Keep production containment unchanged.

Do not copy credentials, bearer tokens, protected runtime files, `node_modules`, build output, or generated evidence artifacts into Git, chat, tickets, or another checkout. Keep the protected environment file outside this repository, for example `<protected-path>/jobbuilda-rehearsal.env`, with operator-supplied values only:

```sh
NODE_ENV=test
JOBBUILDA_REHEARSAL_MODE=true
JOBBUILDA_REHEARSAL_SUPABASE_REF=jwnfweldmfdeapfzfunq
SUPABASE_URL=https://jwnfweldmfdeapfzfunq.supabase.co
JOBBUILDA_REHEARSAL_DATABASE_URL=<isolated-rehearsal-postgres-URL>
JOBBUILDA_REHEARSAL_SUPABASE_SERVICE_ROLE_KEY=<protected-local-service-role-key>
JOBBUILDA_REHEARSAL_A_PASSWORD=<protected-synthetic-A-password>
```

The supplied database URL must not refer to the production ref `jnwxueomquywrqcgbgfd`. The harness rejects that ref and rejects any non-test configuration. Use only the existing synthetic A/B fixtures and mappings expected by the harness; it creates a temporary synthetic client, verifies deletion/readback, and cleans it up. Its local NATS capture has no consumers, so it observes real service publishes without live provider effects.

## Resources and prerequisites

- Node.js `>=20.11.0` and pnpm `>=9.0.0` (from the root manifest).
- The repository's locked dependencies installed by the operator; do not copy an existing `node_modules` tree.
- Built `dist/index.js` artifacts for identity, clients, quoting, and invoicing MCP services. The rehearsal harness checks these before contacting the database.
- Network reachability only to the approved isolated rehearsal Supabase/database endpoint. No production endpoint, browser bridge, or local service publication is required.
- An operator who controls the protected credential file and has already prepared the synthetic A/B membership/fixture state described in `two-tenant-isolation-acceptance-runbook.md`.

## Commands

From the repository root at the repair commit, run the declared coordinator build script, then load the protected file only into the current shell and invoke the declared rehearsal script:

```sh
pnpm --filter @jobbuilda/coordinator build
set -a
. <protected-path>/jobbuilda-rehearsal.env
set +a
pnpm --filter @jobbuilda/coordinator test:two-tenant-isolation
```

The operator must preserve the harness output in an access-controlled evidence store and confirm that the final cleanup/readback records show no temporary client/site, zero active B2 mapping, and the expected no-consumer NATS captures. Stop on any `REHEARSAL_BLOCKED` output or unexpected status; retain containment and do not retry against production.

## Expected GDPR assertions

The focused real registered-route regression (`apps/coordinator/test/verification-owner-access.test.ts`) proves the request ordering without external credentials: an authenticated configured owner may delete only an owned client with exactly `?confirm=true` (`200`); a confirmed foreign client returns `404` with no mutation; and an owned client without the query reaches the same authenticated owner-gated handler but returns `404` without invoking the delete tool. Browser authentication is not exercised by this procedure.