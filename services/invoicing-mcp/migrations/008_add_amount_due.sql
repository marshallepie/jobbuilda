-- ============================================================
-- Migration 008: Add amount_due to invoices
-- The check_invoice_overdue trigger (created in 002) references
-- NEW.amount_due, which doesn't exist in the original table.
-- ============================================================

-- Add column with default 0
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_due NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Backfill: amount_due = total_inc_vat - amount_paid for existing rows
UPDATE invoices SET amount_due = GREATEST(total_inc_vat - amount_paid, 0);
