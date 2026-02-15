-- Migration: Add business profile fields to tenants table
-- This adds all the fields needed for company details, invoicing, and branding

-- Add business profile columns to tenants table
ALTER TABLE tenants
  -- Basic company info
  ADD COLUMN trading_name VARCHAR(255),
  ADD COLUMN company_number VARCHAR(50),
  ADD COLUMN vat_number VARCHAR(50),

  -- Address
  ADD COLUMN address_line1 VARCHAR(255),
  ADD COLUMN address_line2 VARCHAR(255),
  ADD COLUMN city VARCHAR(100),
  ADD COLUMN county VARCHAR(100),
  ADD COLUMN postcode VARCHAR(20),
  ADD COLUMN country VARCHAR(100) DEFAULT 'United Kingdom',

  -- Contact details
  ADD COLUMN phone VARCHAR(50),
  ADD COLUMN email VARCHAR(255),
  ADD COLUMN website VARCHAR(255),

  -- Invoice/Quote numbering
  ADD COLUMN invoice_prefix VARCHAR(10) DEFAULT 'INV',
  ADD COLUMN next_invoice_number INTEGER DEFAULT 1000,
  ADD COLUMN quote_prefix VARCHAR(10) DEFAULT 'QUO',
  ADD COLUMN next_quote_number INTEGER DEFAULT 1000,

  -- Banking details (for invoices)
  ADD COLUMN bank_name VARCHAR(100),
  ADD COLUMN account_name VARCHAR(100),
  ADD COLUMN sort_code VARCHAR(20),
  ADD COLUMN account_number VARCHAR(20),

  -- Payment terms
  ADD COLUMN payment_terms TEXT DEFAULT 'Payment due within 30 days of invoice date',
  ADD COLUMN default_vat_rate DECIMAL(5,2) DEFAULT 20.00,

  -- Branding
  ADD COLUMN logo_url TEXT,
  ADD COLUMN primary_color VARCHAR(7) DEFAULT '#3B82F6';

-- Add indexes for commonly queried fields
CREATE INDEX idx_tenants_vat_number ON tenants(vat_number) WHERE vat_number IS NOT NULL;
CREATE INDEX idx_tenants_company_number ON tenants(company_number) WHERE company_number IS NOT NULL;

-- Add check constraints
ALTER TABLE tenants
  ADD CONSTRAINT valid_vat_rate CHECK (default_vat_rate >= 0 AND default_vat_rate <= 100),
  ADD CONSTRAINT valid_color_hex CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$');

-- Comment on table
COMMENT ON COLUMN tenants.trading_name IS 'Trading name if different from legal name';
COMMENT ON COLUMN tenants.company_number IS 'Companies House registration number';
COMMENT ON COLUMN tenants.vat_number IS 'VAT registration number (GB format)';
COMMENT ON COLUMN tenants.invoice_prefix IS 'Prefix for invoice numbers (e.g., INV, INVOICE)';
COMMENT ON COLUMN tenants.next_invoice_number IS 'Next available invoice number';
COMMENT ON COLUMN tenants.quote_prefix IS 'Prefix for quote numbers (e.g., QUO, QUOTE)';
COMMENT ON COLUMN tenants.next_quote_number IS 'Next available quote number';
COMMENT ON COLUMN tenants.default_vat_rate IS 'Default VAT rate as percentage (e.g., 20.00 for 20%)';
COMMENT ON COLUMN tenants.primary_color IS 'Primary brand color as hex code (e.g., #3B82F6)';
