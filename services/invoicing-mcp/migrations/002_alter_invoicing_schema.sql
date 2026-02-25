-- ============================================================
-- Migration 002: Patch invoices schema to match v2 requirements
-- Fully defensive — safe to run regardless of which prior
-- migration was applied.
-- ============================================================

-- 1. Add any missing columns (all IF NOT EXISTS, nullable unless noted)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type      VARCHAR(50) NOT NULL DEFAULT 'final';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS job_id            UUID;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS site_id           UUID;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_invoice_id VARCHAR(255);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pdf_url           TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER DEFAULT 30;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_at           TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at           TIMESTAMPTZ;

-- 2. Drop NOT NULL on job_id only if it currently exists as NOT NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'invoices'
      AND column_name  = 'job_id'
      AND is_nullable  = 'NO'
  ) THEN
    ALTER TABLE invoices ALTER COLUMN job_id DROP NOT NULL;
  END IF;
END $$;

-- 3. Drop NOT NULL on site_id only if it currently exists as NOT NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'invoices'
      AND column_name  = 'site_id'
      AND is_nullable  = 'NO'
  ) THEN
    ALTER TABLE invoices ALTER COLUMN site_id DROP NOT NULL;
  END IF;
END $$;

-- 4. Add invoice_type CHECK constraint if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'invoices_type_check'
      AND table_name      = 'invoices'
      AND table_schema    = 'public'
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT invoices_type_check
        CHECK (invoice_type IN ('deposit', 'progress', 'final', 'credit_note'));
  END IF;
END $$;

-- 5. Add status CHECK constraint if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'invoices_status_check'
      AND table_name      = 'invoices'
      AND table_schema    = 'public'
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT invoices_status_check
        CHECK (status IN ('draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled', 'void'));
  END IF;
END $$;

-- 6. Swap global UNIQUE on invoice_number for per-tenant unique
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'invoices_invoice_number_key'
      AND table_name      = 'invoices'
      AND table_schema    = 'public'
  ) THEN
    ALTER TABLE invoices DROP CONSTRAINT invoices_invoice_number_key;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'invoices_tenant_number_unique'
      AND table_name      = 'invoices'
      AND table_schema    = 'public'
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT invoices_tenant_number_unique UNIQUE (tenant_id, invoice_number);
  END IF;
END $$;

