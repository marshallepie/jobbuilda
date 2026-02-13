-- Quoting MCP Server - Initial Schema
-- Creates tables for leads, quotes, and quote items

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Leads table (initial client inquiries)
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  client_id UUID,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  description TEXT,
  source VARCHAR(100),
  status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'quoted', 'won', 'lost')),
  assigned_to UUID,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leads_tenant_id ON leads(tenant_id);
CREATE INDEX idx_leads_client_id ON leads(client_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);

-- Quotes table
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  quote_number VARCHAR(50) NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  client_id UUID NOT NULL,
  site_id UUID,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'approved', 'rejected', 'expired')),
  subtotal_ex_vat DECIMAL(10, 2) DEFAULT 0,
  vat_amount DECIMAL(10, 2) DEFAULT 0,
  total_inc_vat DECIMAL(10, 2) DEFAULT 0,
  valid_until DATE,
  sent_at TIMESTAMP,
  viewed_at TIMESTAMP,
  approved_at TIMESTAMP,
  rejected_at TIMESTAMP,
  rejection_reason TEXT,
  terms TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, quote_number)
);

CREATE INDEX idx_quotes_tenant_id ON quotes(tenant_id);
CREATE INDEX idx_quotes_client_id ON quotes(client_id);
CREATE INDEX idx_quotes_site_id ON quotes(site_id);
CREATE INDEX idx_quotes_lead_id ON quotes(lead_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_quote_number ON quotes(quote_number);

-- Quote items (line items: materials, labor, other)
CREATE TABLE quote_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('material', 'labor', 'other')),
  product_id UUID,
  sku VARCHAR(100),
  description TEXT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  unit VARCHAR(50) DEFAULT 'unit',
  unit_price_ex_vat DECIMAL(10, 2) NOT NULL,
  markup_percent DECIMAL(5, 2) DEFAULT 0,
  line_total_ex_vat DECIMAL(10, 2) NOT NULL,
  vat_rate DECIMAL(5, 2) DEFAULT 20.00,
  line_total_inc_vat DECIMAL(10, 2) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quote_items_tenant_id ON quote_items(tenant_id);
CREATE INDEX idx_quote_items_quote_id ON quote_items(quote_id);
CREATE INDEX idx_quote_items_item_type ON quote_items(item_type);
CREATE INDEX idx_quote_items_product_id ON quote_items(product_id);

-- Event outbox table for reliable event publishing
CREATE TABLE event_outbox (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(255) NOT NULL,
  tenant_id UUID NOT NULL,
  payload JSONB NOT NULL,
  published_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_event_outbox_unpublished ON event_outbox(created_at) WHERE published_at IS NULL;
CREATE INDEX idx_event_outbox_tenant_id ON event_outbox(tenant_id);

-- Updated timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quote_items_updated_at
  BEFORE UPDATE ON quote_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to recalculate quote totals when items change
CREATE OR REPLACE FUNCTION recalculate_quote_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal DECIMAL(10, 2);
  v_total_inc_vat DECIMAL(10, 2);
  v_vat DECIMAL(10, 2);
BEGIN
  -- Get quote_id from NEW or OLD record
  IF TG_OP = 'DELETE' THEN
    -- Recalculate for the quote that lost an item
    SELECT
      COALESCE(SUM(line_total_ex_vat), 0),
      COALESCE(SUM(line_total_inc_vat), 0)
    INTO v_subtotal, v_total_inc_vat
    FROM quote_items
    WHERE quote_id = OLD.quote_id;

    v_vat := v_total_inc_vat - v_subtotal;

    UPDATE quotes
    SET subtotal_ex_vat = v_subtotal,
        vat_amount = v_vat,
        total_inc_vat = v_total_inc_vat
    WHERE id = OLD.quote_id;
  ELSE
    -- Recalculate for the quote that gained/modified an item
    SELECT
      COALESCE(SUM(line_total_ex_vat), 0),
      COALESCE(SUM(line_total_inc_vat), 0)
    INTO v_subtotal, v_total_inc_vat
    FROM quote_items
    WHERE quote_id = NEW.quote_id;

    v_vat := v_total_inc_vat - v_subtotal;

    UPDATE quotes
    SET subtotal_ex_vat = v_subtotal,
        vat_amount = v_vat,
        total_inc_vat = v_total_inc_vat
    WHERE id = NEW.quote_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recalculate_quote_totals_after_insert
  AFTER INSERT ON quote_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_quote_totals();

CREATE TRIGGER recalculate_quote_totals_after_update
  AFTER UPDATE ON quote_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_quote_totals();

CREATE TRIGGER recalculate_quote_totals_after_delete
  AFTER DELETE ON quote_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_quote_totals();

-- Comments for documentation
COMMENT ON TABLE leads IS 'Lead management - initial client inquiries before quote creation';
COMMENT ON TABLE quotes IS 'Quotes with approval workflow and expiry tracking';
COMMENT ON TABLE quote_items IS 'Quote line items - materials, labor, and other charges';
COMMENT ON TABLE event_outbox IS 'Outbox pattern for reliable event publishing to NATS';
