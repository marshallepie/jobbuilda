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
canonical relation created by this script **with zero rows**, the documented six
constraints, the three named canonical indexes, RLS enabled, the one canonical
runtime SELECT policy, and no browser-role grants. Any existing membership row is
a stop condition: the script fails before DDL and the reviewed mapping lifecycle,
not this schema script, is the only authorized path for that record. `public.users`
and `public.tenants` must be ordinary tables with NOT NULL UUID keys. A same-named

### Existing-membership lock policy and retry

When `public.auth_tenant_memberships` already exists, the script sets a
transaction-local `lock_timeout` of **5 seconds** before requesting its
`ACCESS EXCLUSIVE` lock for the populated-row guard. This prevents the SQL Editor
query from waiting indefinitely behind a concurrent reader or writer. If the lock
is not acquired within that bound, the script aborts with `Could not acquire
ACCESS EXCLUSIVE lock ... within 5 seconds`; no DDL is applied and the transaction
rolls back. This is a lock-contention stop condition, not evidence that the table
is empty or compatible.

Do not run fragments, increase/remove the timeout, terminate sessions, or bypass
the guard. Wait until the conflicting operation has completed, reconfirm the
approved project and the no-write catalog fingerprint, then retry the **complete
unchanged script** in a new SQL Editor query during the approved change window.
If it repeatedly times out, leave containment in place and escalate with the
error timestamp and approved change record; investigate the conflicting workload
under a separately approved operational action.

A same-named canonical constraint or index with different keys, uniqueness, included columns,
or partial predicate is incompatible—not a compatible pre-existing object. The
script does not reject unrelated supplemental indexes; review those separately
rather than treating them as evidence that a named canonical index is compatible.

### Coordinator `DATABASE_URL` runtime-role preflight — required, no write

Obtain the **exact PostgreSQL role name only** (never the `DATABASE_URL`, password,
or any other secret) from the approved deployment configuration that starts the
coordinator. Do not infer it from the SQL Editor's `current_user`, from this
repository, or from a provider default. In the SQL Editor, replace only
`NULL::name` below with that reviewed non-secret role name, for example
`'reviewed_runtime_role'::name`; no concrete role name is prescribed by R01a.

This is a **release preflight**, not a substitute for the schema-shape preflight:
run it against a project where the canonical membership relation already exists—after
the disposable script rehearsal and, in production, immediately after the
separate exact-role authorization below and before any mapping or coordinator
release. It requires that table in order to prove the actual table privileges.
If the table is absent, do not treat the role as approved; finish the schema
operation first.

This catalog preflight intentionally fails closed. It requires that the configured
role exists, is neither superuser nor `BYPASSRLS`, has the explicit direct
`SELECT` grant on `public.auth_tenant_memberships`, is the only non-owner role
with a `SELECT` grant, has none of `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`,
`REFERENCES`, or `TRIGGER`, and neither owns the table nor belongs (directly or
transitively) to a role that owns it or has any of those write privileges.
Ownership is checked because it permits `ALTER`/DDL independently of table ACLs.
The recursive membership check rejects every reachable membership role, including
a non-inheriting role: a role that can later be assumed is not an acceptable
SELECT-only coordinator runtime identity. The canonical RLS policy additionally
requires `current_user = session_user`; the direct exact-role grant is therefore
both the application authorization boundary and the only way the coordinator's
direct SQL lookup can pass RLS. It grants nothing to `anon`, `authenticated`, or
`PUBLIC`.

