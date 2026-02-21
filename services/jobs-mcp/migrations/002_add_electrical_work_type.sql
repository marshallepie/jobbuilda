-- Add electrical work classification fields to jobs table
-- This enables determining certificate type at job creation

ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS electrical_work_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS creates_new_circuits BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS circuit_details JSONB;

-- Add check constraint for valid electrical work types
ALTER TABLE jobs
ADD CONSTRAINT jobs_electrical_work_type_check
CHECK (electrical_work_type IS NULL OR electrical_work_type IN (
  'new_circuit',      -- New circuit installation (requires EIC)
  'minor_works',      -- Minor alterations (requires Minor Works Certificate)
  'alteration',       -- Alteration to existing installation
  'inspection_only'   -- Periodic inspection (EICR)
));

-- Add comment for documentation
COMMENT ON COLUMN jobs.electrical_work_type IS
  'Type of electrical work: new_circuit, minor_works, alteration, inspection_only. Determines certificate type required.';

COMMENT ON COLUMN jobs.creates_new_circuits IS
  'Whether this job involves creating new electrical circuits. True requires Electrical Installation Certificate (EIC).';

COMMENT ON COLUMN jobs.circuit_details IS
  'JSON array of circuit details: [{circuit_reference, location, overcurrent_device_type, overcurrent_device_rating}]';

-- Create index for filtering by electrical work type
CREATE INDEX IF NOT EXISTS idx_jobs_electrical_work_type
ON jobs(electrical_work_type)
WHERE electrical_work_type IS NOT NULL;
