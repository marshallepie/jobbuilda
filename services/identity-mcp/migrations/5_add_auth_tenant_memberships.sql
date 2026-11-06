-- Identity MCP - Server-owned Supabase Auth to application-principal mapping.
-- Run manually against Supabase after reviewing the authorized tuple backfill runbook.
-- This migration intentionally does not infer mappings from email, auth metadata, or browser input.

BEGIN;

-- Do not let CREATE TABLE IF NOT EXISTS mask an unrelated or incomplete relation
-- left by a prior attempt. A compatible prior table may continue through the
-- forward-only constraint/index additions below.
DO $$
DECLARE
  membership_relation oid := to_regclass('public.auth_tenant_memberships');
  incompatible_columns text;
BEGIN
  IF membership_relation IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_class
      WHERE oid = membership_relation
        AND relkind = 'r'
    ) THEN
      RAISE EXCEPTION
        'Cannot install auth_tenant_memberships: public.auth_tenant_memberships exists but is not a regular table; reconcile it manually before applying this migration';
    END IF;

    SELECT string_agg(expected.name, ', ' ORDER BY expected.name)
      INTO incompatible_columns
      FROM (
        VALUES
          ('id'::text, 'uuid'::regtype),
          ('auth_user_id'::text, 'uuid'::regtype),
          ('user_id'::text, 'uuid'::regtype),
          ('tenant_id'::text, 'uuid'::regtype),
          ('status'::text, 'text'::regtype),
          ('created_at'::text, 'timestamp with time zone'::regtype),
          ('activated_at'::text, 'timestamp with time zone'::regtype),
          ('revoked_at'::text, 'timestamp with time zone'::regtype),
          ('revoked_reason'::text, 'text'::regtype)
      ) AS expected(name, type_oid)
      WHERE NOT EXISTS (
        SELECT 1
        FROM pg_attribute attribute
        WHERE attribute.attrelid = membership_relation
          AND attribute.attname = expected.name
          AND attribute.atttypid = expected.type_oid
          AND attribute.attnum > 0
          AND NOT attribute.attisdropped
      );

    IF incompatible_columns IS NOT NULL THEN
      RAISE EXCEPTION
        'Cannot install auth_tenant_memberships: existing public.auth_tenant_memberships has missing or incompatible columns (%); reconcile it manually before applying this migration',
        incompatible_columns;
    END IF;
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- public.users(id) is already unique, but the composite candidate key makes the
-- mapping's tenant/user invariant explicit and enforceable by a composite FK.
-- This must be established before creating the mapping table below.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND conname = 'users_id_tenant_id_key'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_id_tenant_id_key UNIQUE (id, tenant_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.auth_tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  CONSTRAINT auth_tenant_memberships_revocation_lifecycle_check CHECK (
    (status = 'active' AND revoked_at IS NULL AND revoked_reason IS NULL)
    OR (status = 'revoked' AND revoked_at IS NOT NULL)
  ),
  CONSTRAINT auth_tenant_memberships_user_tenant_fkey
    FOREIGN KEY (user_id, tenant_id)
    REFERENCES public.users (id, tenant_id)
    ON DELETE RESTRICT,
  CONSTRAINT auth_tenant_memberships_identity_history_key
    UNIQUE (auth_user_id, user_id, tenant_id)
);

-- A previously applied compatible relation needs the same tenant/user invariant.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.auth_tenant_memberships'::regclass
      AND conname = 'auth_tenant_memberships_user_tenant_fkey'
  ) THEN
    ALTER TABLE public.auth_tenant_memberships
      ADD CONSTRAINT auth_tenant_memberships_user_tenant_fkey
      FOREIGN KEY (user_id, tenant_id)
      REFERENCES public.users (id, tenant_id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- Retain revoked history, while permitting at most one active external identity
-- and one active application principal at a time.
CREATE UNIQUE INDEX IF NOT EXISTS auth_tenant_memberships_one_active_auth_user
  ON public.auth_tenant_memberships (auth_user_id)
  WHERE status = 'active' AND revoked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS auth_tenant_memberships_one_active_app_user
  ON public.auth_tenant_memberships (user_id)
  WHERE status = 'active' AND revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS auth_tenant_memberships_active_lookup
  ON public.auth_tenant_memberships (auth_user_id, tenant_id, user_id)
  WHERE status = 'active' AND revoked_at IS NULL;

COMMENT ON TABLE public.auth_tenant_memberships IS
  'Server-owned mapping from a Supabase auth.users identity to one active JobBuilda application user and tenant. Populate only from human-reviewed authorized identity tuples.';
COMMENT ON COLUMN public.auth_tenant_memberships.status IS
  'active permits coordinator context resolution; revoked is historical only and must have revoked_at.';

-- Keep browser roles away from this server-owned table only. Do not alter ACLs
-- on unrelated public tables or sequences in this migration.
REVOKE ALL PRIVILEGES ON TABLE public.auth_tenant_memberships FROM anon, authenticated, PUBLIC;

COMMIT;
