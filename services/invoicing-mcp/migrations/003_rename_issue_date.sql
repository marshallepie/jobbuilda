-- ============================================================
-- Migration 003: Rename issue_date → invoice_date
-- The original production table was created with "issue_date"
-- instead of "invoice_date". All MCP code references invoice_date.
-- Fully defensive — safe to run regardless of current column names.
-- ============================================================

DO $$
BEGIN
  -- Case 1: old name exists, new name doesn't → rename
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices'
      AND column_name = 'issue_date'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices'
      AND column_name = 'invoice_date'
  ) THEN
    ALTER TABLE invoices RENAME COLUMN issue_date TO invoice_date;

  -- Case 2: neither exists → add it with a safe default
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices'
      AND column_name = 'invoice_date'
  ) THEN
    ALTER TABLE invoices ADD COLUMN invoice_date DATE NOT NULL DEFAULT CURRENT_DATE;

  -- Case 3: invoice_date already exists → nothing to do
  END IF;
END $$;
