-- ============================================================
-- Migration 004: Ensure invoice_date is correct, retire issue_date
-- Migration 003's rename was skipped because invoice_date already
-- existed (so the AND NOT EXISTS condition was false), leaving
-- issue_date as NOT NULL and blocking every insert.
-- ============================================================

-- Step 1: Drop NOT NULL from issue_date so it stops blocking inserts.
-- Using DO $$ so the ALTER is skipped silently if the column doesn't exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices'
      AND column_name = 'issue_date'
  ) THEN
    ALTER TABLE invoices ALTER COLUMN issue_date DROP NOT NULL;
  END IF;
END $$;

-- Step 2: Ensure invoice_date column exists.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_date DATE;

-- Step 3: Backfill invoice_date from issue_date where empty.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices'
      AND column_name = 'issue_date'
  ) THEN
    UPDATE invoices SET invoice_date = issue_date
    WHERE invoice_date IS NULL AND issue_date IS NOT NULL;
  END IF;
END $$;

-- Step 4: Fill any remaining NULLs with today's date, then make NOT NULL.
UPDATE invoices SET invoice_date = CURRENT_DATE WHERE invoice_date IS NULL;
ALTER TABLE invoices ALTER COLUMN invoice_date SET NOT NULL;
ALTER TABLE invoices ALTER COLUMN invoice_date SET DEFAULT CURRENT_DATE;
