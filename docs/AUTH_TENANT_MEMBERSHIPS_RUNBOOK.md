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

## Public registration closure verification gate — read-only

Before claiming public registration is fully closed, perform a read-only
provider/Auth configuration verification against the exact reviewed project and
record whether direct Auth API registration is disabled or otherwise closed. This
gate does not change provider configuration, registration behavior, or any
identity. Application containment of signup pages and server routes is separate
evidence: it does not prove that the provider's direct Auth API registration is
closed. If this provider/Auth configuration result is absent, unknown, or shows
direct Auth API registration open, report application containment only; do not
claim public registration is fully closed.

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

-- The lifecycle function is safe to replace only when absent or owned by the
-- current executing provider role and referenced by exactly these two canonical
-- triggers on this relation. Any other result is a stop condition; do not apply
-- the script or repair the ownership or dependency by hand.
WITH lifecycle_guard AS (
  SELECT to_regprocedure('public.auth_tenant_memberships_lifecycle_guard()') AS oid
)
SELECT lifecycle_guard.oid::regprocedure AS function_identity,
       owner.rolname AS function_owner,
       current_user AS executing_provider_role,
       trigger.tgrelid::regclass AS trigger_relation,
       trigger.tgname,
       trigger.tgenabled,
       trigger.tgisinternal,
       pg_get_triggerdef(trigger.oid) AS trigger_definition
FROM lifecycle_guard
LEFT JOIN pg_proc lifecycle_function ON lifecycle_function.oid = lifecycle_guard.oid
LEFT JOIN pg_roles owner ON owner.oid = lifecycle_function.proowner
LEFT JOIN pg_trigger AS trigger ON trigger.tgfoid = lifecycle_guard.oid
ORDER BY trigger_relation::text NULLS FIRST, trigger.tgname NULLS FIRST;

SELECT COALESCE(role.rolname, 'PUBLIC') AS grantee, acl.privilege_type
FROM pg_class relation
CROSS JOIN LATERAL aclexplode(coalesce(relation.relacl, acldefault('r', relation.relowner))) acl
LEFT JOIN pg_roles role ON role.oid = acl.grantee
WHERE relation.oid = to_regclass('public.auth_tenant_memberships')
  AND acl.grantee <> relation.relowner
ORDER BY grantee, acl.privilege_type;

SELECT a.attname AS column_name,
       COALESCE(role.rolname, 'PUBLIC') AS grantee,
       acl.privilege_type
FROM pg_class relation
JOIN pg_attribute a ON a.attrelid = relation.oid
CROSS JOIN LATERAL aclexplode(coalesce(a.attacl, acldefault('c', relation.relowner))) acl
LEFT JOIN pg_roles role ON role.oid = acl.grantee
WHERE relation.oid = to_regclass('public.auth_tenant_memberships')
  AND a.attnum > 0
  AND NOT a.attisdropped
  AND acl.grantee <> relation.relowner
