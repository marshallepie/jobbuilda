-- Create update_updated_at_column function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  invoice_number VARCHAR(50) NOT NULL,
  job_id UUID,
  client_id UUID NOT NULL,
  site_id UUID,
  invoice_type VARCHAR(50) NOT NULL DEFAULT 'final',
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  payment_terms_days INTEGER DEFAULT 30,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  subtotal_ex_vat NUMERIC(10, 2) DEFAULT 0.00,
  vat_amount NUMERIC(10, 2) DEFAULT 0.00,
  total_inc_vat NUMERIC(10, 2) DEFAULT 0.00,
  amount_paid NUMERIC(10, 2) DEFAULT 0.00,
  amount_due NUMERIC(10, 2) DEFAULT 0.00,
  notes TEXT,
  stripe_invoice_id VARCHAR(255),
  pdf_url TEXT,
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT invoices_type_check CHECK (invoice_type IN ('deposit', 'progress', 'final', 'credit_note')),
  CONSTRAINT invoices_status_check CHECK (status IN ('draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled', 'void')),
  CONSTRAINT invoices_tenant_number_unique UNIQUE (tenant_id, invoice_number)
);

-- Create invoice_items table
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  item_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL,
  unit VARCHAR(50) DEFAULT 'unit',
  unit_price_ex_vat NUMERIC(10, 2) NOT NULL,
  line_total_ex_vat NUMERIC(10, 2) NOT NULL,
  vat_rate NUMERIC(5, 2) DEFAULT 20.00,
  line_vat NUMERIC(10, 2) NOT NULL,
  line_total_inc_vat NUMERIC(10, 2) NOT NULL,
  job_item_id UUID,
  variation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT invoice_items_type_check CHECK (item_type IN ('labor', 'material', 'variation', 'other'))
);

-- Create invoice_payments table (tracks all payments against an invoice)
CREATE TABLE IF NOT EXISTS invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  payment_transaction_id UUID,
  amount NUMERIC(10, 2) NOT NULL,
  payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payment_method VARCHAR(50),
  reference VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for invoices
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_job_id ON invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);

-- Create indexes for invoice_items
CREATE INDEX IF NOT EXISTS idx_invoice_items_tenant_id ON invoice_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_job_item_id ON invoice_items(job_item_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_variation_id ON invoice_items(variation_id);

-- Create indexes for invoice_payments
CREATE INDEX IF NOT EXISTS idx_invoice_payments_tenant_id ON invoice_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_transaction_id ON invoice_payments(payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_payment_date ON invoice_payments(payment_date DESC);

-- Add updated_at triggers
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoice_items_updated_at
  BEFORE UPDATE ON invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to recalculate invoice totals from line items
CREATE OR REPLACE FUNCTION recalculate_invoice_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE invoices
  SET
    subtotal_ex_vat = COALESCE((
      SELECT SUM(line_total_ex_vat)
      FROM invoice_items
      WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
    ), 0),
    vat_amount = COALESCE((
      SELECT SUM(line_vat)
      FROM invoice_items
      WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
    ), 0),
    total_inc_vat = COALESCE((
      SELECT SUM(line_total_inc_vat)
      FROM invoice_items
      WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
    ), 0),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers to recalculate invoice totals when items change
CREATE TRIGGER recalculate_invoice_totals_on_insert
  AFTER INSERT ON invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_invoice_totals();

CREATE TRIGGER recalculate_invoice_totals_on_update
  AFTER UPDATE ON invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_invoice_totals();

CREATE TRIGGER recalculate_invoice_totals_on_delete
  AFTER DELETE ON invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_invoice_totals();

-- Function to update invoice amounts when payments are recorded
CREATE OR REPLACE FUNCTION update_invoice_payment_totals()
RETURNS TRIGGER AS $$
DECLARE
  total_paid NUMERIC(10, 2);
  invoice_total NUMERIC(10, 2);
  new_status VARCHAR(50);
BEGIN
  -- Get invoice total and sum of all payments
  SELECT
    i.total_inc_vat,
    COALESCE(SUM(ip.amount), 0)
  INTO invoice_total, total_paid
  FROM invoices i
  LEFT JOIN invoice_payments ip ON ip.invoice_id = i.id
  WHERE i.id = COALESCE(NEW.invoice_id, OLD.invoice_id)
  GROUP BY i.total_inc_vat;

  -- Determine new status
  IF total_paid >= invoice_total THEN
    new_status := 'paid';
  ELSIF total_paid > 0 THEN
    new_status := 'partial';
  ELSE
    new_status := 'sent';
  END IF;

  -- Update invoice
  UPDATE invoices
  SET
    amount_paid = total_paid,
    amount_due = invoice_total - total_paid,
    status = new_status,
    paid_at = CASE WHEN total_paid >= invoice_total THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers to update invoice payment totals
CREATE TRIGGER update_invoice_payments_on_insert
  AFTER INSERT ON invoice_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_payment_totals();

CREATE TRIGGER update_invoice_payments_on_delete
  AFTER DELETE ON invoice_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_payment_totals();

-- Function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number(p_tenant_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
  date_str VARCHAR(8);
  count INTEGER;
  invoice_number VARCHAR(50);
BEGIN
  date_str := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

  SELECT COUNT(*) + 1 INTO count
  FROM invoices
  WHERE invoices.tenant_id = p_tenant_id
  AND invoices.invoice_number LIKE 'INV-' || date_str || '-%';

  invoice_number := 'INV-' || date_str || '-' || LPAD(count::TEXT, 3, '0');

  RETURN invoice_number;
END;
$$ LANGUAGE plpgsql;
