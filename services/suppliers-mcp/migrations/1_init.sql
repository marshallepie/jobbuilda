-- Suppliers MCP Server - Initial Schema
-- Creates tables for suppliers, products, and pricing

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Suppliers table
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  website VARCHAR(255),
  account_number VARCHAR(100),
  payment_terms VARCHAR(100),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_suppliers_tenant_id ON suppliers(tenant_id);
CREATE INDEX idx_suppliers_name ON suppliers(name);
CREATE INDEX idx_suppliers_is_active ON suppliers(is_active);

-- Products table (supplier catalog items)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  sku VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  unit VARCHAR(50) DEFAULT 'unit',
  current_price_ex_vat DECIMAL(10, 2) NOT NULL,
  current_price_inc_vat DECIMAL(10, 2),
  vat_rate DECIMAL(5, 2) DEFAULT 20.00,
  last_price_update TIMESTAMP DEFAULT NOW(),
  is_available BOOLEAN DEFAULT true,
  lead_time_days INTEGER,
  minimum_order_quantity INTEGER DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, supplier_id, sku)
);

CREATE INDEX idx_products_tenant_id ON products(tenant_id);
CREATE INDEX idx_products_supplier_id ON products(supplier_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_is_available ON products(is_available);

-- Price history table (for tracking price changes)
CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price_ex_vat DECIMAL(10, 2) NOT NULL,
  price_inc_vat DECIMAL(10, 2),
  vat_rate DECIMAL(5, 2),
  changed_by UUID,
  changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  reason VARCHAR(255)
);

CREATE INDEX idx_price_history_product_id ON price_history(product_id);
CREATE INDEX idx_price_history_changed_at ON price_history(changed_at);

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

-- Apply updated_at trigger to suppliers
CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply updated_at trigger to products
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to log price changes in history
CREATE OR REPLACE FUNCTION log_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.current_price_ex_vat IS DISTINCT FROM NEW.current_price_ex_vat) THEN
    INSERT INTO price_history (tenant_id, product_id, price_ex_vat, price_inc_vat, vat_rate)
    VALUES (NEW.tenant_id, NEW.id, NEW.current_price_ex_vat, NEW.current_price_inc_vat, NEW.vat_rate);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_product_price_change
  AFTER UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION log_price_change();

-- Comments for documentation
COMMENT ON TABLE suppliers IS 'Supplier contact and account information';
COMMENT ON TABLE products IS 'Supplier catalog with current pricing';
COMMENT ON TABLE price_history IS 'Historical record of price changes for audit trail';
COMMENT ON TABLE event_outbox IS 'Outbox pattern for reliable event publishing to NATS';
