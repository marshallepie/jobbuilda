-- Enhance tests table with full BS 7671 compliance fields
-- This enables capturing all required metadata for electrical certificates

ALTER TABLE tests
ADD COLUMN IF NOT EXISTS premises_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS earthing_arrangements VARCHAR(100),
ADD COLUMN IF NOT EXISTS schedule_of_inspections JSONB,
ADD COLUMN IF NOT EXISTS inspector_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS inspector_registration_number VARCHAR(100);

-- Add check constraint for valid premises types
ALTER TABLE tests
ADD CONSTRAINT tests_premises_type_check
CHECK (premises_type IS NULL OR premises_type IN (
  'domestic',
  'commercial',
  'industrial'
));

-- Add check constraint for valid earthing arrangements
ALTER TABLE tests
ADD CONSTRAINT tests_earthing_arrangements_check
CHECK (earthing_arrangements IS NULL OR earthing_arrangements IN (
  'TN-S',    -- Separate protective earth
  'TN-C-S',  -- Combined protective earth and neutral (PME)
  'TT',      -- Earth electrode at installation
  'IT'       -- Isolated or impedance earthed
));

-- Add comments for documentation
COMMENT ON COLUMN tests.premises_type IS
  'Type of premises: domestic, commercial, industrial. Determines inspection frequency per BS 7671.';

COMMENT ON COLUMN tests.earthing_arrangements IS
  'Type of earthing system per BS 7671: TN-S, TN-C-S (PME), TT, or IT.';

COMMENT ON COLUMN tests.schedule_of_inspections IS
  'JSON object containing checklist of inspection items per BS 7671 Schedule of Inspections. Structure: {items: [{item: string, result: "pass"|"fail"|"n/a", notes: string}]}';

COMMENT ON COLUMN tests.inspector_name IS
  'Full name of the qualified electrician who performed the inspection.';

COMMENT ON COLUMN tests.inspector_registration_number IS
  'Professional registration number (e.g., NICEIC, NAPIT, ECA) of the inspector.';

-- Create indexes for filtering
CREATE INDEX IF NOT EXISTS idx_tests_premises_type
ON tests(premises_type)
WHERE premises_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tests_earthing
ON tests(earthing_arrangements)
WHERE earthing_arrangements IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tests_inspector
ON tests(inspector_name)
WHERE inspector_name IS NOT NULL;

-- Create index for next inspection date queries (expiry warnings)
CREATE INDEX IF NOT EXISTS idx_tests_next_inspection
ON tests(next_inspection_date)
WHERE next_inspection_date IS NOT NULL;