ORDER BY column_name, grantee, acl.privilege_type;
```

Expected pre-apply state is either: (a) no membership relation, or (b) the exact
canonical relation created by this script **with zero rows**, the documented five
constraints, the three named canonical indexes, RLS enabled, the one canonical
runtime SELECT policy, and no non-owner column ACLs. A zero-row legacy relation
may retain direct **relation** ACLs for `service_role` only; this script revokes
those ACLs from this table only after `CREATE TABLE IF NOT EXISTS`. Every other
non-owner relation ACL and every non-owner column ACL is a stop condition. This
narrow remediation does not change default privileges, roles, or any other table.
The script does not identify or grant the coordinator runtime role; the separately
approved exact-role `SELECT` grant later in this runbook remains a separate
operation after the migration has committed. Any existing membership row is a stop
condition: the script fails before DDL and the reviewed mapping lifecycle, not
this schema script, is the only authorized path for that record. `public.users`
and `public.tenants` must be ordinary tables with NOT NULL UUID keys. A same-named
lifecycle function is subject to the owner and trigger-reference check below.

For an existing `public.auth_tenant_memberships_lifecycle_guard()`,
`function_owner` must exactly equal `executing_provider_role` (the SQL Editor's
`current_user`), and its only trigger references must be the two canonical
membership triggers shown above. A missing function is acceptable. A different,
unknown, or absent owner, or any other trigger reference, is a stop condition;
do not apply the script or repair the ownership/dependency by hand.

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
or partial predicate is incompatible—not a compatible pre-existing object. Before
any DDL, the script fails closed for every unique index or constraint except the
exact canonical `id` primary key and the two direct, one-key active-only unique
shapes on `auth_user_id` and `user_id`. The allowed identity shapes have no
expression keys or `INCLUDE` columns and use the exact canonical predicate
`status = 'active' AND revoked_at IS NULL`; this rejects expression-key indexes
(`indkey` attribute `0`) and semantically all-row predicates such as `WHERE TRUE`
without attempting to prove arbitrary predicate logic. The script does not reject
unrelated supplemental **non-unique** indexes; review those separately rather
than treating them as evidence that a named canonical index is compatible.

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
role exists, has `LOGIN`, is neither superuser nor `BYPASSRLS`, has the explicit direct
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
    WHERE oid = coordinator_role AND (NOT rolcanlogin OR rolsuper OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'STOP: configured coordinator runtime role % must have LOGIN and must not be superuser or BYPASSRLS', configured_role;
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
  IF EXISTS (SELECT 1 FROM pg_roles WHERE oid = coordinator_role AND (NOT rolcanlogin OR rolsuper OR rolbypassrls))
     OR EXISTS (SELECT 1 FROM pg_class WHERE oid = membership_table AND relowner = coordinator_role) THEN
    RAISE EXCEPTION 'STOP: configured coordinator runtime role % must have LOGIN and must not be superuser, BYPASSRLS, or table owner', configured_role;
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

**Stop conditions:** any membership rows; unexpected policy; any non-owner
relation ACL other than the legacy `service_role` relation ACLs; or any non-owner
column ACL; wrong relation kind/column type/nullability; malformed same-named
constraint/index; any unique
index or constraint other than the exact canonical `id` primary key or direct,
active-only `auth_user_id`/`user_id` unique shapes (including expression keys,
`INCLUDE` columns, and `WHERE TRUE`); any canonical index name attached to another
relation; or an unknown constraint or policy. The script deliberately rejects
these rather than silently converting data or relaxing security. Review/replace
incompatible prior work in a separately approved change; never backfill mappings.
Unrelated supplemental non-unique indexes are not rejected by this artifact, but
must be reviewed under the approved change record.

## Disposable rehearsal — required before production

**The former `afygozgefepayoenwccl` (`jobbuilda-membership-rehearsal-20261114`)
branch is retired and forbidden.** It is not an approved target. Do not address,
reset, reuse, or inspect it for this rehearsal. Never substitute the production
parent `jnwxueomquywrqcgbgfd` or any other project if a disposable target cannot
be approved and addressed.

Before any rehearsal query, obtain a **fresh approved, addressable disposable
branch decision** with the required provider cost approval. Perform fresh provider
discovery and preserve evidence that the selected branch has: a distinct,
correctly formatted project reference; parent project reference exactly
`jnwxueomquywrqcgbgfd`; status `ACTIVE_HEALTHY`; and `with_data=false`. In the
Dashboard selector and SQL Editor header, visually verify the same selected branch
reference and parent immediately before every query that can write. The selected
target must not equal the parent ref. Stop and execute no query if any discovery
or header value differs, the branch is not addressable/healthy, the cost approval
is absent, or the production parent is selected.

Before any rehearsal query, use the selected branch's Dashboard SQL Editor to
prove a clean no-membership baseline: `public.auth_tenant_memberships` is absent,
or is the exact canonical zero-row relation permitted by the preflight. Any
existing membership row or incompatible state is a stop condition. Do not reset,
reuse, repair, or fall back to another branch, the parent, or production; obtain a
new approved disposable branch decision instead. Do not create staff mappings in
the fresh or repeat-run cases.

Use only the Supabase Dashboard SQL Editor for schema application and steps 1–7;
do not substitute a CLI, `psql`, migration runner, or another execution method for
the provider script. SQL Editor evidence is deliberately limited to schema,
catalog, lifecycle, and RLS-negative rehearsal. Its `SET ROLE` probes necessarily
make `current_user <> session_user`, so they cannot prove the canonical policy's
positive direct-login path or the coordinator's real runtime lookup.

### Auth Admin synthetic-identity preflight — read-only and mandatory

Before any isolated branch rehearsal that creates, lists, or deletes a synthetic
Auth identity, record a read-only preflight for all of the following on the exact
selected branch project ref:

1. the exact branch project ref, matching the Dashboard selector and SQL Editor
   header, and distinct from the production parent;
2. supported Auth Admin create, list, and delete capability for that branch;
3. a branch-scoped **nonsecret credential-availability indicator** for the
   supported Auth Admin path; do not record or expose any credential; and
4. a supported cleanup path that can delete the synthetic Auth identity and has a
   documented readback/not-found completion result.

This preflight is read-only. If any item is absent, unsupported, unknown, or does
not bind to the exact branch project ref, **stop the lifecycle phase**: do not
create a synthetic Auth identity, do not begin fixture creation, and do not
substitute a SQL-only rehearsal. **Never insert, update, or delete `auth.users`
through SQL**; SQL writes to `auth.users` are prohibited even when Auth Admin
capability or cleanup evidence is unavailable.

### Synthetic fixture lifecycle and reset isolation

Only after the Auth Admin synthetic-identity preflight passes, the approved
operator must establish a disposable-only fixture register outside this migration:
three newly generated UUIDs for one Admin-created synthetic Auth identity, one
existing disposable `public.users` principal, and that principal's existing
disposable tenant. Verify the base `users` and `tenants` records exist and that
the selected `public.users.tenant_id` equals the fixture tenant before inserting a
membership. Do not use a staff, production, or previous-rehearsal identity; do not
derive any fixture identifier from email or metadata. Record a redacted fixture
label and UUID tuple only where the approved change record permits it.

Run each malformed-object case only on its own newly approved, addressable
disposable branch with a new fixture register and the required clean baseline.
Never reuse a branch that contains a malformed table, constraint, index,
canonical-index-name collision, failed fixture insert, or prior lifecycle row as
the fresh/repeat-run case. After each expected failure, read back the named
malformed object and confirm that it remains unchanged after the provider-script
rollback; do not reset the branch. Do not repair, drop, rename, or hand-edit
malformed objects in place.

For the successful lifecycle sequence, use exactly one synthetic tuple: create
one active mapping, prove both duplicate-active failures, revoke that same row,
and rebind the identical immutable tuple once. Immediately before the direct
positive probe, read back by all three UUIDs and require exactly two historical
rows, exactly one active/unrevoked row, and no other active row for the fixture
`auth_user_id` or `user_id`. The direct probe uses that active row only.

After the positive probe, revoke the active synthetic row with the approved
Dashboard SQL Editor revocation procedure, then read back by all three UUIDs and
require zero active/unrevoked rows and two retained revoked rows. Read back the
fixture `auth_user_id` and `user_id` separately to confirm neither has an active
binding. Only after that membership revocation readback, delete the sole
Admin-created synthetic Auth identity through the supported Auth Admin cleanup
path. Perform the provider-documented Auth Admin readback for that exact identity
and require its documented not-found result; a successful delete response alone
is insufficient. Any deletion failure, missing or non-not-found provider
readback, or ambiguous result is a stop condition. Preserve the two revoked
membership-history rows: do not delete history, truncate the membership table, or
use a production or parent project to clean up. The fixture register, membership
readbacks, Auth deletion and documented not-found readback, expected errors, and
reset identifiers are mandatory rehearsal evidence.

1. **Fresh schema:** run the complete script once and run the readback below.
2. **Exact repeat-run:** run the unchanged complete script again. It must commit
   without schema drift and still show zero mappings.
3. **Incompatible existing relation/object:** in a separate disposable reset,
   create a same-named malformed membership table, constraint, or active index;
   also test a legacy full-history unique constraint, a differently named
   standalone unique index on exactly `(auth_user_id, user_id, tenant_id)`, and
   differently named non-partial multi-column unique indexes containing each of
   `auth_user_id` and `user_id`. In a separate reset, attach one canonical index
   name to another table. The script
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
8. **Coordinator runtime role — structural/negative evidence only:** run the
   catalog preflight and, if separately approved, `SET ROLE` negative probes for
   denied DML. Do **not** call a SQL Editor `SET ROLE` result a coordinator login
   or positive lookup: `current_user = session_user` is intentionally false in
   that session. The mandatory positive probe is the direct-login procedure below.

Do not use a service-role credential, JWT, or password in tickets, logs, or this
file. The disposable role rehearsal is evidence about the named roles only, not
production application authorization.

### Mandatory direct coordinator-role positive probe — disposable target only

This is the **only** positive evidence for the coordinator runtime lookup. It is
an isolated direct database connection as the actual configured coordinator role,
not SQL Editor and never `SET ROLE`. It is mandatory after an active synthetic
membership tuple has been approved and created on the disposable branch, before
production application release or mapping.

Use an approved restricted probe environment only after the fresh branch decision
above supplies these **non-secret** values: the discovered
`MEMBERSHIP_REHEARSAL_TARGET_REF`, immutable
`MEMBERSHIP_REHEARSAL_PARENT_REF=jnwxueomquywrqcgbgfd`, the exact reviewed
`MEMBERSHIP_REHEARSAL_RUNTIME_ROLE`, and the reviewed direct connection tuple
`MEMBERSHIP_REHEARSAL_DB_HOST`, `MEMBERSHIP_REHEARSAL_DB_PORT`, and
`MEMBERSHIP_REHEARSAL_DB_NAME`. It may supply the direct runtime connection
credential only in `MEMBERSHIP_REHEARSAL_DATABASE_URL`; never print, export to a
transcript, pass it as a command-line argument, or include it in an error report.
The approved synthetic UUID tuple is supplied separately as
`MEMBERSHIP_REHEARSAL_AUTH_USER_ID`, `MEMBERSHIP_REHEARSAL_USER_ID`, and
`MEMBERSHIP_REHEARSAL_TENANT_ID`. UUIDs and role/target tuple are non-secret but
should be redacted from the change record unless that record explicitly approves
their retention.

**Two independent gates are mandatory.** **(A) Provider discovery and approval**
plus Dashboard verification establish the selected branch's parent, status,
`with_data`, and addressability. **(B) The Node probe** validates only the
supplied target-ref format, immutable parent ref, target/parent inequality and
retired-target denial, direct host/port/database, runtime role, and URL tuple.
It does not query the provider control plane or Dashboard and cannot prove provider
approval, branch parent, status, `with_data`, or addressability. If the required
provider evidence is absent, do not run the Node probe.

Before connecting, the restricted probe must reject unless the target ref is a
distinct correctly formatted Supabase project ref, the parent ref exactly equals
`jnwxueomquywrqcgbgfd`, and target differs from parent. It must reject unless
every host/port/database/role value equals the reviewed tuple for the freshly
approved branch and the role equals the reviewed coordinator role. The checked
direct endpoint is exactly `db.<target-ref>.supabase.co:5432/postgres`; a supplied
host, port, or database value that differs is rejected before a socket is opened.
It must reject a missing value, the retired target, a production parent/ref, any
proxy/pooler/foreign host, or any fallback connection string. There is **no
provider fallback and no production fallback**: a target-binding or connection
failure is a stop condition, not permission to retry elsewhere.

Run the committed Node-only probe from the repository root with **Node.js 20.11 or
newer**; do not use `dotenv`,
a shell `.env` loader, a CLI URL flag, or any credential file. It reads only the
named `MEMBERSHIP_REHEARSAL_*` environment values, rejects an inherited
`DATABASE_URL`, validates the URL username/host/port/database/SSL mode against
the reviewed tuple before creating a `pg` client, connects once with no role
switch, and has no alternate URL or host path. Direct execution of the documented
command invokes the probe; importing the module does not invoke it. Its finite
timeout policy is
exactly **5,000 ms** for the `pg` `connectionTimeoutMillis`, `query_timeout`,
and server `statement_timeout` options. A connection or statement that exceeds
that bound fails the probe nonzero with the fixed redacted failure message; it
does not print the driver/server error and must not be retried against another
target:

```sh
node services/identity-mcp/scripts/probe-membership-rehearsal-runtime.mjs
```

Connect once with the approved direct runtime credential and no role switch. The
probe must issue a parameterized/read-only lookup equivalent to this query. Bind
`$4` to the exact reviewed non-secret `MEMBERSHIP_REHEARSAL_RUNTIME_ROLE`; the
returned boolean is a **server-side exact configured-role identity comparison**,
not a client-side comparison or a role label inferred from the connection:

```sql
SELECT
  current_user = session_user AS direct_login_identity,
  current_user = $4::name AS configured_runtime_role_identity,
  count(*) AS active_membership_count
