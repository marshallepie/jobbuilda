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

  -- The old candidate used this full-history uniqueness rule. Reject a unique
  -- constraint or standalone unique index by shape, whatever its name, because it
  -- prevents revoke then rebind of the same tuple. INCLUDE columns are not key
  -- attributes, so compare only the three key attributes and permit indnatts > 3.
  IF EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = membership_oid
      AND i.indisunique
      AND i.indpred IS NULL
      AND i.indnkeyatts = 3
      -- pg_index.indkey is an int2vector. Its cast array is zero-based, while
      -- ARRAY[...] literals are one-based; slice from its catalog bounds to
      -- normalize both bounds and preserve the required key order.
      AND (i.indkey::smallint[])[0:2] = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = membership_oid AND attname = 'auth_user_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = membership_oid AND attname = 'user_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = membership_oid AND attname = 'tenant_id')
      ]::smallint[]
  ) THEN
    RAISE EXCEPTION 'Legacy full-history unique index on (auth_user_id, user_id, tenant_id) is incompatible; do not apply this script over it';
  END IF;

  IF (SELECT count(*) FROM pg_constraint WHERE conrelid = membership_oid) <> 6
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = membership_oid AND conname = 'auth_tenant_memberships_pkey' AND contype = 'p' AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = membership_oid AND attname = 'id')]::smallint[])
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = membership_oid AND conname = 'auth_tenant_memberships_auth_user_fkey' AND contype = 'f' AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = membership_oid AND attname = 'auth_user_id')]::smallint[] AND confrelid = 'auth.users'::regclass AND confdeltype = 'r')
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

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl
    LEFT JOIN pg_roles r ON r.oid = acl.grantee
    WHERE c.oid = membership_oid
      AND (acl.grantee = 0 OR r.rolname IN ('anon', 'authenticated'))
      AND acl.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
  ) OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = membership_oid) THEN
    RAISE EXCEPTION 'Existing auth_tenant_memberships RLS or grants are incompatible; expected RLS enabled without browser-role access';
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
  CONSTRAINT auth_tenant_memberships_auth_user_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT,
  CONSTRAINT auth_tenant_memberships_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT,
  CONSTRAINT auth_tenant_memberships_user_tenant_fkey FOREIGN KEY (user_id, tenant_id) REFERENCES public.users (id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT auth_tenant_memberships_status_check CHECK (status IN ('active', 'revoked')),
  CONSTRAINT auth_tenant_memberships_revocation_lifecycle_check CHECK (
    (status = 'active' AND revoked_at IS NULL AND revoked_reason IS NULL) OR
    (status = 'revoked' AND revoked_at IS NOT NULL)
  )
);

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
COMMENT ON TABLE public.auth_tenant_memberships IS
  'Server-owned, manually reviewed Supabase identity to active JobBuilda staff principal mapping.';

COMMIT;
