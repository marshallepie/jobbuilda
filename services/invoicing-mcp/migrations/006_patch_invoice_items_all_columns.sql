-- ============================================================
-- Migration 006: Add ALL remaining missing columns to invoice_items
-- Adds every column the MCP INSERT references. Safe to run
-- repeatedly — all statements use IF NOT EXISTS / defaults.
-- ============================================================

-- Core columns the INSERT requires
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS item_type          VARCHAR(50)    NOT NULL DEFAULT 'other';
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS description        TEXT           NOT NULL DEFAULT '';
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS quantity           NUMERIC(10,2)  NOT NULL DEFAULT 1;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS unit               VARCHAR(50)             DEFAULT 'unit';
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS unit_price_ex_vat  NUMERIC(10,2)  NOT NULL DEFAULT 0;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS line_total_ex_vat  NUMERIC(10,2)  NOT NULL DEFAULT 0;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS vat_rate           NUMERIC(5,2)            DEFAULT 20.00;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS line_vat           NUMERIC(10,2)  NOT NULL DEFAULT 0;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS line_total_inc_vat NUMERIC(10,2)  NOT NULL DEFAULT 0;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS job_item_id        UUID;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS variation_id       UUID;

-- Add item_type CHECK constraint if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'invoice_items_type_check'
      AND table_name = 'invoice_items'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE invoice_items
      ADD CONSTRAINT invoice_items_type_check
        CHECK (item_type IN ('labor', 'material', 'variation', 'other'));
  END IF;
END $$;