FROM public.auth_tenant_memberships
WHERE auth_user_id = $1::uuid
  AND user_id = $2::uuid
  AND tenant_id = $3::uuid
  AND status = 'active'
  AND revoked_at IS NULL;
```

Accept only `direct_login_identity = true`,
`configured_runtime_role_identity = true`, and `active_membership_count = 1`.
Record only pass/fail, approved disposable target ref, timestamp, and a redacted
tuple/role label; do not record the URL, password, full connection string, raw
query parameters, or server error text. The direct probe must not mutate data,
create a mapping, use a service-role credential, or test against production.
After this positive lookup, use the SQL Editor structural preflight and the table
ACL catalog to establish SELECT-only privilege; do not attempt to manufacture a
positive direct-login result with `SET ROLE`.

## Apply — production change window only

1. Open a new SQL Editor query in the already preflighted approved production
   project and reconfirm the project reference.
2. Copy the entire current script unchanged and run it once. It is the sole
   transaction owner.
3. On failure, capture the error and stop. Do not run fragments, manually
   `COMMIT`/`ROLLBACK`, add a migration-ledger row, or switch execution methods.
4. Run the readback. Record repository commit, script path, project reference,
   query timestamp, operator, reviewer, and result in the approved change record.

## Post-apply schema readback — required before coordinator grant, mapping, or application release

Before the separate coordinator authorization, run this schema readback in the
same approved production SQL Editor project. Record its results with the script
readback. Do **not** rerun the Coordinator `DATABASE_URL` runtime-role preflight
at this stage: that preflight requires the separately approved direct coordinator
`SELECT` grant, while this readback proves the script left no non-owner relation
or column ACLs. Any unexpected result is a stop condition; keep containment in
place and do not use this R01a script or the SQL Editor to change grants,
ownership, memberships, or roles.

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

SELECT trigger.tgname, trigger.tgenabled, pg_get_triggerdef(trigger.oid) AS definition
FROM pg_trigger AS trigger
WHERE trigger.tgrelid = 'public.auth_tenant_memberships'::regclass
  AND NOT trigger.tgisinternal
ORDER BY trigger.tgname;

SELECT COALESCE(role.rolname, 'PUBLIC') AS grantee, acl.privilege_type
FROM pg_class relation
CROSS JOIN LATERAL aclexplode(coalesce(relation.relacl, acldefault('r', relation.relowner))) acl
LEFT JOIN pg_roles role ON role.oid = acl.grantee
WHERE relation.oid = 'public.auth_tenant_memberships'::regclass
  AND acl.grantee <> relation.relowner
ORDER BY grantee, acl.privilege_type;

SELECT a.attname AS column_name,
       COALESCE(role.rolname, 'PUBLIC') AS grantee,
       acl.privilege_type
FROM pg_class relation
JOIN pg_attribute a ON a.attrelid = relation.oid
CROSS JOIN LATERAL aclexplode(coalesce(a.attacl, acldefault('c', relation.relowner))) acl
LEFT JOIN pg_roles role ON role.oid = acl.grantee
WHERE relation.oid = 'public.auth_tenant_memberships'::regclass
  AND a.attnum > 0
  AND NOT a.attisdropped
  AND acl.grantee <> relation.relowner
ORDER BY column_name, grantee, acl.privilege_type;

SELECT count(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'auth_tenant_memberships';

SELECT count(*) AS mapping_count FROM public.auth_tenant_memberships;
```

