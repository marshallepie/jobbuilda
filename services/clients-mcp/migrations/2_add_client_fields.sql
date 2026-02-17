-- Add missing fields to clients table
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS mobile VARCHAR(50),
  ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address_line2 VARCHAR(255),
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS county VARCHAR(100),
  ADD COLUMN IF NOT EXISTS postcode VARCHAR(20);

-- Add missing fields to sites table
ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50);
