-- ============================================================
-- Migration 005: Add all potentially missing columns to invoice_items
-- The production table was created by an early migration that predates
-- the current schema. Adds every column the MCP code references.
-- All statements are fully defensive (IF NOT EXISTS / DO $$).
-- ============================================================

-- 1. Add tenant_id (used in every INSERT — critical)
--    Add as nullable first, backfill from parent invoice, then add NOT NULL.
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS tenant_id UUID;

DO $$
BEGIN
  -- Backfill tenant_id from the parent invoice row
  UPDATE invoice_items ii
  SET tenant_id = i.tenant_id
  FROM invoices i
  WHERE ii.invoice_id = i.id
    AND ii.tenant_id IS NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoice_items'
      AND column_name = 'tenant_id' AND is_nullable = 'YES'
  ) THEN
    -- Only enforce NOT NULL if every row is now populated
    IF NOT EXISTS (SELECT 1 FROM invoice_items WHERE tenant_id IS NULL) THEN
      ALTER TABLE invoice_items ALTER COLUMN tenant_id SET NOT NULL;
    END IF;
  END IF;
END $$;

-- 2. Other potentially missing columns
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS job_item_id  UUID;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS variation_id UUID;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS unit         VARCHAR(50) DEFAULT 'unit';
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 3. Recreate the updated_at trigger for invoice_items if missing
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_invoice_items_updated_at'
      AND tgrelid = 'invoice_items'::regclass
  ) THEN
    CREATE TRIGGER update_invoice_items_updated_at
      BEFORE UPDATE ON invoice_items
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