Required results: RLS enabled; both the relation-ACL and column-ACL inventories
return **zero rows**. The migration's only ACL remediation is
`REVOKE ALL PRIVILEGES ON TABLE public.auth_tenant_memberships FROM service_role`,
which is table-local and does not change default privileges, roles, or any other
table. The exact coordinator `SELECT` grant remains the later separately approved
operation in this runbook; exactly five constraints (the primary key, tenant and
composite `(user_id, tenant_id)` foreign keys, and two lifecycle checks), with no
foreign key to `auth.users`; two partial one-active unique indexes; exactly
two enabled non-internal triggers—the row-level lifecycle trigger and
statement-level no-truncate trigger—both attached to the canonical guard function;
no full-history tuple unique constraint; and
`mapping_count = 0`. Any unexpected mapping, policy, grant, constraint, index, or
trigger is a stop condition. The
`policy_count` readback must be `1`, for the canonical
`auth_tenant_memberships_runtime_select` SELECT policy only; it does not grant
table privileges to browser roles. Do not add, revoke, or otherwise repair any
ACL beyond the migration's table-local `service_role` revoke in this schema script:
remediate any other grant source under the approved access-control process, then
rerun the complete script.

## Post-grant coordinator-role verification — required before mapping or application release

Only after the preceding post-apply schema readback has recorded zero non-owner
relation and column ACL rows, perform **Authorize the verified coordinator runtime
lookup — separate approved operation** above. Then rerun the exact **Coordinator
`DATABASE_URL` runtime-role preflight** block in the same approved production SQL
Editor project with the same reviewed non-secret deployment role name. Record its
`PASS` notice and the following ACL inventories in the approved change record.
A changed/unknown role, a failed preflight, or any result outside the acceptance
criteria below is a stop condition; keep containment in place.

