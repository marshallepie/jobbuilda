-- Server-owned binding from Supabase Auth identities to existing staff principals.
-- Forward-only. This migration intentionally creates no bindings: operators must
-- insert reviewed UUID tuples using docs/AUTH_TENANT_MEMBERSHIPS_RUNBOOK.md.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass AND conname = 'users_id_tenant_id_key'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_id_tenant_id_key UNIQUE (id, tenant_id);
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
    (status = 'active' AND revoked_at IS NULL AND revoked_reason IS NULL) OR
    (status = 'revoked' AND revoked_at IS NOT NULL)
  ),
  CONSTRAINT auth_tenant_memberships_user_tenant_fkey
    FOREIGN KEY (user_id, tenant_id) REFERENCES public.users (id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT auth_tenant_memberships_identity_history_key UNIQUE (auth_user_id, user_id, tenant_id)
);

-- Reconcile an already-created compatible table forward rather than assuming a
-- blank database. An incompatible pre-existing relation must be reviewed first.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.auth_tenant_memberships'::regclass
      AND conname = 'auth_tenant_memberships_user_tenant_fkey'
  ) THEN
    ALTER TABLE public.auth_tenant_memberships
      ADD CONSTRAINT auth_tenant_memberships_user_tenant_fkey
      FOREIGN KEY (user_id, tenant_id) REFERENCES public.users (id, tenant_id) ON DELETE RESTRICT;
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

REVOKE ALL PRIVILEGES ON TABLE public.auth_tenant_memberships FROM anon, authenticated, PUBLIC;
COMMENT ON TABLE public.auth_tenant_memberships IS
  'Server-owned, manually reviewed Supabase identity to active JobBuilda staff principal mapping.';

COMMIT;
