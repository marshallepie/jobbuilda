-- Invoicing MCP Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  job_id UUID NOT NULL, -- Reference to jobs-mcp
  client_id UUID NOT NULL, -- Reference to clients-mcp
  site_id UUID NOT NULL, -- Reference to clients-mcp
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft', 'sent', 'paid', 'overdue', 'cancelled'
  subtotal_ex_vat DECIMAL(10, 2) NOT NULL DEFAULT 0,
  vat_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_inc_vat DECIMAL(10, 2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(10, 2) NOT NULL DEFAULT 0,
  amount_due DECIMAL(10, 2) NOT NULL DEFAULT 0,
  payment_terms_days INTEGER NOT NULL DEFAULT 30,
  notes TEXT,
  storage_url TEXT, -- S3 URL for PDF
  sent_at TIMESTAMP,
  paid_at TIMESTAMP,
  created_by UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX idx_invoices_job ON invoices(job_id);
CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);

-- Invoice line items
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  item_type VARCHAR(50) NOT NULL, -- 'labor', 'material', 'variation', 'other'
  description TEXT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  unit VARCHAR(50) NOT NULL DEFAULT 'unit',
  unit_price_ex_vat DECIMAL(10, 2) NOT NULL,
  line_total_ex_vat DECIMAL(10, 2) NOT NULL,
  vat_rate DECIMAL(5, 2) NOT NULL DEFAULT 20.00,
  line_vat DECIMAL(10, 2) NOT NULL,
  line_total_inc_vat DECIMAL(10, 2) NOT NULL,
  job_item_id UUID, -- Reference to jobs-mcp job_items if applicable
  variation_id UUID, -- Reference to variations-mcp if applicable
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoice_items_tenant ON invoice_items(tenant_id);
CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_type ON invoice_items(item_type);

-- Event outbox for reliable event publishing
CREATE TABLE event_outbox (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(255) NOT NULL,
  tenant_id UUID NOT NULL,
  payload JSONB NOT NULL,
  published_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outbox_unpublished ON event_outbox(created_at) WHERE published_at IS NULL;

-- Trigger: Recalculate invoice totals when items change
CREATE OR REPLACE FUNCTION recalculate_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal DECIMAL(10, 2);
  v_total_inc_vat DECIMAL(10, 2);
  v_vat DECIMAL(10, 2);
  v_amount_paid DECIMAL(10, 2);
  v_amount_due DECIMAL(10, 2);
BEGIN
  SELECT
    COALESCE(SUM(line_total_ex_vat), 0),
    COALESCE(SUM(line_total_inc_vat), 0)
  INTO v_subtotal, v_total_inc_vat
  FROM invoice_items
  WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  v_vat := v_total_inc_vat - v_subtotal;

  -- Get current amount paid
  SELECT COALESCE(amount_paid, 0) INTO v_amount_paid
  FROM invoices
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  v_amount_due := v_total_inc_vat - v_amount_paid;

  UPDATE invoices
  SET subtotal_ex_vat = v_subtotal,
      vat_amount = v_vat,
      total_inc_vat = v_total_inc_vat,
      amount_due = v_amount_due,
      updated_at = NOW()
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_recalc_invoice_totals_insert
AFTER INSERT ON invoice_items
FOR EACH ROW
EXECUTE FUNCTION recalculate_invoice_totals();

CREATE TRIGGER trigger_recalc_invoice_totals_update
AFTER UPDATE ON invoice_items
FOR EACH ROW
EXECUTE FUNCTION recalculate_invoice_totals();

CREATE TRIGGER trigger_recalc_invoice_totals_delete
AFTER DELETE ON invoice_items
FOR EACH ROW
EXECUTE FUNCTION recalculate_invoice_totals();

-- Trigger: Update invoice status to overdue
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
BEFORE UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION check_invoice_overdue();

-- Trigger: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_invoices_updated_at
BEFORE UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Function to generate next invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number(p_tenant_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  v_date_str VARCHAR(8);
  v_count INTEGER;
  v_number VARCHAR(50);
BEGIN
  v_date_str := TO_CHAR(NOW(), 'YYYYMMDD');

  SELECT COUNT(*) INTO v_count
  FROM invoices
  WHERE tenant_id = p_tenant_id
    AND invoice_number LIKE 'INV-' || v_date_str || '-%';

  v_number := 'INV-' || v_date_str || '-' || LPAD((v_count + 1)::TEXT, 3, '0');

  RETURN v_number;
END;
$$ LANGUAGE plpgsql;
