-- PROVIDER SQL EDITOR ONLY — do not run through node-pg-migrate or pnpm db:migrate.
--
-- Evidence for this path: the prior identity migration documents Supabase SQL Editor
-- application, while the production history is provider-owned (remote_schema) rather
-- than a verified node-pg-migrate ledger. This is one complete raw SQL transaction.
-- It creates no identity-to-principal mappings and never reads email or auth metadata.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF to_regclass('public.users') IS NULL OR to_regclass('public.tenants') IS NULL THEN
    RAISE EXCEPTION 'Expected public.users and public.tenants before applying 20261107_add_auth_tenant_memberships';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass AND conname = 'users_id_tenant_id_key'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_id_tenant_id_key UNIQUE (id, tenant_id);
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
  CONSTRAINT auth_tenant_memberships_auth_user_fkey
    FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT,
  CONSTRAINT auth_tenant_memberships_tenant_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT
);

-- Safe forward upgrade for an already-created empty or compatible table. New columns
-- are intentionally nullable here: populated legacy rows must be reviewed, never
-- silently converted into active mappings.
ALTER TABLE public.auth_tenant_memberships
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS auth_user_id UUID,
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS tenant_id UUID,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_reason TEXT;

DO $$
DECLARE
  populated boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.auth_tenant_memberships) INTO populated;

  IF populated AND EXISTS (
    SELECT 1
    FROM public.auth_tenant_memberships
    WHERE id IS NULL
       OR auth_user_id IS NULL
       OR user_id IS NULL
       OR tenant_id IS NULL
       OR status IS NULL
       OR status NOT IN ('active', 'revoked')
       OR (status = 'active' AND (revoked_at IS NOT NULL OR revoked_reason IS NOT NULL))
       OR (status = 'revoked' AND revoked_at IS NULL)
  ) THEN
    RAISE EXCEPTION
      'Existing auth_tenant_memberships rows are not canonical; stop and review explicit UUID tuples before this migration';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_tenant_memberships'
  ) THEN
    RAISE EXCEPTION
      'Existing RLS policies on public.auth_tenant_memberships require review; this script never broadens browser access';
  END IF;
END $$;

ALTER TABLE public.auth_tenant_memberships
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN auth_user_id SET NOT NULL,
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'active',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN activated_at SET DEFAULT now(),
  ALTER COLUMN activated_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.auth_tenant_memberships'::regclass
      AND conname = 'auth_tenant_memberships_pkey'
  ) THEN
    ALTER TABLE public.auth_tenant_memberships
      ADD CONSTRAINT auth_tenant_memberships_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.auth_tenant_memberships'::regclass
      AND conname = 'auth_tenant_memberships_auth_user_fkey'
  ) THEN
    ALTER TABLE public.auth_tenant_memberships
      ADD CONSTRAINT auth_tenant_memberships_auth_user_fkey
      FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.auth_tenant_memberships'::regclass
      AND conname = 'auth_tenant_memberships_tenant_fkey'
  ) THEN
    ALTER TABLE public.auth_tenant_memberships
      ADD CONSTRAINT auth_tenant_memberships_tenant_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.auth_tenant_memberships'::regclass
      AND conname = 'auth_tenant_memberships_user_tenant_fkey'
  ) THEN
    ALTER TABLE public.auth_tenant_memberships
      ADD CONSTRAINT auth_tenant_memberships_user_tenant_fkey
      FOREIGN KEY (user_id, tenant_id) REFERENCES public.users (id, tenant_id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.auth_tenant_memberships'::regclass
      AND conname = 'auth_tenant_memberships_status_check'
  ) THEN
    ALTER TABLE public.auth_tenant_memberships
      ADD CONSTRAINT auth_tenant_memberships_status_check
      CHECK (status IN ('active', 'revoked'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.auth_tenant_memberships'::regclass
      AND conname = 'auth_tenant_memberships_revocation_lifecycle_check'
  ) THEN
    ALTER TABLE public.auth_tenant_memberships
      ADD CONSTRAINT auth_tenant_memberships_revocation_lifecycle_check CHECK (
        (status = 'active' AND revoked_at IS NULL AND revoked_reason IS NULL) OR
        (status = 'revoked' AND revoked_at IS NOT NULL)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.auth_tenant_memberships'::regclass
      AND conname = 'auth_tenant_memberships_identity_history_key'
  ) THEN
    ALTER TABLE public.auth_tenant_memberships
      ADD CONSTRAINT auth_tenant_memberships_identity_history_key
      UNIQUE (auth_user_id, user_id, tenant_id);
  END IF;
END $$;

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