```sql
SELECT COALESCE(role.rolname, 'PUBLIC') AS grantee, acl.privilege_type
FROM pg_class relation
CROSS JOIN LATERAL aclexplode(coalesce(relation.relacl, acldefault('r', relation.relowner))) acl
LEFT JOIN pg_roles role ON role.oid = acl.grantee
WHERE relation.oid = 'public.auth_tenant_memberships'::regclass
  AND acl.grantee <> relation.relowner
ORDER BY grantee, acl.privilege_type;

SELECT a.attname AS column_name,
       COALESCE(role.rolname, 'PUBLIC') AS grantee,
       acl.privilege_type
FROM pg_class relation
JOIN pg_attribute a ON a.attrelid = relation.oid
CROSS JOIN LATERAL aclexplode(coalesce(a.attacl, acldefault('c', relation.relowner))) acl
LEFT JOIN pg_roles role ON role.oid = acl.grantee
WHERE relation.oid = 'public.auth_tenant_memberships'::regclass
  AND a.attnum > 0
  AND NOT a.attisdropped
  AND acl.grantee <> relation.relowner
ORDER BY column_name, grantee, acl.privilege_type;
```

Required post-grant ACL results: the relation inventory returns **exactly one**
non-owner row—the reviewed coordinator runtime role with `SELECT`—and the column
ACL inventory returns **zero rows**. The preflight independently verifies that
this is a direct grant, no other non-owner `SELECT` grantee exists, and the role
has no write, ownership, superuser, `BYPASSRLS`, or unsafe reachable-role path.
Do not add any further ACL; remediation of an unexpected result requires the
approved access-control process followed by the complete applicable readback.