```sql
DO $$
DECLARE
  configured_role name := NULL::name; -- Replace only with the reviewed non-secret deployment role name.
  coordinator_role oid;
  membership_table oid := 'public.auth_tenant_memberships'::regclass;
  denied_privileges text[];
  unsafe_membership_roles text[];
  unexpected_select_grantees text[];
BEGIN
  IF configured_role IS NULL OR btrim(configured_role::text) = '' THEN
    RAISE EXCEPTION 'STOP: coordinator DATABASE_URL runtime role name is required from approved deployment configuration';
  END IF;

  SELECT oid INTO coordinator_role FROM pg_roles WHERE rolname = configured_role;
  IF coordinator_role IS NULL THEN
    RAISE EXCEPTION 'STOP: configured coordinator runtime role % does not exist', configured_role;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_roles
    WHERE oid = coordinator_role AND (rolsuper OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'STOP: configured coordinator runtime role % is superuser or BYPASSRLS', configured_role;
  END IF;

  IF NOT has_table_privilege(coordinator_role, membership_table, 'SELECT') THEN
    RAISE EXCEPTION 'STOP: configured coordinator runtime role % lacks required SELECT on public.auth_tenant_memberships', configured_role;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class relation
    CROSS JOIN LATERAL aclexplode(coalesce(relation.relacl, acldefault('r', relation.relowner))) acl
    WHERE relation.oid = membership_table
      AND acl.grantee = coordinator_role
      AND acl.privilege_type = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'STOP: configured coordinator runtime role % lacks the required direct SELECT grant; inherited/effective SELECT is not accepted', configured_role;
  END IF;

  SELECT array_agg(COALESCE(role.rolname, 'PUBLIC') ORDER BY COALESCE(role.rolname, 'PUBLIC'))
  INTO unexpected_select_grantees
  FROM pg_class relation
  CROSS JOIN LATERAL aclexplode(coalesce(relation.relacl, acldefault('r', relation.relowner))) acl
  LEFT JOIN pg_roles role ON role.oid = acl.grantee
  WHERE relation.oid = membership_table
    AND acl.privilege_type = 'SELECT'
    AND acl.grantee <> coordinator_role
    AND acl.grantee <> relation.relowner;
  IF unexpected_select_grantees IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: only the configured coordinator runtime role may hold non-owner SELECT on public.auth_tenant_memberships; found %', unexpected_select_grantees;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policy policy
    WHERE policy.polrelid = membership_table
      AND policy.polname = 'auth_tenant_memberships_runtime_select'
      AND policy.polcmd = 'r'
      AND policy.polpermissive
      AND policy.polroles = ARRAY[0]::oid[]
      AND pg_get_expr(policy.polqual, policy.polrelid) = '(CURRENT_USER = SESSION_USER)'
      AND policy.polwithcheck IS NULL
  ) OR (SELECT count(*) FROM pg_policy WHERE polrelid = membership_table) <> 1 THEN
    RAISE EXCEPTION 'STOP: public.auth_tenant_memberships must have exactly the canonical direct-runtime SELECT RLS policy';
  END IF;

  SELECT array_agg(privilege ORDER BY privilege) INTO denied_privileges
  FROM unnest(ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) AS privilege
  WHERE has_table_privilege(coordinator_role, membership_table, privilege);
  IF denied_privileges IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: configured coordinator runtime role % has prohibited effective table privileges: %', configured_role, denied_privileges;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class WHERE oid = membership_table AND relowner = coordinator_role) THEN
    RAISE EXCEPTION 'STOP: configured coordinator runtime role % owns public.auth_tenant_memberships and can ALTER/DDL it', configured_role;
  END IF;

  WITH RECURSIVE reachable_roles(role_oid, role_path) AS (
    SELECT coordinator_role, ARRAY[coordinator_role]
    UNION ALL
    SELECT membership.roleid, reachable_roles.role_path || membership.roleid
    FROM reachable_roles
    JOIN pg_auth_members AS membership ON membership.member = reachable_roles.role_oid
    WHERE NOT membership.roleid = ANY (reachable_roles.role_path)
  )
  SELECT array_agg(DISTINCT role.rolname ORDER BY role.rolname) INTO unsafe_membership_roles
  FROM reachable_roles
  JOIN pg_roles AS role ON role.oid = reachable_roles.role_oid
  JOIN pg_class AS relation ON relation.oid = membership_table
  WHERE reachable_roles.role_oid <> coordinator_role
    AND (
      relation.relowner = reachable_roles.role_oid
      OR role.rolsuper
      OR role.rolbypassrls
      OR has_table_privilege(reachable_roles.role_oid, membership_table, 'INSERT')
      OR has_table_privilege(reachable_roles.role_oid, membership_table, 'UPDATE')
      OR has_table_privilege(reachable_roles.role_oid, membership_table, 'DELETE')
      OR has_table_privilege(reachable_roles.role_oid, membership_table, 'TRUNCATE')
      OR has_table_privilege(reachable_roles.role_oid, membership_table, 'REFERENCES')
      OR has_table_privilege(reachable_roles.role_oid, membership_table, 'TRIGGER')
    );
  IF unsafe_membership_roles IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: configured coordinator runtime role % reaches unsafe member/inherit roles: %', configured_role, unsafe_membership_roles;
  END IF;

  RAISE NOTICE 'PASS: coordinator runtime role % is SELECT-only and cannot own or ALTER/DDL public.auth_tenant_memberships', configured_role;
END $$;
```

### Authorize the verified coordinator runtime lookup — separate approved operation

After the provider script has committed and before the preceding release
preflight, use a **new SQL Editor query** under the approved change record. This
is deliberately not part of the provider migration transaction and must not be
added to any migration ledger. Replace only `NULL::name` with the exact reviewed
non-secret deployment role name from the coordinator's `DATABASE_URL`. The block
does not reveal, infer, or prescribe that role. It refuses a superuser,
`BYPASSRLS`, table owner, unexpected existing non-owner `SELECT` grantee, missing
canonical policy, any write privilege, or unsafe reachable membership before
issuing the one direct `SELECT` grant. Do not substitute a group role or use `PUBLIC`, `anon`, or
`authenticated`.

