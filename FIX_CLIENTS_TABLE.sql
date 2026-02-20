-- ===================================================================
-- Fix Missing Columns in Clients Table
-- ===================================================================
-- This adds columns that were missing from MASTER_MIGRATION.sql
-- but are required by the clients-mcp code
-- ===================================================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS company VARCHAR(255),
  ADD COLUMN IF NOT EXISTS mobile VARCHAR(50),
  ADD COLUMN IF NOT EXISTS gdpr_consent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gdpr_consent_date TIMESTAMPTZ;

-- Add missing indexes
CREATE INDEX IF NOT EXISTS idx_clients_company ON clients(company);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);

-- Verify the fix
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'clients'
ORDER BY ordinal_position;