## Authorize one existing staff principal — separate approved operation

Only after schema readback and a successful non-production coordinator rehearsal,
an approved operator may add one mapping. Use only a **new Supabase Dashboard SQL
Editor query** under the approved change record.

### Mandatory mapping-manifest gate — before the membership INSERT

Before replacing any SQL placeholder or running the transaction, attach a
reviewable mapping manifest to the approved change record. It must list this
single proposed link verbatim, with all of the following fields:

| Required manifest field | Required value/evidence |
| --- | --- |
| Exact Auth UUID | The exact `auth_user_id` UUID proposed for the link. |
| Exact application user UUID | The exact existing `public.users.id` UUID proposed for the link. |
| Exact tenant UUID | The exact existing `public.users.tenant_id` UUID proposed for the link. |
| Business label | The reviewed staff/business identity label for this proposed link. |
| Auth Admin source/ownership verification | Reviewable supported Auth Admin evidence that the exact Auth UUID is the approved external identity, plus source/ownership evidence linking that external identity to the proposed application user and tenant. |
| Source and ownership evidence | Reviewable source records and ownership evidence supporting **each** Auth-to-app-user, app-user-to-tenant, and Auth-to-tenant relational edge. |

This approved manual manifest, including its Auth Admin source/ownership
verification, establishes the external Auth-identity edge before the INSERT;
the membership table intentionally has no `auth.users` foreign key because its
immutable `auth_user_id` retains revoked identity history after supported Auth
Admin deletion. This manifest—not email, Auth confirmation, login activity, `auth.users` lookup,
or metadata—is the authority for proposing the mapping. Preserve the reviewed
three-UUID tuple verbatim from the manifest when replacing the SQL placeholders;
do not transpose, derive, normalize, or substitute any value. Revalidate the
verbatim tuple against the manifest immediately before execution and against the
final SQL query before approval. If the application principal is absent, the
tenant is absent, or any required relational edge lacks source/ownership evidence,
record **NO MAPPING PROPOSED** for that case. Do not run the INSERT, infer a link,
or use a different identifier to fill the gap; escalate under the approved change
record instead.

