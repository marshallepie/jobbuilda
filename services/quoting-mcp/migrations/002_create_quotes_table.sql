-- Create quotes table
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  quote_number VARCHAR(50) NOT NULL,
  lead_id UUID,
  client_id UUID NOT NULL,
  site_id UUID,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  subtotal_ex_vat NUMERIC(10, 2) DEFAULT 0.00,
  vat_amount NUMERIC(10, 2) DEFAULT 0.00,
  total_inc_vat NUMERIC(10, 2) DEFAULT 0.00,
  valid_until DATE,
  terms TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT quotes_status_check CHECK (status IN ('draft', 'sent', 'viewed', 'approved', 'rejected', 'expired')),
  CONSTRAINT quotes_tenant_quote_number_unique UNIQUE (tenant_id, quote_number)
);

-- Create quote_items table
CREATE TABLE IF NOT EXISTS quote_items (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  item_type VARCHAR(50) NOT NULL,
  product_id UUID,
  sku VARCHAR(100),
  description TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL,
  unit VARCHAR(50) DEFAULT 'unit',
  unit_price_ex_vat NUMERIC(10, 2) NOT NULL,
  markup_percent NUMERIC(5, 2) DEFAULT 0.00,
  line_total_ex_vat NUMERIC(10, 2) NOT NULL,
  vat_rate NUMERIC(5, 2) DEFAULT 20.00,
  line_total_inc_vat NUMERIC(10, 2) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT quote_items_item_type_check CHECK (item_type IN ('material', 'labor', 'other'))
);

-- Create indexes for quotes
CREATE INDEX IF NOT EXISTS idx_quotes_tenant_id ON quotes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_client_id ON quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_quotes_lead_id ON quotes(lead_id);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON quotes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_valid_until ON quotes(valid_until);

-- Create indexes for quote_items
CREATE INDEX IF NOT EXISTS idx_quote_items_tenant_id ON quote_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_sort_order ON quote_items(quote_id, sort_order);

-- Add updated_at trigger for quotes
CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add updated_at trigger for quote_items
CREATE TRIGGER update_quote_items_updated_at
  BEFORE UPDATE ON quote_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to recalculate quote totals from line items
CREATE OR REPLACE FUNCTION recalculate_quote_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE quotes
  SET
    subtotal_ex_vat = COALESCE((
      SELECT SUM(line_total_ex_vat)
      FROM quote_items
      WHERE quote_id = COALESCE(NEW.quote_id, OLD.quote_id)
    ), 0),
    vat_amount = COALESCE((
      SELECT SUM(line_total_inc_vat - line_total_ex_vat)
      FROM quote_items
      WHERE quote_id = COALESCE(NEW.quote_id, OLD.quote_id)
    ), 0),
    total_inc_vat = COALESCE((
      SELECT SUM(line_total_inc_vat)
      FROM quote_items
      WHERE quote_id = COALESCE(NEW.quote_id, OLD.quote_id)
    ), 0),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.quote_id, OLD.quote_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalculate quote totals when items change
CREATE TRIGGER recalculate_quote_totals_on_insert
  AFTER INSERT ON quote_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_quote_totals();

CREATE TRIGGER recalculate_quote_totals_on_update
  AFTER UPDATE ON quote_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_quote_totals();

CREATE TRIGGER recalculate_quote_totals_on_delete
  AFTER DELETE ON quote_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_quote_totals();
