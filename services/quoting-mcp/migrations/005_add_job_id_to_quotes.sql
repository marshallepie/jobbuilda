-- Add job_id column to quotes table for tracking job conversion
ALTER TABLE quotes
ADD COLUMN job_id UUID;

-- Create index for job lookups
CREATE INDEX IF NOT EXISTS idx_quotes_job_id ON quotes(job_id);

-- Add comment
COMMENT ON COLUMN quotes.job_id IS 'References the job created from this approved quote';