Replace each of the three `NULL::uuid` placeholders below only with the reviewed
manifest UUID literal for that field, retaining the casts. The serializable
transaction validates the exact existing `public.users (id, tenant_id)` pair,
refuses any active auth-user or app-user binding, creates exactly one membership,
and reads the result back by the reviewed three-value tuple. Any missing/replaced-
wrong input, zero or multiple matching application users, active-binding conflict,
insert failure, or readback failure aborts the transaction, so it makes no
application state change.

```sql
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

DO $$
DECLARE
  reviewed_auth_user_id uuid := NULL::uuid; -- Replace only with the reviewed auth_user_id UUID.
  reviewed_user_id uuid := NULL::uuid; -- Replace only with the reviewed public.users.id UUID.
  reviewed_tenant_id uuid := NULL::uuid; -- Replace only with the reviewed public.users.tenant_id UUID.
  exact_app_user_count integer;
  active_auth_binding_count integer;
  active_app_binding_count integer;
  final_active_tuple_count integer;
  inserted_membership_id uuid;
BEGIN
  IF reviewed_auth_user_id IS NULL OR reviewed_user_id IS NULL OR reviewed_tenant_id IS NULL THEN
    RAISE EXCEPTION 'STOP: auth_user_id, user_id, and tenant_id must all be independently reviewed UUIDs';
  END IF;

  SELECT count(*)
  INTO exact_app_user_count
  FROM public.users AS app_user
  WHERE app_user.id = reviewed_user_id
    AND app_user.tenant_id = reviewed_tenant_id;

  IF exact_app_user_count = 0 THEN
    RAISE EXCEPTION 'STOP: no public.users row matches the reviewed user_id and tenant_id';
  ELSIF exact_app_user_count > 1 THEN
    RAISE EXCEPTION 'STOP: multiple public.users rows match the reviewed user_id and tenant_id';
  END IF;

  SELECT count(*)
  INTO active_auth_binding_count
  FROM public.auth_tenant_memberships AS membership
  WHERE membership.auth_user_id = reviewed_auth_user_id
    AND membership.status = 'active'
    AND membership.revoked_at IS NULL;

  IF active_auth_binding_count > 0 THEN
    RAISE EXCEPTION 'STOP: reviewed auth_user_id already has an active membership binding';
  END IF;

  SELECT count(*)
  INTO active_app_binding_count
  FROM public.auth_tenant_memberships AS membership
  WHERE membership.user_id = reviewed_user_id
    AND membership.status = 'active'
    AND membership.revoked_at IS NULL;

  IF active_app_binding_count > 0 THEN
    RAISE EXCEPTION 'STOP: reviewed user_id already has an active membership binding';
  END IF;

  INSERT INTO public.auth_tenant_memberships (auth_user_id, user_id, tenant_id)
  VALUES (reviewed_auth_user_id, reviewed_user_id, reviewed_tenant_id)
  RETURNING id INTO inserted_membership_id;

  IF inserted_membership_id IS NULL THEN
    RAISE EXCEPTION 'STOP: membership insert did not return an id';
  END IF;

  PERFORM set_config('app.reviewed_auth_user_id', reviewed_auth_user_id::text, true);
  PERFORM set_config('app.reviewed_user_id', reviewed_user_id::text, true);
  PERFORM set_config('app.reviewed_tenant_id', reviewed_tenant_id::text, true);

  SELECT count(*)
  INTO final_active_tuple_count
  FROM public.auth_tenant_memberships AS membership
  WHERE membership.auth_user_id = reviewed_auth_user_id
    AND membership.user_id = reviewed_user_id
    AND membership.tenant_id = reviewed_tenant_id
    AND membership.status = 'active'
    AND membership.revoked_at IS NULL;

  IF final_active_tuple_count <> 1 THEN
    RAISE EXCEPTION 'STOP: final reviewed UUID tuple readback did not return exactly one active membership';
  END IF;
END $$;

SELECT id, auth_user_id, user_id, tenant_id, status, created_at, activated_at
FROM public.auth_tenant_memberships
WHERE auth_user_id = current_setting('app.reviewed_auth_user_id', true)::uuid
  AND user_id = current_setting('app.reviewed_user_id', true)::uuid
  AND tenant_id = current_setting('app.reviewed_tenant_id', true)::uuid
  AND status = 'active'
  AND revoked_at IS NULL
ORDER BY created_at, id;

COMMIT;
```

The final readback must contain the newly inserted row with the exact reviewed
UUID tuple and `status = 'active'`. If the query returns zero rows, multiple
unexpected rows, or any error, treat it as a stop condition: do not retry with
different values, alter `public.users` or `public.tenants`, or bypass the checks.
Record the error/result and escalate under the approved change record. Then verify
with a server-verified non-production session that the authorized admin route
works, forged tenant/user/scope headers fail, and a revoked mapping produces
coordinator `403`.

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