```sql
DO $$
DECLARE
  configured_role name := NULL::name; -- Replace only with the reviewed non-secret deployment role name.
  coordinator_role oid;
  membership_table oid := 'public.auth_tenant_memberships'::regclass;
  unexpected_select_grantees text[];
  denied_privileges text[];
  unsafe_membership_roles text[];
BEGIN
  IF configured_role IS NULL OR btrim(configured_role::text) = '' THEN
    RAISE EXCEPTION 'STOP: coordinator DATABASE_URL runtime role name is required from approved deployment configuration';
  END IF;
  SELECT oid INTO coordinator_role FROM pg_roles WHERE rolname = configured_role;
  IF coordinator_role IS NULL THEN
    RAISE EXCEPTION 'STOP: configured coordinator runtime role % does not exist', configured_role;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE oid = coordinator_role AND (rolsuper OR rolbypassrls))
     OR EXISTS (SELECT 1 FROM pg_class WHERE oid = membership_table AND relowner = coordinator_role) THEN
    RAISE EXCEPTION 'STOP: configured coordinator runtime role % is superuser, BYPASSRLS, or table owner', configured_role;
  END IF;
  SELECT array_agg(privilege ORDER BY privilege) INTO denied_privileges
  FROM unnest(ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) AS privilege
  WHERE has_table_privilege(coordinator_role, membership_table, privilege);
  IF denied_privileges IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: configured coordinator runtime role % already has prohibited effective table privileges: %', configured_role, denied_privileges;
  END IF;
  WITH RECURSIVE reachable_roles(role_oid, role_path) AS (
    SELECT coordinator_role, ARRAY[coordinator_role]
    UNION ALL
    SELECT membership.roleid, reachable_roles.role_path || membership.roleid
    FROM reachable_roles
    JOIN pg_auth_members AS membership ON membership.member = reachable_roles.role_oid
    WHERE NOT membership.roleid = ANY (reachable_roles.role_path)
  )
  SELECT array_agg(DISTINCT role.rolname ORDER BY role.rolname) INTO unsafe_membership_roles
  FROM reachable_roles
  JOIN pg_roles AS role ON role.oid = reachable_roles.role_oid
  JOIN pg_class AS relation ON relation.oid = membership_table
  WHERE reachable_roles.role_oid <> coordinator_role
    AND (
      relation.relowner = reachable_roles.role_oid
      OR role.rolsuper
      OR role.rolbypassrls
      OR has_table_privilege(reachable_roles.role_oid, membership_table, 'INSERT')
      OR has_table_privilege(reachable_roles.role_oid, membership_table, 'UPDATE')
      OR has_table_privilege(reachable_roles.role_oid, membership_table, 'DELETE')
      OR has_table_privilege(reachable_roles.role_oid, membership_table, 'TRUNCATE')
      OR has_table_privilege(reachable_roles.role_oid, membership_table, 'REFERENCES')
      OR has_table_privilege(reachable_roles.role_oid, membership_table, 'TRIGGER')
    );
  IF unsafe_membership_roles IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: configured coordinator runtime role % reaches unsafe member/inherit roles: %', configured_role, unsafe_membership_roles;
  END IF;
  SELECT array_agg(COALESCE(role.rolname, 'PUBLIC') ORDER BY COALESCE(role.rolname, 'PUBLIC'))
  INTO unexpected_select_grantees
  FROM pg_class relation
  CROSS JOIN LATERAL aclexplode(coalesce(relation.relacl, acldefault('r', relation.relowner))) acl
  LEFT JOIN pg_roles role ON role.oid = acl.grantee
  WHERE relation.oid = membership_table
    AND acl.privilege_type = 'SELECT'
    AND acl.grantee <> relation.relowner
    AND acl.grantee <> coordinator_role;
  IF unexpected_select_grantees IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: unexpected non-owner SELECT grantees exist on public.auth_tenant_memberships: %', unexpected_select_grantees;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy policy
    WHERE policy.polrelid = membership_table
      AND policy.polname = 'auth_tenant_memberships_runtime_select'
      AND policy.polcmd = 'r'
      AND policy.polpermissive
      AND policy.polroles = ARRAY[0]::oid[]
      AND pg_get_expr(policy.polqual, policy.polrelid) = '(CURRENT_USER = SESSION_USER)'
      AND policy.polwithcheck IS NULL
  ) OR (SELECT count(*) FROM pg_policy WHERE polrelid = membership_table) <> 1 THEN
    RAISE EXCEPTION 'STOP: public.auth_tenant_memberships must have exactly the canonical direct-runtime SELECT RLS policy';
  END IF;
  EXECUTE format('GRANT SELECT ON TABLE public.auth_tenant_memberships TO %I', configured_role);
END $$;
```

