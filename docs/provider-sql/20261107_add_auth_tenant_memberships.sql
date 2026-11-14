-- PROVIDER SQL EDITOR ONLY — do not run through node-pg-migrate or pnpm db:migrate.
-- One complete transaction. It creates no identity-to-principal mappings and never reads email or auth metadata.
-- Mappings are a separately approved manual action.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Reject an unknown existing shape before changing it. Object names alone are not
-- compatibility evidence: the catalog definition must be the required definition.
DO $$
DECLARE
  membership_oid oid := to_regclass('public.auth_tenant_memberships');
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

  IF membership_oid IS NULL THEN
    RETURN;
  END IF;

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

  -- The old candidate used this full-history uniqueness rule. Reject it by shape,
  -- whatever its name, because it prevents revoke then rebind of the same tuple.
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = membership_oid AND c.contype = 'u'
      AND c.conkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = membership_oid AND attname = 'auth_user_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = membership_oid AND attname = 'user_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = membership_oid AND attname = 'tenant_id')
      ]::smallint[]
  ) THEN
    RAISE EXCEPTION 'Legacy full-history UNIQUE(auth_user_id, user_id, tenant_id) is incompatible; do not apply this script over it';
  END IF;

  IF (SELECT count(*) FROM pg_constraint WHERE conrelid = membership_oid) <> 6
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = membership_oid AND conname = 'auth_tenant_memberships_pkey' AND contype = 'p' AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = membership_oid AND attname = 'id')]::smallint[])
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = membership_oid AND conname = 'auth_tenant_memberships_auth_user_fkey' AND contype = 'f' AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = membership_oid AND attname = 'auth_user_id')]::smallint[] AND confrelid = 'auth.users'::regclass AND confdeltype = 'r')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = membership_oid AND conname = 'auth_tenant_memberships_tenant_fkey' AND contype = 'f' AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = membership_oid AND attname = 'tenant_id')]::smallint[] AND confrelid = 'public.tenants'::regclass AND confdeltype = 'r')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = membership_oid AND conname = 'auth_tenant_memberships_user_tenant_fkey' AND contype = 'f' AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = membership_oid AND attname = 'user_id'), (SELECT attnum FROM pg_attribute WHERE attrelid = membership_oid AND attname = 'tenant_id')]::smallint[] AND confrelid = 'public.users'::regclass AND confkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.users'::regclass AND attname = 'id'), (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.users'::regclass AND attname = 'tenant_id')]::smallint[] AND confdeltype = 'r')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = membership_oid AND conname = 'auth_tenant_memberships_status_check' AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%status%' AND pg_get_constraintdef(oid) LIKE '%''active''%' AND pg_get_constraintdef(oid) LIKE '%''revoked''%')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = membership_oid AND conname = 'auth_tenant_memberships_revocation_lifecycle_check' AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%status = ''active''%' AND pg_get_constraintdef(oid) LIKE '%revoked_at IS NULL%' AND pg_get_constraintdef(oid) LIKE '%revoked_reason IS NULL%' AND pg_get_constraintdef(oid) LIKE '%status = ''revoked''%' AND pg_get_constraintdef(oid) LIKE '%revoked_at IS NOT NULL%') THEN
    RAISE EXCEPTION 'Existing auth_tenant_memberships constraints are incompatible; object names are insufficient';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'auth_tenant_memberships') THEN
    RAISE EXCEPTION 'Existing RLS policies on public.auth_tenant_memberships require review; this script never broadens browser access';
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
          AND i.indkey::smallint[] = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = membership_oid AND attname = 'auth_user_id')]::smallint[]
          AND pg_get_expr(i.indpred, i.indrelid) = '((status = ''active''::text) AND (revoked_at IS NULL))') OR
        (x.relname = 'auth_tenant_memberships_one_active_app_user'
          AND i.indisunique AND i.indnkeyatts = 1 AND i.indnatts = 1
          AND i.indkey::smallint[] = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = membership_oid AND attname = 'user_id')]::smallint[]
          AND pg_get_expr(i.indpred, i.indrelid) = '((status = ''active''::text) AND (revoked_at IS NULL))') OR
        (x.relname = 'auth_tenant_memberships_active_lookup'
          AND NOT i.indisunique AND i.indnkeyatts = 3 AND i.indnatts = 3
          AND i.indkey::smallint[] = ARRAY[
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

ALTER TABLE public.auth_tenant_memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.auth_tenant_memberships FROM anon, authenticated, PUBLIC;
COMMENT ON TABLE public.auth_tenant_memberships IS
  'Server-owned, manually reviewed Supabase identity to active JobBuilda staff principal mapping.';

COMMIT;
