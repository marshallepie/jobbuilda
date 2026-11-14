# Staff auth membership operator runbook

## Single authorized application method

**Use only the Supabase Dashboard SQL Editor.** Apply the complete raw script
`docs/provider-sql/20261107_add_auth_tenant_memberships.sql` as one query in the
approved target project. Do **not** run `pnpm db:migrate`, `node-pg-migrate`,
`psql`, a migration CLI, or mark a node-pg-migrate ledger entry. The script owns
one `BEGIN`/`COMMIT`, is secret-free, creates no mappings, and never reads email,
auth metadata, JWT claims, browser storage, headers, or request bodies.

The provider-owned migration is intentionally outside `services/identity-mcp/migrations/`
so the service runner cannot discover it. Public registration, trials, and
subscription checkout remain closed throughout.

## Required provider preflight — no write

In the **Supabase Dashboard SQL Editor**, first confirm the project reference,
environment, approved change record, operator/reviewer, and a restorable backup.
Then run this read-only catalog fingerprint. Stop on any mismatch; do not rename
or hand-edit database objects to make the script pass.

```sql
SELECT current_database() AS database_name, current_user AS database_role,
       to_regclass('public.users') AS users_table,
       to_regclass('public.tenants') AS tenants_table,
       to_regclass('public.auth_tenant_memberships') AS memberships_table;

SELECT c.relname, c.relkind, c.relrowsecurity,
       pg_total_relation_size(c.oid) AS relation_bytes
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('users', 'tenants', 'auth_tenant_memberships')
ORDER BY c.relname;

SELECT a.attrelid::regclass AS relation, a.attname,
       format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull,
       pg_get_expr(d.adbin, d.adrelid) AS default_expression
FROM pg_attribute a
LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
WHERE a.attrelid IN ('public.users'::regclass, 'public.tenants'::regclass,
                     to_regclass('public.auth_tenant_memberships'))
  AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY relation::text, a.attnum;

SELECT conrelid::regclass AS relation, conname, contype,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid IN ('public.users'::regclass,
                   to_regclass('public.auth_tenant_memberships'))
ORDER BY relation::text, conname;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'auth_tenant_memberships'
ORDER BY indexname;

SELECT policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'auth_tenant_memberships';

SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'auth_tenant_memberships'
  AND grantee IN ('PUBLIC', 'anon', 'authenticated')
ORDER BY grantee, privilege_type;
```

Expected pre-apply state is either: (a) no membership relation, or (b) the exact
canonical relation created by this script, with the documented six constraints,
the three named canonical indexes, RLS enabled, no policies, and no browser-role
grants. `public.users` and `public.tenants` must be ordinary tables with NOT NULL
UUID keys. A same-named canonical constraint or index with different keys,
uniqueness, included columns, or partial predicate is incompatible—not a compatible
pre-existing object. The script does not reject unrelated supplemental indexes;
review those separately rather than treating them as evidence that a named
canonical index is compatible.

For an existing membership table, the canonical defaults are required exactly:
`id = gen_random_uuid()`, `status = 'active'::text`, and both `created_at` and
`activated_at = now()`. A missing or different default is incompatible; `CREATE
TABLE IF NOT EXISTS` will not repair it.

**Stop conditions:** any membership rows; unexpected policy/grant; wrong relation
kind/column type/nullability; malformed same-named constraint/index; any legacy
full-history unique index or `UNIQUE(auth_user_id, user_id, tenant_id)` constraint
(regardless of name); any canonical index name attached to another relation; or an
unknown constraint or policy. The script deliberately rejects these rather than
silently converting data or relaxing security. Review/replace incompatible prior
work in a separately approved change; never backfill mappings. Unrelated
supplemental indexes are not rejected by this artifact, but must be reviewed under
the approved change record.

## Disposable rehearsal — required before production

Use an approved disposable Supabase project. Do not create staff mappings in the
fresh or repeat-run cases.

1. **Fresh schema:** run the complete script once and run the readback below.
2. **Exact repeat-run:** run the unchanged complete script again. It must commit
   without schema drift and still show zero mappings.
