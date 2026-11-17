-- PROVIDER SQL EDITOR ONLY — do not run through node-pg-migrate or pnpm db:migrate.
-- One complete transaction. It creates no identity-to-principal mappings and never reads email or auth metadata.
-- Mappings are a separately approved manual action.

BEGIN;

-- A populated mapping table is never an idempotent reapply: it may contain
-- manually approved bindings. Stop before any DDL rather than risk changing its
-- schema, ACLs, or RLS policy under existing authorization records.
DO $$
DECLARE
  membership_oid oid := to_regclass('public.auth_tenant_memberships');
  membership_has_rows boolean;
  id_attnum smallint;
  auth_user_id_attnum smallint;
  user_id_attnum smallint;
BEGIN
  IF membership_oid IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE oid = membership_oid AND relkind = 'r'
  ) THEN
    RAISE EXCEPTION 'Existing public.auth_tenant_memberships must be an ordinary table';
  END IF;

  -- Do not wait indefinitely behind a concurrent reader/writer before the
  -- pre-DDL ACCESS EXCLUSIVE guard. SET LOCAL is scoped to this transaction
  -- and automatically resets on commit or rollback.
  SET LOCAL lock_timeout = '5s';
  BEGIN
    EXECUTE 'LOCK TABLE public.auth_tenant_memberships IN ACCESS EXCLUSIVE MODE';
  EXCEPTION
    WHEN lock_not_available THEN
      RAISE EXCEPTION 'Could not acquire ACCESS EXCLUSIVE lock on public.auth_tenant_memberships within 5 seconds; a conflicting transaction is active. No DDL was applied; wait for it to finish and retry the complete script.';
  END;
  EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.auth_tenant_memberships)'
    INTO membership_has_rows;
  IF membership_has_rows THEN
    RAISE EXCEPTION 'Existing public.auth_tenant_memberships contains rows; stop before DDL and use the approved mapping lifecycle';
  END IF;

  -- Every unique index is fail-closed unless it is one of the exact canonical
  -- shapes below. This catches direct keys, expression keys (indkey attnum 0),
  -- INCLUDE columns, and predicates that are semantically all-row (for example
  -- WHERE TRUE) without trying to prove arbitrary expression or predicate logic.
  -- The primary key on id is the only non-lifecycle unique shape permitted.
  SELECT attnum INTO id_attnum
  FROM pg_attribute
  WHERE attrelid = membership_oid AND attname = 'id' AND NOT attisdropped;
  SELECT attnum INTO auth_user_id_attnum
  FROM pg_attribute
  WHERE attrelid = membership_oid AND attname = 'auth_user_id' AND NOT attisdropped;
  SELECT attnum INTO user_id_attnum
  FROM pg_attribute
  WHERE attrelid = membership_oid AND attname = 'user_id' AND NOT attisdropped;
  IF EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = membership_oid
      AND i.indisunique
      AND NOT (
        (i.indisprimary
          AND i.indnkeyatts = 1 AND i.indnatts = 1
          AND i.indexprs IS NULL AND i.indpred IS NULL
          AND (i.indkey::smallint[])[0:0] = ARRAY[id_attnum]::smallint[]) OR
        (NOT i.indisprimary
          AND i.indnkeyatts = 1 AND i.indnatts = 1
          AND i.indexprs IS NULL
          AND (i.indkey::smallint[])[0:0] = ARRAY[auth_user_id_attnum]::smallint[]
          AND pg_get_expr(i.indpred, i.indrelid) = '((status = ''active''::text) AND (revoked_at IS NULL))') OR
        (NOT i.indisprimary
          AND i.indnkeyatts = 1 AND i.indnatts = 1
          AND i.indexprs IS NULL
          AND (i.indkey::smallint[])[0:0] = ARRAY[user_id_attnum]::smallint[]
          AND pg_get_expr(i.indpred, i.indrelid) = '((status = ''active''::text) AND (revoked_at IS NULL))')
      )
  ) THEN
    RAISE EXCEPTION 'Existing unique index or constraint is incompatible; only the canonical id primary key and active-only auth_user_id/user_id unique indexes are permitted before the revoked-history rebind lifecycle';
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Reject an unknown existing shape before changing it. Object names alone are not
-- compatibility evidence: the catalog definition must be the required definition.
DO $$
DECLARE
  membership_oid oid := to_regclass('public.auth_tenant_memberships');
  expected_status_constraint text;
  expected_revocation_lifecycle_constraint text;
  expected_membership_columns text[] := ARRAY[
    'id:uuid:NO', 'auth_user_id:uuid:NO', 'user_id:uuid:NO', 'tenant_id:uuid:NO',
    'status:text:NO', 'created_at:timestamp with time zone:NO',
    'activated_at:timestamp with time zone:NO', 'revoked_at:timestamp with time zone:YES',
    'revoked_reason:text:YES'
  ];
  actual_membership_columns text[];
