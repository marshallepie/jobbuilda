# Two-synthetic-tenant isolation acceptance runbook

## Purpose and boundary

Use this acceptance procedure only to decide whether the tenant-isolation repair candidate has the required evidence to consider a future, separately authorized recovery decision. It is **not** authorization to reopen, deploy, merge, unpause, or otherwise change production.

- Run only against an isolated staging or local database populated solely with synthetic data.
- Keep production containment active throughout and after this procedure.
- Do not use production identities, tenant data, customer data, identifiers, credentials, bearer tokens, or screenshots containing any of them.
- There is currently **no selective local/staging re-open harness** in this candidate. Therefore this runbook cannot authorize a partial or full re-open; production containment must remain active pending a separately reviewed recovery mechanism and decision.

Apply and follow the [tenant membership mapping manual backfill and revocation runbook](tenant-membership-backfill-runbook.md). The mapping schema and active-lookup invariant are defined in [`services/identity-mcp/migrations/5_add_auth_tenant_memberships.sql`](../services/identity-mcp/migrations/5_add_auth_tenant_memberships.sql).

## Synthetic fixture setup

1. Create exactly two synthetic Auth accounts, **A** and **B**, in the isolated environment.
2. Manually map A to one synthetic application user in synthetic tenant A, and B to a different synthetic application user in synthetic tenant B. Use reviewed tuples and the transactional procedure in the linked membership runbook; do not infer mappings from metadata, browser claims, headers, email, or identifier shape.
3. For each tenant, create a distinct synthetic business profile, client, quote, and invoice. Record fixture aliases only (for example `A-client`, `B-quote`), never literal IDs or customer-like data.
4. Obtain and retain an already-issued bearer for each synthetic Auth account. Keep test material in the approved isolated-environment evidence store, not source control.

## Required reciprocal handler tests

Exercise the deployed candidate's real coordinator handlers and downstream service/database path, not mocks, direct database queries, or only unit-test injection. Run every applicable request twice: A attempting B's fixture, then B attempting A's fixture.

| Family | Required operations | Expected same-tenant outcome | Expected reciprocal outcome |
| --- | --- | --- | --- |
| Business profile | read and update | Each account can read and make a harmless synthetic update only to its own profile. | The other account cannot read or update the profile; no B data is returned to A and no A data is returned to B. |
| Client | list, read by ID, create/update | Lists contain only that tenant's fixtures; own client reads and harmless writes succeed. | Foreign fixture is absent from lists and foreign reads/writes are denied or indistinguishable as not found; no write occurs. |
| Quote | list, read by ID, create/update | Lists contain only that tenant's fixtures; own quote reads and harmless writes succeed. | Foreign fixture is absent from lists and foreign reads/writes are denied or indistinguishable as not found; no write occurs. |
| Invoice | list, read by ID, create/update | Lists contain only that tenant's fixtures; own invoice reads and harmless writes succeed. | Foreign fixture is absent from lists and foreign reads/writes are denied or indistinguishable as not found; no write occurs. |

For every foreign ID request, repeat the relevant read and write while supplying forged `x-tenant-id`, `x-user-id`, and `x-scopes` headers selecting the other synthetic tenant/user. The candidate must reject caller-selected identity headers before the handler/service is reached (expected `401`), and must not return or mutate either tenant's data. Do not treat a client-side UI restriction as a pass.

Do not request or test a tenant-selection control: there must be **no tenant switch** in the browser or API workflow. The authenticated server-side identity plus active membership is the sole tenant authority.

## Revocation and browser-session checks

1. With A's already-issued bearer, first prove a same-tenant request succeeds.
2. Revoke A's active synthetic mapping transactionally using the linked membership runbook; verify its active membership lookup count is zero.
3. Reuse that exact already-issued bearer against a protected business-profile, client, quote, and invoice handler. Each request must now fail closed (expected `403` for a verified bearer with no active mapping), without returning or mutating data.
4. In a browser, sign in as A, confirm only A's synthetic fixture aliases are visible, then log out. After logout, use browser navigation and any retained application session state to attempt protected profile/client/quote/invoice access. Requests must be unauthenticated or fail closed; no prior tenant data may render from an authenticated response.
5. Restore only the synthetic mapping needed for clean-up through the linked reviewed procedure, then remove synthetic fixtures/accounts according to the isolated environment's retention rules. Do not touch production mappings.

## Evidence and acceptance record

For each request, capture an access-controlled record containing:

- environment classification (`local` or isolated `staging`), candidate commit/ref, timestamp, operator, and independent reviewer;
- synthetic account alias, tenant alias, fixture alias, handler family/operation, and whether the request is own-tenant or reciprocal;
- request method and route template only; redact literal path/query IDs, bearer values, cookies, and payload values;
- response status, assertion (returned only own alias / foreign absent / foreign write unchanged / forged header rejected / revoked bearer denied / post-logout denied), and a redacted response summary;
- before-and-after synthetic fixture state for every attempted write; and
- mapping-revocation transaction outcome and the verified zero active-lookup count.

Acceptance requires all same-tenant operations to succeed, all reciprocal reads/lists/writes to fail without disclosure or mutation, all forged-header attempts to be rejected, the already-issued bearer to fail after revocation, and post-logout protected access to fail. Any unexpected success, disclosure, mutation, missing handler coverage, inability to prove a result against a real handler, or missing evidence is a failure: preserve containment and record the gap. This runbook itself does not authorize production recovery.
