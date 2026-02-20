-- ===================================================================
-- JobBuilda Master Migration Script
-- ===================================================================
-- Run this in Supabase SQL Editor to set up all database tables
-- Date: 2026-02-20
-- ===================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search

-- ===================================================================
-- SECTION 1: IDENTITY SERVICE
-- Core tables for authentication, tenants, and users
-- ===================================================================

-- Tenants table (core multi-tenancy)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  plan VARCHAR(50) NOT NULL CHECK (plan IN ('trial', 'standard', 'premium')),

  -- Business profile (migration 2)
  trading_name VARCHAR(255),
  company_number VARCHAR(50),
  vat_number VARCHAR(50),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  county VARCHAR(100),
  postcode VARCHAR(20),
  country VARCHAR(100) DEFAULT 'United Kingdom',
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(255),

  -- Invoice/Quote numbering
  invoice_prefix VARCHAR(10) DEFAULT 'INV',
  next_invoice_number INTEGER DEFAULT 1000,
  quote_prefix VARCHAR(10) DEFAULT 'QUO',
  next_quote_number INTEGER DEFAULT 1000,

  -- Banking details
  bank_name VARCHAR(100),
  account_name VARCHAR(100),
  sort_code VARCHAR(20),
  account_number VARCHAR(20),
  payment_terms TEXT DEFAULT 'Payment due within 30 days of invoice date',
  default_vat_rate DECIMAL(5,2) DEFAULT 20.00,

  -- Branding
  logo_url TEXT,
  primary_color VARCHAR(7) DEFAULT '#3B82F6',

  -- Template settings (migration 3)
  invoice_template_id VARCHAR(50) DEFAULT 'modern',
  quote_template_id VARCHAR(50) DEFAULT 'modern',
  template_font VARCHAR(50) DEFAULT 'Inter',
  show_payment_qr BOOLEAN DEFAULT false,
  show_item_codes BOOLEAN DEFAULT true,
  show_item_descriptions BOOLEAN DEFAULT true,
  footer_text TEXT,
  header_image_url TEXT,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_name ON tenants(name);
CREATE INDEX IF NOT EXISTS idx_tenants_vat_number ON tenants(vat_number) WHERE vat_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_company_number ON tenants(company_number) WHERE company_number IS NOT NULL;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'technician', 'client')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, scope)
);

CREATE INDEX IF NOT EXISTS idx_permissions_user_id ON permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_permissions_scope ON permissions(scope);

-- Event outbox table
CREATE TABLE IF NOT EXISTS event_outbox (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(255) NOT NULL,
  tenant_id UUID NOT NULL,
  payload JSONB NOT NULL,
  published_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_outbox_unpublished ON event_outbox(created_at) WHERE published_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_event_outbox_tenant_id ON event_outbox(tenant_id);

-- ===================================================================
-- SECTION 2: CLIENTS SERVICE
-- Client and site management
-- ===================================================================

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  county VARCHAR(100),
  postcode VARCHAR(20),
  country VARCHAR(100) DEFAULT 'United Kingdom',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_tenant_id ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);

CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name VARCHAR(255),
  address_line1 VARCHAR(255) NOT NULL,
  address_line2 VARCHAR(255),
  city VARCHAR(100) NOT NULL,
  county VARCHAR(100),
  postcode VARCHAR(20) NOT NULL,
  country VARCHAR(100) DEFAULT 'United Kingdom',
  access_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sites_tenant_id ON sites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sites_client_id ON sites(client_id);

-- ===================================================================
-- SECTION 3: QUOTING SERVICE
-- Leads, quotes, and quote line items
-- ===================================================================

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  source VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'quoted', 'won', 'lost')),
  description TEXT,
  estimated_value DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_client_id ON leads(client_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quote_number VARCHAR(50) NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'approved', 'rejected', 'expired')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  subtotal_ex_vat DECIMAL(10,2) NOT NULL DEFAULT 0,
  vat_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_inc_vat DECIMAL(10,2) NOT NULL DEFAULT 0,
  valid_until DATE,
  notes TEXT,
  terms TEXT,
  job_id UUID,
  labor_hours DECIMAL(10,2),
  sent_at TIMESTAMP,
  viewed_at TIMESTAMP,
  approved_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, quote_number)
);

CREATE INDEX IF NOT EXISTS idx_quotes_tenant_id ON quotes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotes_client_id ON quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_job_id ON quotes(job_id);