BEGIN
  IF to_regclass('public.users') IS NULL OR to_regclass('public.tenants') IS NULL THEN
    RAISE EXCEPTION 'Expected public.users and public.tenants before applying 20261107_add_auth_tenant_memberships';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname IN ('users', 'tenants') AND c.relkind <> 'r'
  ) THEN
    RAISE EXCEPTION 'public.users and public.tenants must be ordinary tables';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = 'public.users'::regclass AND a.attname = 'id'
      AND a.atttypid = 'uuid'::regtype AND a.attnotnull AND NOT a.attisdropped
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = 'public.users'::regclass AND a.attname = 'tenant_id'
      AND a.atttypid = 'uuid'::regtype AND a.attnotnull AND NOT a.attisdropped
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id'
      AND a.atttypid = 'uuid'::regtype AND a.attnotnull AND NOT a.attisdropped
  ) THEN
    RAISE EXCEPTION 'public.users(id, tenant_id) and public.tenants(id) must be NOT NULL UUID columns';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass AND conname = 'users_id_tenant_id_key'
      AND (contype <> 'u' OR pg_get_constraintdef(oid, true) <> 'UNIQUE (id, tenant_id)')
  ) THEN
    RAISE EXCEPTION 'Existing users_id_tenant_id_key is incompatible; expected UNIQUE (id, tenant_id)';
  END IF;

  -- Index names are schema-wide. A canonical name attached to another relation
  -- makes CREATE INDEX IF NOT EXISTS silently skip the required membership index.
  IF EXISTS (
    SELECT 1
    FROM pg_class x
    JOIN pg_namespace n ON n.oid = x.relnamespace
    JOIN pg_index i ON i.indexrelid = x.oid
    WHERE n.nspname = 'public'
      AND x.relname IN (
        'auth_tenant_memberships_one_active_auth_user',
        'auth_tenant_memberships_one_active_app_user',
        'auth_tenant_memberships_active_lookup'
      )
      AND i.indrelid IS DISTINCT FROM membership_oid
  ) THEN
    RAISE EXCEPTION 'Canonical auth_tenant_memberships index name is already attached to another relation';
  END IF;

  IF membership_oid IS NULL THEN
    RETURN;
  END IF;

  -- Compare normalized catalog definitions against constraints constructed by
  -- PostgreSQL itself, not loose text fragments. This rejects, for example,
  -- a constraint which mentions both permitted status literals but admits a
  -- third value or omits part of the revocation lifecycle.
  CREATE TEMPORARY TABLE auth_tenant_memberships_constraint_shape_probe (
    status text,
    revoked_at timestamptz,
    revoked_reason text,
    CONSTRAINT auth_tenant_memberships_status_check
      CHECK (status IN ('active', 'revoked')),
    CONSTRAINT auth_tenant_memberships_revocation_lifecycle_check
      CHECK (
        (status = 'active' AND revoked_at IS NULL AND revoked_reason IS NULL) OR
        (status = 'revoked' AND revoked_at IS NOT NULL)
      )
  ) ON COMMIT DROP;
  SELECT pg_get_constraintdef(oid)
  INTO expected_status_constraint
  FROM pg_constraint
  WHERE conrelid = 'pg_temp.auth_tenant_memberships_constraint_shape_probe'::regclass
    AND conname = 'auth_tenant_memberships_status_check';
  SELECT pg_get_constraintdef(oid)
  INTO expected_revocation_lifecycle_constraint
  FROM pg_constraint
  WHERE conrelid = 'pg_temp.auth_tenant_memberships_constraint_shape_probe'::regclass
    AND conname = 'auth_tenant_memberships_revocation_lifecycle_check';

  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE oid = membership_oid AND relkind = 'r'
  ) THEN
    RAISE EXCEPTION 'Existing public.auth_tenant_memberships must be an ordinary table';
  END IF;

  SELECT array_agg(attname || ':' || format_type(atttypid, atttypmod) || ':' || CASE WHEN attnotnull THEN 'NO' ELSE 'YES' END ORDER BY attnum)
  INTO actual_membership_columns
  FROM pg_attribute
  WHERE attrelid = membership_oid AND attnum > 0 AND NOT attisdropped;
  IF actual_membership_columns IS DISTINCT FROM expected_membership_columns THEN
    RAISE EXCEPTION 'Existing public.auth_tenant_memberships columns are incompatible; expected exact canonical schema';
  END IF;

  -- CREATE TABLE IF NOT EXISTS does not repair defaults on an existing relation.
  -- Require the canonical defaults explicitly so an older table cannot pass shape
  -- checks yet create incomplete or inactive membership rows.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attrelid = membership_oid AND a.attname = 'id'
      AND pg_get_expr(d.adbin, d.adrelid) = 'gen_random_uuid()'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attrelid = membership_oid AND a.attname = 'status'
      AND pg_get_expr(d.adbin, d.adrelid) = '''active''::text'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attrelid = membership_oid AND a.attname = 'created_at'
      AND pg_get_expr(d.adbin, d.adrelid) = 'now()'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attrelid = membership_oid AND a.attname = 'activated_at'
      AND pg_get_expr(d.adbin, d.adrelid) = 'now()'
  ) THEN
    RAISE EXCEPTION 'Existing auth_tenant_memberships defaults are incompatible; expected id gen_random_uuid(), status active, created_at now(), and activated_at now()';
  END IF;


  IF (SELECT count(*) FROM pg_constraint WHERE conrelid = membership_oid) <> 5
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = membership_oid AND conname = 'auth_tenant_memberships_pkey' AND contype = 'p' AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = membership_oid AND attname = 'id')]::smallint[])
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = membership_oid AND conname = 'auth_tenant_memberships_tenant_fkey' AND contype = 'f' AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = membership_oid AND attname = 'tenant_id')]::smallint[] AND confrelid = 'public.tenants'::regclass AND confdeltype = 'r')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = membership_oid AND conname = 'auth_tenant_memberships_user_tenant_fkey' AND contype = 'f' AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = membership_oid AND attname = 'user_id'), (SELECT attnum FROM pg_attribute WHERE attrelid = membership_oid AND attname = 'tenant_id')]::smallint[] AND confrelid = 'public.users'::regclass AND confkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.users'::regclass AND attname = 'id'), (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.users'::regclass AND attname = 'tenant_id')]::smallint[] AND confdeltype = 'r')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = membership_oid AND conname = 'auth_tenant_memberships_status_check' AND contype = 'c' AND pg_get_constraintdef(oid) = expected_status_constraint)
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = membership_oid AND conname = 'auth_tenant_memberships_revocation_lifecycle_check' AND contype = 'c' AND pg_get_constraintdef(oid) = expected_revocation_lifecycle_constraint) THEN
    RAISE EXCEPTION 'Existing auth_tenant_memberships constraints are incompatible; object names are insufficient';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policy policy
    WHERE policy.polrelid = membership_oid
      AND (
        policy.polname <> 'auth_tenant_memberships_runtime_select'
        OR policy.polcmd <> 'r'
        OR NOT policy.polpermissive
        OR policy.polroles <> ARRAY[0]::oid[]
        OR pg_get_expr(policy.polqual, policy.polrelid) <> '(CURRENT_USER = SESSION_USER)'
        OR policy.polwithcheck IS NOT NULL
      )
  ) OR (SELECT count(*) FROM pg_policy WHERE polrelid = membership_oid) > 1 THEN
    RAISE EXCEPTION 'Existing auth_tenant_memberships RLS policy is incompatible; expected only the canonical runtime SELECT policy';
  END IF;

  -- A legacy zero-row relation may retain only the provider's service_role table
  -- ACLs. They are removed after CREATE TABLE IF NOT EXISTS below; every other
  -- non-owner relation ACL remains incompatible before any lifecycle DDL.
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl
    LEFT JOIN pg_roles r ON r.oid = acl.grantee
    WHERE c.oid = membership_oid
      AND acl.grantee <> c.relowner
      AND r.rolname IS DISTINCT FROM 'service_role'
  ) OR EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_attribute a ON a.attrelid = c.oid
    CROSS JOIN LATERAL aclexplode(coalesce(a.attacl, acldefault('c', c.relowner))) acl
    WHERE c.oid = membership_oid
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND acl.grantee <> c.relowner
  ) OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = membership_oid) THEN
    RAISE EXCEPTION 'Existing auth_tenant_memberships RLS or ACLs are incompatible; expected RLS enabled, only legacy service_role relation ACLs, and no non-owner column ACLs';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_class x ON x.oid = i.indexrelid
    WHERE i.indrelid = membership_oid
      AND x.relname IN ('auth_tenant_memberships_one_active_auth_user', 'auth_tenant_memberships_one_active_app_user', 'auth_tenant_memberships_active_lookup')
      AND NOT (
        (x.relname = 'auth_tenant_memberships_one_active_auth_user'
          AND i.indisunique AND i.indnkeyatts = 1 AND i.indnatts = 1
          AND (i.indkey::smallint[])[0:0] = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = membership_oid AND attname = 'auth_user_id')]::smallint[]
          AND pg_get_expr(i.indpred, i.indrelid) = '((status = ''active''::text) AND (revoked_at IS NULL))') OR
        (x.relname = 'auth_tenant_memberships_one_active_app_user'
          AND i.indisunique AND i.indnkeyatts = 1 AND i.indnatts = 1
          AND (i.indkey::smallint[])[0:0] = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = membership_oid AND attname = 'user_id')]::smallint[]
          AND pg_get_expr(i.indpred, i.indrelid) = '((status = ''active''::text) AND (revoked_at IS NULL))') OR
        (x.relname = 'auth_tenant_memberships_active_lookup'
          AND NOT i.indisunique AND i.indnkeyatts = 3 AND i.indnatts = 3
          AND (i.indkey::smallint[])[0:2] = ARRAY[
            (SELECT attnum FROM pg_attribute WHERE attrelid = membership_oid AND attname = 'auth_user_id'),
            (SELECT attnum FROM pg_attribute WHERE attrelid = membership_oid AND attname = 'tenant_id'),
            (SELECT attnum FROM pg_attribute WHERE attrelid = membership_oid AND attname = 'user_id')
          ]::smallint[]
          AND pg_get_expr(i.indpred, i.indrelid) = '((status = ''active''::text) AND (revoked_at IS NULL))')
      )
  ) THEN
    RAISE EXCEPTION 'Existing auth_tenant_memberships index is incompatible; index name alone is insufficient';
  END IF;
END $$;

-- The referenced composite key must exist before the membership foreign key is created.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'public.users'::regclass AND conname = 'users_id_tenant_id_key'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_id_tenant_id_key UNIQUE (id, tenant_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.auth_tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  -- auth_user_id is immutable retained identity history. It deliberately has no
  -- auth.users foreign key so a supported Auth Admin deletion can remove a
  -- retired identity only after its mapping is revoked, while retaining the UUID.
  CONSTRAINT auth_tenant_memberships_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT,
  CONSTRAINT auth_tenant_memberships_user_tenant_fkey FOREIGN KEY (user_id, tenant_id) REFERENCES public.users (id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT auth_tenant_memberships_status_check CHECK (status IN ('active', 'revoked')),
  CONSTRAINT auth_tenant_memberships_revocation_lifecycle_check CHECK (
    (status = 'active' AND revoked_at IS NULL AND revoked_reason IS NULL) OR
    (status = 'revoked' AND revoked_at IS NOT NULL)
  )
);

-- The legacy provider-created zero-row relation may have only service_role ACLs.
-- Remove those ACLs on this table only; do not alter default privileges, roles,
-- or ACLs on any other relation. The exact coordinator SELECT grant is a later,
-- separately approved operation in the runbook.
REVOKE ALL PRIVILEGES ON TABLE public.auth_tenant_memberships FROM service_role;

CREATE UNIQUE INDEX IF NOT EXISTS auth_tenant_memberships_one_active_auth_user
  ON public.auth_tenant_memberships (auth_user_id)
  WHERE status = 'active' AND revoked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS auth_tenant_memberships_one_active_app_user
  ON public.auth_tenant_memberships (user_id)
  WHERE status = 'active' AND revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS auth_tenant_memberships_active_lookup
  ON public.auth_tenant_memberships (auth_user_id, tenant_id, user_id)
  WHERE status = 'active' AND revoked_at IS NULL;

-- CREATE INDEX IF NOT EXISTS is not evidence that the named indexes were created
-- on this relation. Assert all three definitions after DDL before committing.
DO $$
BEGIN
  IF (SELECT count(*)
      FROM pg_index i
      JOIN pg_class x ON x.oid = i.indexrelid
      WHERE i.indrelid = 'public.auth_tenant_memberships'::regclass
        AND x.relname IN (
          'auth_tenant_memberships_one_active_auth_user',
          'auth_tenant_memberships_one_active_app_user',
          'auth_tenant_memberships_active_lookup'
        )) <> 3
     OR NOT EXISTS (
       SELECT 1 FROM pg_index i JOIN pg_class x ON x.oid = i.indexrelid
       WHERE i.indrelid = 'public.auth_tenant_memberships'::regclass
         AND x.relname = 'auth_tenant_memberships_one_active_auth_user'
         AND i.indisunique AND i.indnkeyatts = 1 AND i.indnatts = 1
         AND (i.indkey::smallint[])[0:0] = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.auth_tenant_memberships'::regclass AND attname = 'auth_user_id')]::smallint[]
         AND pg_get_expr(i.indpred, i.indrelid) = '((status = ''active''::text) AND (revoked_at IS NULL))'
     ) OR NOT EXISTS (
       SELECT 1 FROM pg_index i JOIN pg_class x ON x.oid = i.indexrelid
       WHERE i.indrelid = 'public.auth_tenant_memberships'::regclass
         AND x.relname = 'auth_tenant_memberships_one_active_app_user'
         AND i.indisunique AND i.indnkeyatts = 1 AND i.indnatts = 1
         AND (i.indkey::smallint[])[0:0] = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.auth_tenant_memberships'::regclass AND attname = 'user_id')]::smallint[]
         AND pg_get_expr(i.indpred, i.indrelid) = '((status = ''active''::text) AND (revoked_at IS NULL))'
     ) OR NOT EXISTS (
       SELECT 1 FROM pg_index i JOIN pg_class x ON x.oid = i.indexrelid
       WHERE i.indrelid = 'public.auth_tenant_memberships'::regclass
         AND x.relname = 'auth_tenant_memberships_active_lookup'
         AND NOT i.indisunique AND i.indnkeyatts = 3 AND i.indnatts = 3
         AND (i.indkey::smallint[])[0:2] = ARRAY[
           (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.auth_tenant_memberships'::regclass AND attname = 'auth_user_id'),
           (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.auth_tenant_memberships'::regclass AND attname = 'tenant_id'),
           (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.auth_tenant_memberships'::regclass AND attname = 'user_id')
         ]::smallint[]
         AND pg_get_expr(i.indpred, i.indrelid) = '((status = ''active''::text) AND (revoked_at IS NULL))'
     ) THEN
    RAISE EXCEPTION 'Canonical auth_tenant_memberships indexes must be attached to the membership relation with exact predicates';
  END IF;
END $$;

-- This function is provider-owned only when it is absent or owned by the executing
-- provider role and already belongs exclusively to the two canonical membership
-- triggers. Never replace its body or change its ACL if another role owns it or
-- another relation's trigger depends on it.
DO $$
DECLARE
  lifecycle_guard_oid oid := to_regprocedure('public.auth_tenant_memberships_lifecycle_guard()');
BEGIN
  IF lifecycle_guard_oid IS NOT NULL AND (
    NOT EXISTS (
      SELECT 1
      FROM pg_proc lifecycle_guard
      WHERE lifecycle_guard.oid = lifecycle_guard_oid
        AND lifecycle_guard.proowner = current_user::regrole
    )
    OR
    (SELECT count(*)
     FROM pg_trigger trigger
     WHERE trigger.tgfoid = lifecycle_guard_oid) <> 2
    OR NOT EXISTS (
      SELECT 1
      FROM pg_trigger trigger
      WHERE trigger.tgfoid = lifecycle_guard_oid
        AND trigger.tgrelid = 'public.auth_tenant_memberships'::regclass
        AND trigger.tgname = 'auth_tenant_memberships_lifecycle_guard'
        AND NOT trigger.tgisinternal
        AND trigger.tgenabled = 'O'
        AND trigger.tgtype = 31
        AND trigger.tgqual IS NULL
        AND trigger.tgattr = ''::int2vector
        AND octet_length(trigger.tgargs) = 0
        AND trigger.tgconstraint = 0
        AND NOT trigger.tgdeferrable
        AND NOT trigger.tginitdeferred
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_trigger trigger
      WHERE trigger.tgfoid = lifecycle_guard_oid
        AND trigger.tgrelid = 'public.auth_tenant_memberships'::regclass
        AND trigger.tgname = 'auth_tenant_memberships_no_truncate'
        AND NOT trigger.tgisinternal
        AND trigger.tgenabled = 'O'
        AND trigger.tgtype = 34
        AND trigger.tgqual IS NULL
        AND trigger.tgattr = ''::int2vector
        AND octet_length(trigger.tgargs) = 0
        AND trigger.tgconstraint = 0
        AND NOT trigger.tgdeferrable
        AND NOT trigger.tginitdeferred
    )
  ) THEN
    RAISE EXCEPTION 'Existing public.auth_tenant_memberships_lifecycle_guard() is not owned by current_user or exclusively referenced by the two canonical public.auth_tenant_memberships triggers; stop before replacing the function or changing its ACL';
  END IF;
END $$;

-- Membership rows are historical authorization records. RLS and table ACLs do
-- not constrain an owner, service role, or other privileged direct-DML path, so
-- enforce the lifecycle in a table trigger as well. An approved rebind is a new
-- active row; it never overwrites or deletes the revoked row.
CREATE OR REPLACE FUNCTION public.auth_tenant_memberships_lifecycle_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP = 'DELETE' OR TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'auth_tenant_memberships is append-only: % is forbidden', TG_OP;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'active' OR NEW.revoked_at IS NOT NULL OR NEW.revoked_reason IS NOT NULL THEN
      RAISE EXCEPTION 'auth_tenant_memberships lifecycle requires new rows to be active and unrevoked';
    END IF;
    RETURN NEW;
  END IF;

  -- Identity linkage and creation evidence are immutable for the complete
  -- lifetime of a row. A revocation may only add its own terminal evidence.
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.activated_at IS DISTINCT FROM OLD.activated_at THEN
    RAISE EXCEPTION 'auth_tenant_memberships historical identity linkage is immutable';
  END IF;

  IF OLD.status <> 'active' OR OLD.revoked_at IS NOT NULL OR OLD.revoked_reason IS NOT NULL THEN
    RAISE EXCEPTION 'auth_tenant_memberships revoked rows are terminal and cannot be changed or reactivated';
  END IF;

  IF NEW.status <> 'revoked'
     OR NEW.revoked_at IS NULL
     OR NEW.revoked_at < OLD.activated_at
     OR NEW.revoked_reason IS NULL
     OR btrim(NEW.revoked_reason) = '' THEN
    RAISE EXCEPTION 'auth_tenant_memberships permits only an active-to-revoked transition with a nonblank revocation reason and valid timestamp';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.auth_tenant_memberships_lifecycle_guard() FROM PUBLIC;

-- DROP TRIGGER IF EXISTS matches by trigger name, not function or trigger shape.
-- Refuse to delete a same-named or supplemental user trigger unless the relation
-- has no user triggers or exactly the two canonical enabled lifecycle triggers.
-- Canonical means no WHEN predicate, UPDATE OF column list, trigger arguments,
-- or constraint/deferred state; a same-named trigger with any of those fields
-- must stop rather than be silently dropped and recreated.
DO $$
BEGIN
  IF (SELECT count(*)
      FROM pg_trigger trigger
      WHERE trigger.tgrelid = 'public.auth_tenant_memberships'::regclass
        AND NOT trigger.tgisinternal) <> 0
     AND (
       (SELECT count(*)
        FROM pg_trigger trigger
        WHERE trigger.tgrelid = 'public.auth_tenant_memberships'::regclass
          AND NOT trigger.tgisinternal) <> 2
       OR NOT EXISTS (
         SELECT 1
         FROM pg_trigger trigger
         WHERE trigger.tgrelid = 'public.auth_tenant_memberships'::regclass
           AND trigger.tgname = 'auth_tenant_memberships_lifecycle_guard'
           AND NOT trigger.tgisinternal
           AND trigger.tgenabled = 'O'
           AND trigger.tgtype = 31
           AND trigger.tgqual IS NULL
           AND trigger.tgattr = ''::int2vector
           AND octet_length(trigger.tgargs) = 0
           AND trigger.tgconstraint = 0
           AND NOT trigger.tgdeferrable
           AND NOT trigger.tginitdeferred
           AND trigger.tgfoid = 'public.auth_tenant_memberships_lifecycle_guard()'::regprocedure
       ) OR NOT EXISTS (
         SELECT 1
         FROM pg_trigger trigger
         WHERE trigger.tgrelid = 'public.auth_tenant_memberships'::regclass
           AND trigger.tgname = 'auth_tenant_memberships_no_truncate'
           AND NOT trigger.tgisinternal
           AND trigger.tgenabled = 'O'
           AND trigger.tgtype = 34
           AND trigger.tgqual IS NULL
           AND trigger.tgattr = ''::int2vector
           AND octet_length(trigger.tgargs) = 0
           AND trigger.tgconstraint = 0
           AND NOT trigger.tgdeferrable
           AND NOT trigger.tginitdeferred
           AND trigger.tgfoid = 'public.auth_tenant_memberships_lifecycle_guard()'::regprocedure
       )
     ) THEN
    RAISE EXCEPTION 'Existing public.auth_tenant_memberships user triggers are incompatible; stop before DROP TRIGGER. Expected zero user triggers or exactly the two enabled canonical lifecycle triggers bound to public.auth_tenant_memberships_lifecycle_guard()';
  END IF;
END $$;

DROP TRIGGER IF EXISTS auth_tenant_memberships_lifecycle_guard
  ON public.auth_tenant_memberships;
DROP TRIGGER IF EXISTS auth_tenant_memberships_no_truncate
  ON public.auth_tenant_memberships;
CREATE TRIGGER auth_tenant_memberships_lifecycle_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.auth_tenant_memberships
  FOR EACH ROW EXECUTE FUNCTION public.auth_tenant_memberships_lifecycle_guard();
CREATE TRIGGER auth_tenant_memberships_no_truncate
  BEFORE TRUNCATE ON public.auth_tenant_memberships
  FOR EACH STATEMENT EXECUTE FUNCTION public.auth_tenant_memberships_lifecycle_guard();

-- CREATE TRIGGER has no IF NOT EXISTS. Recreate the two canonical triggers and
-- fail closed unless they are the relation's only non-internal triggers. This
-- prevents a supplemental trigger from mutating NEW after the lifecycle guard.
DO $$
BEGIN
  IF (SELECT count(*) FROM pg_trigger
      WHERE tgrelid = 'public.auth_tenant_memberships'::regclass
        AND NOT tgisinternal) <> 2
     OR NOT EXISTS (
       SELECT 1
       FROM pg_trigger trigger
       WHERE trigger.tgrelid = 'public.auth_tenant_memberships'::regclass
         AND trigger.tgname = 'auth_tenant_memberships_lifecycle_guard'
         AND NOT trigger.tgisinternal
         AND trigger.tgenabled = 'O'
         AND trigger.tgtype = 31
         AND trigger.tgqual IS NULL
         AND trigger.tgattr = ''::int2vector
         AND octet_length(trigger.tgargs) = 0
         AND trigger.tgconstraint = 0
         AND NOT trigger.tgdeferrable
         AND NOT trigger.tginitdeferred
         AND trigger.tgfoid = 'public.auth_tenant_memberships_lifecycle_guard()'::regprocedure
     ) OR NOT EXISTS (
       SELECT 1
       FROM pg_trigger trigger
       WHERE trigger.tgrelid = 'public.auth_tenant_memberships'::regclass
         AND trigger.tgname = 'auth_tenant_memberships_no_truncate'
         AND NOT trigger.tgisinternal
         AND trigger.tgenabled = 'O'
         AND trigger.tgtype = 34
         AND trigger.tgqual IS NULL
         AND trigger.tgattr = ''::int2vector
         AND octet_length(trigger.tgargs) = 0
         AND trigger.tgconstraint = 0
         AND NOT trigger.tgdeferrable
         AND NOT trigger.tginitdeferred
         AND trigger.tgfoid = 'public.auth_tenant_memberships_lifecycle_guard()'::regprocedure
     ) THEN
    RAISE EXCEPTION 'auth_tenant_memberships must have exactly two enabled non-internal canonical lifecycle triggers';
  END IF;
END $$;

ALTER TABLE public.auth_tenant_memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.auth_tenant_memberships FROM anon, authenticated, PUBLIC;
-- RLS does not confer table privileges. This policy requires a direct login
-- identity (no SET ROLE) while the separately approved exact coordinator role
-- receives SELECT in the runbook. anon/authenticated/PUBLIC have no SELECT ACL,
-- so this policy cannot make mappings browser-readable.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policy
    WHERE polrelid = 'public.auth_tenant_memberships'::regclass
      AND polname = 'auth_tenant_memberships_runtime_select'
  ) THEN
    CREATE POLICY auth_tenant_memberships_runtime_select
      ON public.auth_tenant_memberships
      FOR SELECT
      TO PUBLIC
      USING (current_user = session_user);
  END IF;
END $$;

-- Assert the table-local service_role remediation and fail closed for every
-- remaining non-owner relation or column ACL. Do not alter default privileges,
-- roles, or any other relation to make this pass.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl
    WHERE c.oid = 'public.auth_tenant_memberships'::regclass
      AND acl.grantee <> c.relowner
  ) THEN
    RAISE EXCEPTION 'auth_tenant_memberships has non-owner direct table ACLs after DDL; remediate the grant source and rerun the complete script';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_attribute a ON a.attrelid = c.oid
    CROSS JOIN LATERAL aclexplode(coalesce(a.attacl, acldefault('c', c.relowner))) acl
    WHERE c.oid = 'public.auth_tenant_memberships'::regclass
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND acl.grantee <> c.relowner
  ) THEN
    RAISE EXCEPTION 'auth_tenant_memberships has non-owner column ACLs after DDL; remediate the grant source and rerun the complete script';
  END IF;
END $$;
COMMENT ON TABLE public.auth_tenant_memberships IS
  'Server-owned, manually reviewed Supabase identity to active JobBuilda staff principal mapping.';

COMMIT;