-- 7. Create invoice_payments table if it doesn't exist
CREATE TABLE IF NOT EXISTS invoice_payments (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL,
  invoice_id             UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  payment_transaction_id UUID,
  amount                 NUMERIC(10, 2) NOT NULL,
  payment_date           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payment_method         VARCHAR(50),
  reference              VARCHAR(255),
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Indexes (all safe to run multiple times)
CREATE INDEX IF NOT EXISTS idx_invoices_type                    ON invoices(invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date_v2             ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_tenant_id       ON invoice_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id      ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_transaction_id  ON invoice_payments(payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_payment_date    ON invoice_payments(payment_date DESC);

-- 9. generate_invoice_number (explicit UUID param — fixes unknown-type error)
CREATE OR REPLACE FUNCTION generate_invoice_number(p_tenant_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
  date_str VARCHAR(8);
  cnt      INTEGER;
BEGIN
  date_str := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  SELECT COUNT(*) + 1 INTO cnt
  FROM invoices
  WHERE tenant_id = p_tenant_id
    AND invoice_number LIKE 'INV-' || date_str || '-%';
  RETURN 'INV-' || date_str || '-' || LPAD(cnt::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- 10. update_updated_at helper
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Recalculate invoice totals from line items
CREATE OR REPLACE FUNCTION recalculate_invoice_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE invoices
  SET
    subtotal_ex_vat = COALESCE((
      SELECT SUM(line_total_ex_vat) FROM invoice_items
      WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
    ), 0),
    vat_amount = COALESCE((
      SELECT SUM(line_vat) FROM invoice_items
      WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
    ), 0),
    total_inc_vat = COALESCE((
      SELECT SUM(line_total_inc_vat) FROM invoice_items
      WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
    ), 0),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 12. Update invoice amounts when payments are recorded
CREATE OR REPLACE FUNCTION update_invoice_payment_totals()
RETURNS TRIGGER AS $$
DECLARE
  total_paid    NUMERIC(10, 2);
  invoice_total NUMERIC(10, 2);
  new_status    VARCHAR(50);
BEGIN
  SELECT i.total_inc_vat, COALESCE(SUM(ip.amount), 0)
  INTO invoice_total, total_paid
  FROM invoices i
  LEFT JOIN invoice_payments ip ON ip.invoice_id = i.id
  WHERE i.id = COALESCE(NEW.invoice_id, OLD.invoice_id)
  GROUP BY i.total_inc_vat;

  IF total_paid >= invoice_total THEN
    new_status := 'paid';
  ELSIF total_paid > 0 THEN
    new_status := 'partial';
  ELSE
    new_status := 'sent';
  END IF;

  UPDATE invoices
  SET
    amount_paid = total_paid,
    amount_due  = invoice_total - total_paid,
    status      = new_status,
    paid_at     = CASE WHEN total_paid >= invoice_total THEN NOW() ELSE NULL END,
    updated_at  = NOW()
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 13. Drop and recreate triggers cleanly
DROP TRIGGER IF EXISTS recalculate_invoice_totals_on_insert    ON invoice_items;
DROP TRIGGER IF EXISTS recalculate_invoice_totals_on_update    ON invoice_items;
DROP TRIGGER IF EXISTS recalculate_invoice_totals_on_delete    ON invoice_items;
DROP TRIGGER IF EXISTS trigger_recalc_invoice_totals_insert    ON invoice_items;
DROP TRIGGER IF EXISTS trigger_recalc_invoice_totals_update    ON invoice_items;
DROP TRIGGER IF EXISTS trigger_recalc_invoice_totals_delete    ON invoice_items;
DROP TRIGGER IF EXISTS update_invoice_payments_on_insert       ON invoice_payments;
DROP TRIGGER IF EXISTS update_invoice_payments_on_delete       ON invoice_payments;
DROP TRIGGER IF EXISTS update_invoices_updated_at              ON invoices;
DROP TRIGGER IF EXISTS update_invoice_items_updated_at         ON invoice_items;
DROP TRIGGER IF EXISTS trigger_invoices_updated_at             ON invoices;
DROP TRIGGER IF EXISTS trigger_check_overdue                   ON invoices;

CREATE TRIGGER recalculate_invoice_totals_on_insert
  AFTER INSERT ON invoice_items FOR EACH ROW
  EXECUTE FUNCTION recalculate_invoice_totals();

CREATE TRIGGER recalculate_invoice_totals_on_update
  AFTER UPDATE ON invoice_items FOR EACH ROW
  EXECUTE FUNCTION recalculate_invoice_totals();

CREATE TRIGGER recalculate_invoice_totals_on_delete
  AFTER DELETE ON invoice_items FOR EACH ROW
  EXECUTE FUNCTION recalculate_invoice_totals();

CREATE TRIGGER update_invoice_payments_on_insert
  AFTER INSERT ON invoice_payments FOR EACH ROW
  EXECUTE FUNCTION update_invoice_payment_totals();

CREATE TRIGGER update_invoice_payments_on_delete
  AFTER DELETE ON invoice_payments FOR EACH ROW
  EXECUTE FUNCTION update_invoice_payment_totals();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoice_items_updated_at
  BEFORE UPDATE ON invoice_items FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Check overdue on read/update
CREATE OR REPLACE FUNCTION check_invoice_overdue()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.due_date < CURRENT_DATE AND NEW.status = 'sent' AND NEW.amount_due > 0 THEN
    NEW.status := 'overdue';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_overdue
  BEFORE UPDATE ON invoices FOR EACH ROW
  EXECUTE FUNCTION check_invoice_overdue();
