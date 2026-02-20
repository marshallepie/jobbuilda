-- ===================================================================
-- Schema Fixes Part 2 - Add More Missing Columns
-- ===================================================================

-- Fix: Add email column to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Fix: Add created_by to various tables (used by dashboard)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by UUID;

-- Verify the fixes
SELECT 'Leads email:' as check_type, column_name
FROM information_schema.columns
WHERE table_name = 'leads' AND column_name = 'email'
UNION ALL
SELECT 'Quotes created_by:', column_name
FROM information_schema.columns
WHERE table_name = 'quotes' AND column_name = 'created_by'
UNION ALL
SELECT 'Jobs created_by:', column_name
FROM information_schema.columns
WHERE table_name = 'jobs' AND column_name = 'created_by'
UNION ALL
SELECT 'Invoices created_by:', column_name
FROM information_schema.columns
WHERE table_name = 'invoices' AND column_name = 'created_by';