**Stop conditions:** an unknown or omitted configured role; any exception from this
block; absent `SELECT`; any effective prohibited privilege; superuser or
`BYPASSRLS`; direct ownership; or any reachable member/inherit role that is
superuser, `BYPASSRLS`, owns the table, or has a prohibited table privilege. Keep
containment in place. This R01a runbook permits only the preceding separately
approved direct `SELECT` grant to the reviewed deployment role; it never grants
browser access or changes role ownership, membership, login, superuser, or
`BYPASSRLS` attributes. Correct any other failing deployment role condition only
under a separately approved change.

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

**Approved disposable target — bind every rehearsal step to this exact branch:**
`afygozgefepayoenwccl` (`jobbuilda-membership-rehearsal-20261114`), whose parent
project reference is `jnwxueomquywrqcgbgfd`. This branch is the only approved
non-production target for every setup query, script run, negative probe,
readback, reset, and role test in steps 1–8. Do not create staff mappings in the
fresh or repeat-run cases.

Before **every query that can write**, visually confirm in the Supabase Dashboard
project/branch selector and SQL Editor header that the selected project reference
is exactly `afygozgefepayoenwccl` and the branch name is exactly
`jobbuilda-membership-rehearsal-20261114`; also confirm the Dashboard shows parent
project reference `jnwxueomquywrqcgbgfd`. The parent is only branch lineage, not a
write target: the selected project reference must never be
`jnwxueomquywrqcgbgfd`. Stop immediately and execute no query if any displayed
branch/project reference differs, if the approved branch name or parent differs,
or if the production parent project is selected. Re-select and visually confirm
the approved disposable branch before continuing.

Use only the Supabase Dashboard SQL Editor for this rehearsal; do not substitute a
CLI, `psql`, migration runner, or another execution method.

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
   must not select, insert, update, or delete from the table. Also prove a
   non-granted non-owner role cannot select. Restore role after each probe.
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

First rerun the exact **Coordinator `DATABASE_URL` runtime-role preflight** block
above in the same approved production SQL Editor project, with the same reviewed
non-secret deployment role name. It is the required role readback: record its
`PASS` notice with the schema readback below. Any failure or a changed/unknown
role is a stop condition; keep containment in place and do not use this R01a
script or the SQL Editor to change grants, ownership, memberships, or roles.

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
`policy_count` readback must be `1`, for the canonical
`auth_tenant_memberships_runtime_select` SELECT policy only; it does not grant
table privileges to browser roles.

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

In a new **Supabase Dashboard SQL Editor** query, replace both `NULL` values
below with the exact independently reviewed values, keeping the explicit casts.
Use a single-quoted UUID literal for `auth_user_id` and a single-quoted,
non-empty reason literal for `revoked_reason`; escape any apostrophe in the
reason by doubling it. Do not run the statement until both replacements have
been reviewed. The `NULL` defaults intentionally update no rows if either value
is left unreplaced.

```sql
WITH reviewed_input AS (
  SELECT
    NULL::uuid AS auth_user_id,
    NULL::text AS revoked_reason
),
validated_input AS (
  SELECT auth_user_id, revoked_reason
  FROM reviewed_input
  WHERE auth_user_id IS NOT NULL
    AND revoked_reason IS NOT NULL
    AND btrim(revoked_reason) <> ''
),
matched_active_memberships AS MATERIALIZED (
  SELECT membership.id
  FROM public.auth_tenant_memberships AS membership
  CROSS JOIN validated_input AS input
  WHERE membership.auth_user_id = input.auth_user_id
    AND membership.status = 'active'
    AND membership.revoked_at IS NULL
),
single_active_membership AS (
  SELECT id
  FROM matched_active_memberships
  WHERE (SELECT count(*) FROM matched_active_memberships) = 1
)
UPDATE public.auth_tenant_memberships AS membership
SET status = 'revoked',
    revoked_at = now(),
    revoked_reason = input.revoked_reason
FROM validated_input AS input
CROSS JOIN single_active_membership AS candidate
WHERE membership.id = candidate.id
  AND membership.auth_user_id = input.auth_user_id
  AND membership.status = 'active'
  AND membership.revoked_at IS NULL
RETURNING membership.auth_user_id, membership.user_id, membership.tenant_id,
          membership.status, membership.revoked_at, membership.revoked_reason;
```

This is Dashboard SQL Editor SQL, not `psql`: do not use `:name`, `:'name'`,
or any client-side substitution syntax. It must return **exactly one** reviewed
row. Zero rows or more than one row is a stop condition: do not retry with
different values, delete history, or alter application user/tenant records;
record the result and escalate under the approved change record. Confirm the
returned UUIDs match the approval, then use the returned row as the readback.
Revocation must produce coordinator `403`. A later separately approved rebind
uses a new row with the same reviewed UUID tuple; the schema allows that only
after revocation while retaining exactly one active identity and principal.
