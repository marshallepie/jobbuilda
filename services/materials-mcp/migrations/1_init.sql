-- Materials MCP Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Materials catalog with inventory tracking
CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  sku VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  unit VARCHAR(50) NOT NULL, -- e.g., 'metre', 'unit', 'box', 'roll'
  unit_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  current_stock DECIMAL(10, 2) NOT NULL DEFAULT 0,
  min_stock_level DECIMAL(10, 2),
  reorder_quantity DECIMAL(10, 2),
  supplier_id UUID, -- Reference to suppliers-mcp
  supplier_sku VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, sku)
);

CREATE INDEX idx_materials_tenant ON materials(tenant_id);
CREATE INDEX idx_materials_category ON materials(tenant_id, category);
CREATE INDEX idx_materials_supplier ON materials(supplier_id);

-- Job material usage tracking (planned vs actual)
CREATE TABLE job_material_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  job_id UUID NOT NULL, -- Reference to jobs-mcp
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  quantity_planned DECIMAL(10, 2) NOT NULL DEFAULT 0,
  quantity_used DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(10, 2) NOT NULL, -- Cost at time of assignment
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, job_id, material_id)
);

CREATE INDEX idx_job_materials_tenant ON job_material_usage(tenant_id);
CREATE INDEX idx_job_materials_job ON job_material_usage(job_id);
CREATE INDEX idx_job_materials_material ON job_material_usage(material_id);

-- Material stock movements/transfers
CREATE TABLE material_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  transfer_type VARCHAR(50) NOT NULL, -- 'usage', 'purchase', 'adjustment', 'return'
  quantity DECIMAL(10, 2) NOT NULL, -- Positive for additions, negative for usage
  job_id UUID, -- If related to a job (usage or return)
  reference VARCHAR(255), -- PO number, invoice number, etc.
  notes TEXT,
  recorded_by UUID NOT NULL, -- User who recorded the transfer
  recorded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transfers_tenant ON material_transfers(tenant_id);
CREATE INDEX idx_transfers_material ON material_transfers(material_id);
CREATE INDEX idx_transfers_job ON material_transfers(job_id);
CREATE INDEX idx_transfers_date ON material_transfers(recorded_at);

-- Stock alerts for low inventory
CREATE TABLE stock_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL, -- 'low_stock', 'out_of_stock'
  current_stock DECIMAL(10, 2) NOT NULL,
  min_stock_level DECIMAL(10, 2) NOT NULL,
  triggered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_tenant ON stock_alerts(tenant_id);
CREATE INDEX idx_alerts_material ON stock_alerts(material_id);
CREATE INDEX idx_alerts_unresolved ON stock_alerts(tenant_id) WHERE resolved_at IS NULL;

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

-- Trigger: Update material stock on transfer
CREATE OR REPLACE FUNCTION update_material_stock()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE materials
  SET current_stock = current_stock + NEW.quantity,
      updated_at = NOW()
  WHERE id = NEW.material_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stock
AFTER INSERT ON material_transfers
FOR EACH ROW
EXECUTE FUNCTION update_material_stock();

-- Trigger: Check for low stock and create alerts
CREATE OR REPLACE FUNCTION check_low_stock()
RETURNS TRIGGER AS $$
DECLARE
  v_alert_exists BOOLEAN;
BEGIN
  IF NEW.min_stock_level IS NOT NULL AND NEW.current_stock <= NEW.min_stock_level THEN
    -- Check if there's already an unresolved alert
    SELECT EXISTS(
      SELECT 1 FROM stock_alerts
      WHERE material_id = NEW.id
        AND tenant_id = NEW.tenant_id
        AND resolved_at IS NULL
    ) INTO v_alert_exists;

    IF NOT v_alert_exists THEN
      INSERT INTO stock_alerts (tenant_id, material_id, alert_type, current_stock, min_stock_level)
      VALUES (
        NEW.tenant_id,
        NEW.id,
        CASE WHEN NEW.current_stock <= 0 THEN 'out_of_stock' ELSE 'low_stock' END,
        NEW.current_stock,
        NEW.min_stock_level
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_low_stock
AFTER UPDATE OF current_stock ON materials
FOR EACH ROW
EXECUTE FUNCTION check_low_stock();

-- Trigger: Auto-resolve stock alerts when stock is replenished
CREATE OR REPLACE FUNCTION resolve_stock_alerts()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_stock > OLD.current_stock AND NEW.min_stock_level IS NOT NULL THEN
    IF NEW.current_stock > NEW.min_stock_level THEN
      UPDATE stock_alerts
      SET resolved_at = NOW()
      WHERE material_id = NEW.id
        AND tenant_id = NEW.tenant_id
        AND resolved_at IS NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_resolve_alerts
AFTER UPDATE OF current_stock ON materials
FOR EACH ROW
WHEN (NEW.current_stock > OLD.current_stock)
EXECUTE FUNCTION resolve_stock_alerts();

-- Trigger: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_materials_updated_at
BEFORE UPDATE ON materials
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_job_materials_updated_at
BEFORE UPDATE ON job_material_usage
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();
