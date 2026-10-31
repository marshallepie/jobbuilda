-- Apply to the coordinator database before deploying portal routes.
CREATE TABLE IF NOT EXISTS portal_principals (id UUID PRIMARY KEY, email TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE portal_principals ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS portal_memberships (id UUID PRIMARY KEY, principal_id UUID NOT NULL REFERENCES portal_principals(id) ON DELETE CASCADE, tenant_id UUID NOT NULL, client_id UUID NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), revoked_at TIMESTAMPTZ, UNIQUE(principal_id, tenant_id, client_id));
CREATE TABLE IF NOT EXISTS portal_magic_links (id UUID PRIMARY KEY, principal_id UUID NOT NULL REFERENCES portal_principals(id) ON DELETE CASCADE, token_hash CHAR(64) NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, consumed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS portal_legacy_link_consumptions (token_hash CHAR(64) PRIMARY KEY, expires_at TIMESTAMPTZ NOT NULL, consumed_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS portal_sessions (id UUID PRIMARY KEY, principal_id UUID NOT NULL REFERENCES portal_principals(id) ON DELETE CASCADE, selected_membership_id UUID NOT NULL REFERENCES portal_memberships(id), token_hash CHAR(64) NOT NULL UNIQUE, csrf_hash CHAR(64), expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE portal_sessions ADD COLUMN IF NOT EXISTS csrf_hash CHAR(64);
CREATE INDEX IF NOT EXISTS portal_memberships_active_idx ON portal_memberships(principal_id, tenant_id, client_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS portal_sessions_active_idx ON portal_sessions(token_hash, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS portal_magic_links_active_idx ON portal_magic_links(token_hash, expires_at) WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS invoices_portal_history_idx ON invoices(tenant_id, client_id, invoice_date DESC, created_at DESC) WHERE status NOT IN ('draft','void');
