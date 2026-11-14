# Staff auth membership operator runbook

## Single authorized application method

**Use only the Supabase Dashboard SQL Editor.** Apply the complete raw script
`docs/provider-sql/20261107_add_auth_tenant_memberships.sql` as one query in the
approved target project. Do **not** run `pnpm db:migrate`, `node-pg-migrate`,
`psql`, a migration CLI, or mark any node-pg-migrate ledger entry for this change.

This method is evidence-backed by the prior identity migration's SQL-Editor
instruction and the observed provider-owned `remote_schema` history; no
production node-pg-migrate ledger has been verified. The script deliberately lives
outside `services/identity-mcp/migrations/` so the service runner cannot discover
or replay it. It contains its own `BEGIN`/`COMMIT` and creates no mappings.

Public registration, trials, and subscription checkout remain closed throughout.

## Required provider preflight — no write

Perform these steps first in the **Supabase Dashboard SQL Editor**. Stop if any
result differs; do not edit the script to make a mismatch pass.

1. Confirm the Dashboard project reference, environment, and change window against
   the approved production change record. Record the project reference and the
   operator/reviewer; do not rely on a browser URL from another environment.
2. Confirm a restorable backup exists and record its timestamp/restore reference.
3. Paste and run this read-only preflight in a new SQL Editor query:

```sql
SELECT current_database() AS database_name,
       current_user AS database_role,
       to_regclass('public.users') AS users_table,
       to_regclass('public.tenants') AS tenants_table,
       to_regclass('public.auth_tenant_memberships') AS memberships_table;

SELECT c.relname, c.relrowsecurity AS rls_enabled,
       pg_total_relation_size(c.oid) AS relation_bytes
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('users', 'tenants', 'auth_tenant_memberships')
ORDER BY c.relname;

SELECT policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'auth_tenant_memberships';

SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid IN ('public.users'::regclass,
                   to_regclass('public.auth_tenant_memberships'))
ORDER BY conrelid::regclass::text, conname;
```

4. The expected pre-apply state is: `public.users` and `public.tenants` exist;
   `auth_tenant_memberships` is absent or is a reviewed compatible relation with
   no unexpected RLS policies. If the table exists and contains rows, stop unless a
   database reviewer has approved every existing UUID tuple and its active/revoked
   lifecycle. The migration intentionally refuses non-canonical populated rows;
   it must never infer a mapping from email, auth metadata, JWT claims, browser
   storage, headers, or request bodies.
5. In an approved disposable Supabase project, repeat steps 1–4, copy the complete
   provider script unchanged, run it once, and execute the readback below. Repeat
   the same script once more to prove the compatible empty-schema rerun path. Do
   not create staff mappings during this schema rehearsal.

## Apply — production change window only

1. Open a **new** SQL Editor query in the already-preflighted approved production
   project. Reconfirm the project reference before pasting.
2. Copy the entire current contents of
   `docs/provider-sql/20261107_add_auth_tenant_memberships.sql` without adding,
   removing, or separately executing statements. Run it once. It is the sole
   transaction owner.
3. If it fails, capture the error and stop. Do not rerun fragments, issue manual
   `COMMIT`/`ROLLBACK`, add a node-pg-migrate ledger row, or switch methods. Assess
   the provider transaction outcome and backup/restore decision with the database
   reviewer.
4. Run the readback immediately. Record the exact repository commit, script path,
   Dashboard project reference, query timestamp, operator, reviewer, and results
   in the approved change record.

## Readback — required before mapping or application release

```sql
SELECT c.relname, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'auth_tenant_memberships';

SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'auth_tenant_memberships'
  AND grantee IN ('PUBLIC', 'anon', 'authenticated')
ORDER BY grantee, privilege_type;

SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.auth_tenant_memberships'::regclass
ORDER BY conname;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'auth_tenant_memberships'
ORDER BY indexname;

SELECT count(*) AS mapping_count
FROM public.auth_tenant_memberships;
```

Required results: RLS is enabled; no direct `PUBLIC`, `anon`, or `authenticated`
table grants appear; the composite `(user_id, tenant_id)` foreign key and both
partial one-active indexes appear; and `mapping_count` is `0`. Any unexpected
mapping, policy, grant, constraint, or index is a stop condition.

## Authorize one existing staff principal — separate approved operation

Only after the schema readback and a successful non-production coordinator
rehearsal may an approved operator add one mapping. Obtain all UUIDs from
independent approved records; do not derive any value from email or metadata.

1. Obtain the three UUIDs from Supabase `auth.users.id`, existing
   `public.users.id`, and that row's existing `public.users.tenant_id`.
2. Confirm the application principal is the intended staff administrator:

```sql
SELECT id, tenant_id, role
FROM public.users
WHERE id = :'application_user_id'
  AND tenant_id = :'tenant_id'
  AND role = 'admin';
```

3. Confirm neither identity nor application user has an active binding:

```sql
SELECT auth_user_id, user_id, tenant_id, status, revoked_at
FROM public.auth_tenant_memberships
WHERE (auth_user_id = :'supabase_auth_user_id' OR user_id = :'application_user_id')
  AND status = 'active' AND revoked_at IS NULL;
```

4. In a new SQL Editor query, insert only the exact reviewed UUID tuple:

```sql
BEGIN;
INSERT INTO public.auth_tenant_memberships (auth_user_id, user_id, tenant_id)
VALUES (:'supabase_auth_user_id', :'application_user_id', :'tenant_id');
COMMIT;
```

5. Read back by all three UUIDs, then use a real server-verified session in the
   approved non-production rehearsal: the authorized admin route succeeds, forged
   tenant/user/scope headers fail, and a revoked mapping returns coordinator `403`.
   Do not paste service-role credentials or JWTs into tickets, logs, or this file.

## Revoke access

```sql
UPDATE public.auth_tenant_memberships
SET status = 'revoked', revoked_at = now(), revoked_reason = :'approved_reason'
WHERE auth_user_id = :'supabase_auth_user_id'
  AND status = 'active' AND revoked_at IS NULL;
```

Read the row back. A revoked binding must produce a coordinator `403`; do not
delete history or alter the application user or tenant records.
