-- ============================================================
-- Migration 009: Add quote_id to invoices
-- Links invoices back to the originating quote so a running
-- balance can be computed: quote total − Σ(invoiced amounts).
-- No FK constraint to keep services loosely coupled for future
-- per-service database splits.
-- ============================================================

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS quote_id UUID;

CREATE INDEX IF NOT EXISTS idx_invoices_quote_id ON invoices(quote_id, tenant_id);
