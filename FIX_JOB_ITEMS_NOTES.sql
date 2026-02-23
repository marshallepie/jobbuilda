-- Add missing notes column to job_items table
ALTER TABLE job_items ADD COLUMN IF NOT EXISTS notes TEXT;

-- Verify it was added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'job_items' AND column_name = 'notes';
