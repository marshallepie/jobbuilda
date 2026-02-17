-- Create update_updated_at_column function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  company VARCHAR(255),
  notes TEXT,
  gdpr_consent BOOLEAN NOT NULL DEFAULT false,
  gdpr_consent_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create sites table
CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address_line1 VARCHAR(255) NOT NULL,
  address_line2 VARCHAR(255),
  city VARCHAR(100) NOT NULL,
  county VARCHAR(100),
  postcode VARCHAR(20) NOT NULL,
  country VARCHAR(100) DEFAULT 'United Kingdom',
  access_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create contact_history table for tracking communications
CREATE TABLE IF NOT EXISTS contact_history (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  contact_type VARCHAR(50) NOT NULL,
  subject VARCHAR(255),
  notes TEXT,
  contacted_by UUID NOT NULL,
  contacted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT contact_history_type_check CHECK (contact_type IN ('phone', 'email', 'meeting', 'site_visit', 'other'))
);

-- Create indexes for clients
CREATE INDEX IF NOT EXISTS idx_clients_tenant_id ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_company ON clients(company);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at DESC);

-- Create indexes for sites
CREATE INDEX IF NOT EXISTS idx_sites_tenant_id ON sites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sites_client_id ON sites(client_id);
CREATE INDEX IF NOT EXISTS idx_sites_postcode ON sites(postcode);
CREATE INDEX IF NOT EXISTS idx_sites_city ON sites(city);

-- Create indexes for contact_history
CREATE INDEX IF NOT EXISTS idx_contact_history_tenant_id ON contact_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contact_history_client_id ON contact_history(client_id);
CREATE INDEX IF NOT EXISTS idx_contact_history_contacted_at ON contact_history(contacted_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_history_type ON contact_history(contact_type);

-- Add updated_at triggers (use DROP IF EXISTS for idempotency)
DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sites_updated_at ON sites;
CREATE TRIGGER update_sites_updated_at
  BEFORE UPDATE ON sites
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
