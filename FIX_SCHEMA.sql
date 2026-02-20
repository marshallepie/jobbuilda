-- ===================================================================
-- Schema Fixes - Add Missing Columns
-- ===================================================================
-- Run this in Supabase SQL Editor to fix schema issues
-- Date: 2026-02-20
-- ===================================================================

-- Fix 1: Add missing timestamp columns to quotes table
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Fix 2: Verify invoices table has invoice_date (should already exist)
-- If missing, add it:
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_date DATE;

-- Fix 3: Verify leads table has name column (should already exist)
-- If missing, add it:
ALTER TABLE leads ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Fix 4: Add any other missing quote migrations
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS labor_hours NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS job_id UUID;

-- Create index on job_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_quotes_job_id ON quotes(job_id);

-- Verify the fixes
SELECT 'Quotes columns:' as check_type, column_name
FROM information_schema.columns
WHERE table_name = 'quotes' AND column_name IN ('rejected_at', 'sent_at', 'approved_at', 'labor_hours', 'job_id')
UNION ALL
SELECT 'Invoices columns:', column_name
FROM information_schema.columns
WHERE table_name = 'invoices' AND column_name = 'invoice_date'
UNION ALL
SELECT 'Leads columns:', column_name
FROM information_schema.columns
WHERE table_name = 'leads' AND column_name = 'name';