3. **Incompatible existing relation/object:** in a separate disposable reset,
   create a same-named malformed membership table, constraint, or active index;
   also test the legacy full-history unique constraint and a differently named
   standalone unique index on exactly `(auth_user_id, user_id, tenant_id)`. In a
   separate reset, attach one canonical index name to another table. The script
   must fail before mutation in each case. Capture the error and verify the
   incompatible object remains unchanged after rollback.
4. **Tenant mismatch:** after a fresh successful schema, attempt a mapping whose
   `user_id` belongs to another tenant. The composite foreign key must reject it.
5. **Duplicate active bindings:** insert one reviewed tuple, then separately try
   a second active row for the same `auth_user_id` and for the same `user_id`.
   Each must fail through its partial unique index.
6. **Revoke then rebind:** revoke the first tuple, then insert the identical
   immutable `(auth_user_id, user_id, tenant_id)` tuple again. It must succeed;
   the revoked historical row remains and exactly one row is active.
7. **Browser role denial:** `SET ROLE anon` and, separately, `SET ROLE authenticated`
   must not select, insert, update, or delete from the table. Restore role after
each probe.
8. **Coordinator runtime role:** using the configured coordinator runtime role,
   prove one active membership lookup succeeds and direct `INSERT`, `UPDATE`,
   `DELETE`, `TRUNCATE`, and DDL against this table are denied. The runtime is
   SELECT-only and must not mutate membership state.

Do not use a service-role credential, JWT, or password in tickets, logs, or this
file. The disposable role rehearsal is evidence about the named roles only, not
production application authorization.

## Apply — production change window only

1. Open a new SQL Editor query in the already preflighted approved production
   project and reconfirm the project reference.
2. Copy the entire current script unchanged and run it once. It is the sole
   transaction owner.
3. On failure, capture the error and stop. Do not run fragments, manually
   `COMMIT`/`ROLLBACK`, add a migration-ledger row, or switch execution methods.
4. Run the readback. Record repository commit, script path, project reference,
   query timestamp, operator, reviewer, and result in the approved change record.

## Readback — required before mapping or application release

```sql
SELECT c.relname, c.relrowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'auth_tenant_memberships';

SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.auth_tenant_memberships'::regclass
ORDER BY conname;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'auth_tenant_memberships'
ORDER BY indexname;

SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'auth_tenant_memberships'
  AND grantee IN ('PUBLIC', 'anon', 'authenticated')
ORDER BY grantee, privilege_type;

SELECT count(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'auth_tenant_memberships';

SELECT count(*) AS mapping_count FROM public.auth_tenant_memberships;
```

Required results: RLS enabled; no direct browser-role grants; composite
`(user_id, tenant_id)` foreign key; two partial one-active unique indexes; no
full-history tuple unique constraint; and `mapping_count = 0`. Any unexpected
mapping, policy, grant, constraint, or index is a stop condition. The
`policy_count` readback must be `0`.

## Authorize one existing staff principal — separate approved operation

Only after schema readback and a successful non-production coordinator rehearsal,
an approved operator may add one mapping. Obtain `auth.users.id`, existing
`public.users.id`, and that user's existing `tenant_id` from independent approved
records; never derive values from email or metadata. Confirm the intended user and
tenant match, confirm neither identity nor principal has an active binding, then
in a new SQL Editor query insert only the exact reviewed UUID tuple. Read it back
by all three UUIDs. Verify with a server-verified non-production session that the
authorized admin route works, forged tenant/user/scope headers fail, and a revoked
mapping produces coordinator `403`.

## Revoke access

```sql
UPDATE public.auth_tenant_memberships
SET status = 'revoked', revoked_at = now(), revoked_reason = :'approved_reason'
WHERE auth_user_id = :'supabase_auth_user_id'
  AND status = 'active' AND revoked_at IS NULL;
```

Read the row back. Revocation must produce coordinator `403`; do not delete
history or alter application user/tenant records. A later separately approved
rebind uses a new row with the same reviewed UUID tuple; the schema allows that
only after revocation while retaining exactly one active identity and principal.