CREATE TABLE IF NOT EXISTS quote_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('material', 'labor', 'custom')),
  description VARCHAR(500) NOT NULL,
  sku VARCHAR(100),
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(50),
  unit_price_ex_vat DECIMAL(10,2) NOT NULL,
  vat_rate DECIMAL(5,2) NOT NULL DEFAULT 20.00,
  line_total_ex_vat DECIMAL(10,2) NOT NULL,
  line_vat_amount DECIMAL(10,2) NOT NULL,
  line_total_inc_vat DECIMAL(10,2) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quote_items(quote_id);

-- ===================================================================
-- SECTION 4: JOBS SERVICE
-- Job tracking, time entries, and materials used
-- ===================================================================

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_number VARCHAR(50) NOT NULL,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'on_hold', 'completed', 'cancelled')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  scheduled_start DATE,
  scheduled_end DATE,
  actual_start TIMESTAMP,
  actual_end TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, job_number)
);

CREATE INDEX IF NOT EXISTS idx_jobs_tenant_id ON jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_quote_id ON jobs(quote_id);

CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  duration_hours DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_job_id ON time_entries(job_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);

CREATE TABLE IF NOT EXISTS job_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  sku VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(50),
  scanned_at TIMESTAMP NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_job_materials_job_id ON job_materials(job_id);

-- ===================================================================
-- SECTION 5: INVOICING SERVICE
-- Invoices and invoice line items
-- ===================================================================

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) NOT NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled')),
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  subtotal_ex_vat DECIMAL(10,2) NOT NULL DEFAULT 0,
  vat_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_inc_vat DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  payment_terms TEXT,
  sent_at TIMESTAMP,
  paid_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_job_id ON invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description VARCHAR(500) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_price_ex_vat DECIMAL(10,2) NOT NULL,
  vat_rate DECIMAL(5,2) NOT NULL DEFAULT 20.00,
  line_total_ex_vat DECIMAL(10,2) NOT NULL,
  line_vat_amount DECIMAL(10,2) NOT NULL,
  line_total_inc_vat DECIMAL(10,2) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- ===================================================================
-- SECTION 6: PAYMENTS SERVICE
-- Payment transactions and Stripe integration
-- ===================================================================

CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  stripe_payment_intent_id VARCHAR(255),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'GBP',
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'cancelled')),
  payment_method VARCHAR(50),
  paid_at TIMESTAMP,
  failure_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_tenant_id ON payment_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_invoice_id ON payment_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_stripe_id ON payment_transactions(stripe_payment_intent_id);

-- ===================================================================
-- SECTION 7: SUPPORTING TABLES
-- Materials, variations, tests, suppliers, reporting
-- ===================================================================

-- Materials (inventory/catalog)
CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sku VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  unit VARCHAR(50) NOT NULL DEFAULT 'each',
  cost_price DECIMAL(10,2),
  sell_price DECIMAL(10,2),
  vat_rate DECIMAL(5,2) DEFAULT 20.00,
  supplier VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_materials_tenant_id ON materials(tenant_id);
CREATE INDEX IF NOT EXISTS idx_materials_sku ON materials(sku);

-- Job variations
CREATE TABLE IF NOT EXISTS variations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  variation_number VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  amount_ex_vat DECIMAL(10,2) NOT NULL,
  vat_amount DECIMAL(10,2) NOT NULL,
  total_inc_vat DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMP,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_variations_job_id ON variations(job_id);

-- Compliance tests
CREATE TABLE IF NOT EXISTS tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  test_type VARCHAR(100) NOT NULL,
  test_standard VARCHAR(100),
  result VARCHAR(50) NOT NULL CHECK (result IN ('pass', 'fail', 'advisory')),
  tested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  tested_at TIMESTAMP NOT NULL DEFAULT NOW(),
  certificate_url TEXT,
  notes TEXT,
  test_data JSONB
);

CREATE INDEX IF NOT EXISTS idx_tests_job_id ON tests(job_id);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  account_number VARCHAR(100),
  contact_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  website VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_id ON suppliers(tenant_id);

-- ===================================================================
-- TRIGGERS
-- Auto-update timestamps
-- ===================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON sites FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON materials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================================================================
-- SEED DATA
-- Create a default test tenant for development
-- ===================================================================

-- Insert test tenant (only if not exists)
INSERT INTO tenants (id, name, plan, trading_name, email, phone, country, primary_color)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Test Electrical Ltd',
  'trial',
  'Test Electrical',
  'test@testelectrical.co.uk',
  '01234 567890',
  'United Kingdom',
  '#3B82F6'
)
ON CONFLICT (id) DO NOTHING;

-- ===================================================================
-- COMPLETION
-- ===================================================================

SELECT 'Migration completed successfully!' AS status;
SELECT 'Tables created: ' || COUNT(*) || ' tables' AS info
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
