-- Variations MCP Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Job variations (scope changes)
CREATE TABLE variations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  variation_number VARCHAR(50) NOT NULL UNIQUE,
  job_id UUID NOT NULL, -- Reference to jobs-mcp
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  reason VARCHAR(100), -- 'client_request', 'site_conditions', 'design_change', 'compliance', 'other'
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'completed'
  subtotal_ex_vat DECIMAL(10, 2) NOT NULL DEFAULT 0,
  vat_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_inc_vat DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_by UUID NOT NULL, -- User who created the variation
  submitted_at TIMESTAMP,
  approved_at TIMESTAMP,
  approved_by UUID, -- User or client who approved
  rejected_at TIMESTAMP,
  rejected_by UUID,
  rejection_reason TEXT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_variations_tenant ON variations(tenant_id);
CREATE INDEX idx_variations_job ON variations(job_id);
CREATE INDEX idx_variations_status ON variations(status);
CREATE INDEX idx_variations_number ON variations(variation_number);

-- Variation line items
CREATE TABLE variation_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  variation_id UUID NOT NULL REFERENCES variations(id) ON DELETE CASCADE,
  item_type VARCHAR(50) NOT NULL, -- 'material', 'labor', 'other'
  description TEXT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  unit VARCHAR(50) NOT NULL DEFAULT 'unit',
  unit_price_ex_vat DECIMAL(10, 2) NOT NULL,
  line_total_ex_vat DECIMAL(10, 2) NOT NULL,
  vat_rate DECIMAL(5, 2) NOT NULL DEFAULT 20.00,
  line_vat DECIMAL(10, 2) NOT NULL,
  line_total_inc_vat DECIMAL(10, 2) NOT NULL,
  material_id UUID, -- Reference to materials-mcp if item_type = 'material'
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_variation_items_tenant ON variation_items(tenant_id);
CREATE INDEX idx_variation_items_variation ON variation_items(variation_id);
CREATE INDEX idx_variation_items_type ON variation_items(item_type);

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

-- Trigger: Recalculate variation totals when items change
CREATE OR REPLACE FUNCTION recalculate_variation_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal DECIMAL(10, 2);
  v_total_inc_vat DECIMAL(10, 2);
  v_vat DECIMAL(10, 2);
BEGIN
  SELECT
    COALESCE(SUM(line_total_ex_vat), 0),
    COALESCE(SUM(line_total_inc_vat), 0)
  INTO v_subtotal, v_total_inc_vat
  FROM variation_items
  WHERE variation_id = COALESCE(NEW.variation_id, OLD.variation_id);

  v_vat := v_total_inc_vat - v_subtotal;

  UPDATE variations
  SET subtotal_ex_vat = v_subtotal,
      vat_amount = v_vat,
      total_inc_vat = v_total_inc_vat,
      updated_at = NOW()
  WHERE id = COALESCE(NEW.variation_id, OLD.variation_id);

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_recalc_variation_totals_insert
AFTER INSERT ON variation_items
FOR EACH ROW
EXECUTE FUNCTION recalculate_variation_totals();

CREATE TRIGGER trigger_recalc_variation_totals_update
AFTER UPDATE ON variation_items
FOR EACH ROW
EXECUTE FUNCTION recalculate_variation_totals();

CREATE TRIGGER trigger_recalc_variation_totals_delete
AFTER DELETE ON variation_items
FOR EACH ROW
EXECUTE FUNCTION recalculate_variation_totals();

-- Trigger: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_variations_updated_at
BEFORE UPDATE ON variations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_variation_items_updated_at
BEFORE UPDATE ON variation_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Function to generate next variation number
CREATE OR REPLACE FUNCTION generate_variation_number(p_tenant_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  v_date_str VARCHAR(8);
  v_count INTEGER;
  v_number VARCHAR(50);
BEGIN
  v_date_str := TO_CHAR(NOW(), 'YYYYMMDD');

  SELECT COUNT(*) INTO v_count
  FROM variations
  WHERE tenant_id = p_tenant_id
    AND variation_number LIKE 'V-' || v_date_str || '-%';

  v_number := 'V-' || v_date_str || '-' || LPAD((v_count + 1)::TEXT, 3, '0');

  RETURN v_number;
END;
$$ LANGUAGE plpgsql;
