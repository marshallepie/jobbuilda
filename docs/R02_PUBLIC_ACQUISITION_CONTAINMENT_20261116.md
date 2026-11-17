# R02 public-acquisition containment checkpoint — 2026-11-16

## Scope and evidence boundary

This is a source-review and focused-test checkpoint at commit `2cb6ade7b53abde3a7b67ebf60d59975025c56e0`. It is not evidence of a deployed-runtime check or a disposable-database authorization-flow pass.

## Source review

- `POST /api/auth/register` immediately returns `503` with `REGISTRATION_PAUSED` before persistence or Stripe activity.
- Web `/signup`, `/onboarding`, `/verify`, and `/welcome` resolve to maintenance pages.
- Admin `/signup` and `/onboarding` resolve to maintenance pages.

## Focused-test record

- Account-isolation containment test: passed **4/4**; Stripe customer and checkout spies recorded zero calls.
- Public-acquisition maintenance test: passed **4/4**.

## Containment status

Public registration remains closed. R02 is not marked fully complete by this checkpoint: deployed-runtime validation and disposable-database authorization-flow evidence are outside this record.

No production, database, or provider writes occurred for this source review and focused-test checkpoint.

## Independent source-review checkpoint — 2026-11-17

This independent source-review checkpoint covers commit `87ddcf4b6f625a48b940ea59878e703c959e896b` only. All reviewed public acquisition routes were fail-closed.

- `node --test apps/web/test/public-acquisition-maintenance.test.mjs`: passed **4/4**.
- From `apps/coordinator`, `STRIPE_SECRET_KEY=sk_test_readonly_review_placeholder node --import tsx --test test/account-isolation-containment.test.ts test/server-auth-tenant-isolation.test.ts`: passed **9/9**.
- No provider calls or production writes occurred.

R02 is not complete. Provider/Auth direct registration configuration and deployed-runtime validation remain unverified.

## Provider/Auth configuration checkpoint — 2026-11-17T06:25:08Z

- Read-only management request: `GET https://api.supabase.com/v1/projects/jnwxueomquywrqcgbgfd/config/auth` returned `200`.
- The returned JSON included `disable_signup: false`.
- No provider configuration, database, deployment, application code, or script writes occurred.

**Conclusion:** Direct Auth registration is open. R02 cannot claim public acquisition is fully closed while this provider/Auth setting remains enabled.

**Safe next action:** Before a provider configuration change, complete the required production-change preflight: read the current configuration as rollback evidence; verify backup, rollback, and deployment evidence; obtain independent review; and confirm the exact scope. Use standing authority only if those gates pass, PATCH only `disable_signup=true`, and read back the configuration.

## Production R02 Auth-configuration closure checkpoint — 2026-11-17

- **Provider configuration confirmed:** for Supabase project `jnwxueomquywrqcgbgfd`, the precondition read showed `disable_signup: false`; the authorized management API PATCH payload was only `{"disable_signup":true}`. Its response and an independent subsequent GET both confirmed `disable_signup: true` (pre/post evidence SHA-256: `a5b8af3b18b386459d282dadc3596072451290cd2352e01e1cb927f8ec00c570` / `4d081e6a233381ce2c3e1ea812fda2a577b03954f5fbf0bfef6e4b902cfa60db`).
- **Coordinator containment confirmed:** Railway production coordinator service `8b2e94af-0ed8-4f8b-a157-5f47630780eb` was live with no staged changes; its health endpoint and `api.jobbuilda.co.uk` reported database OK. After the provider change, `POST https://jobbuilda-production.up.railway.app/api/auth/register` returned `503 REGISTRATION_PAUSED` without record creation. This confirms the provider setting and coordinator acquisition containment, not every R02 browser entry.
- **Backup evidence boundary:** provider was `ACTIVE_HEALTHY`; latest completed physical backup was `2287622325` at `2026-11-17T00:10:00.556Z` (`walg` enabled; PITR disabled). This is backup-availability evidence, **not** an exercised restore.
- **Still unverified / gated:** Vercel connector account `jobbuilda-prod` listed no projects, so frontend/admin host binding remains unverified. R01, R01a, and R03 remain database-backed authorization and rehearsal gates. This checkpoint does not claim whole-recovery completion or completion of all R02 browser entries.
