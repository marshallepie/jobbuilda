-- Add premises classification fields to sites table
-- This enables BS 7671 compliance differences for domestic vs non-domestic premises

ALTER TABLE sites
ADD COLUMN IF NOT EXISTS premises_type VARCHAR(50) DEFAULT 'domestic',
ADD COLUMN IF NOT EXISTS landlord_notification_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS landlord_contact_email VARCHAR(255);

-- Add check constraint for valid premises types
ALTER TABLE sites
ADD CONSTRAINT sites_premises_type_check
CHECK (premises_type IN (
  'domestic',      -- Residential properties (10-year inspection cycle)
  'commercial',    -- Commercial premises (5-year inspection cycle)
  'industrial'     -- Industrial facilities (1-year inspection cycle)
));

-- Add email format validation for landlord contact
ALTER TABLE sites
ADD CONSTRAINT sites_landlord_email_format_check
CHECK (
  landlord_contact_email IS NULL OR
  landlord_contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
);

-- Add comments for documentation
COMMENT ON COLUMN sites.premises_type IS
  'Type of premises for BS 7671 compliance: domestic (10yr), commercial (5yr), industrial (1yr inspection cycles)';

COMMENT ON COLUMN sites.landlord_notification_required IS
  'Whether landlord must be notified of EICR results (legal requirement for rental properties)';

COMMENT ON COLUMN sites.landlord_contact_email IS
  'Email address for landlord notifications when EICR certificates are issued';

-- Create index for filtering by premises type
CREATE INDEX IF NOT EXISTS idx_sites_premises_type
ON sites(premises_type);

-- Create index for sites requiring landlord notification
CREATE INDEX IF NOT EXISTS idx_sites_landlord_notification
ON sites(landlord_notification_required)
WHERE landlord_notification_required = true;
