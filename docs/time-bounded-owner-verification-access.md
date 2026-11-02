# Time-bounded owner verification access

Global account-data containment remains enabled. The coordinator has a narrow, default-off verification path only for a production-approved owner test.

## Required server-side configuration

Configure both values only in the coordinator's server environment after separate production change approval. Do not place either value in browser configuration, request headers, query parameters, bodies, user metadata, or source control.

- `JOBBUILDA_VERIFICATION_OWNER_AUTH_USER_ID`: the exact Supabase Auth user UUID of the one approved owner.
- `JOBBUILDA_VERIFICATION_ACCESS_EXPIRES_AT`: an absolute UTC expiry timestamp in canonical ISO-8601 form, for example `2030-01-01T01:00:00.000Z`.

The mechanism is disabled when either value is missing or malformed. It returns `503` for malformed/missing configuration and `403` after the configured expiry. Removing either value closes the verification exception again.

## Required request checks

A request must pass all of the following, in order:

1. It must match one listed method/path exactly; other methods, route families, and deeper paths remain contained with `503`.
2. It must present a normally verified Supabase bearer token and have exactly one active, unrevoked membership.
3. That membership must join to a same-tenant `public.users` record with `role = 'admin'`.
4. The verified Supabase Auth user UUID must exactly equal `JOBBUILDA_VERIFICATION_OWNER_AUTH_USER_ID`.
5. The server clock must be before `JOBBUILDA_VERIFICATION_ACCESS_EXPIRES_AT`.

Tenant, user, scope, expiry, and owner selection never come from callers. Caller-selected tenant/user/scope headers are rejected.

## Allowlist

- `GET /api/identity/profile`
- `GET /api/clients/clients`
- `GET /api/clients/clients/:clientId`
- `POST /api/clients/clients`
- `PATCH /api/clients/clients/:clientId`
- `DELETE /api/clients/clients/:clientId`
- `GET /api/quotes`
- `GET /api/quotes/:id`
- `GET /api/invoices`
- `GET /api/invoices/:id`

This is not authorization to restore sites CRUD, portal token flows, jobs, payments, subscriptions, registration, webhooks, or any unnamed route. Existing webhook containment exceptions are not part of this mechanism and remain unchanged.
