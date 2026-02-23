-- ============================================
-- Jobs MCP Migrations - Run on Supabase
-- ============================================
-- This fixes the "job_items does not exist" error
-- Run this in Supabase SQL Editor
-- ============================================

-- Create job_items table
CREATE TABLE IF NOT EXISTS job_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  quote_item_id UUID,
  item_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  quantity_planned NUMERIC(10, 2) NOT NULL,
  quantity_used NUMERIC(10, 2) DEFAULT 0.00,
  unit VARCHAR(50) DEFAULT 'unit',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT job_items_item_type_check CHECK (item_type IN ('material', 'labor', 'other')),
  CONSTRAINT job_items_status_check CHECK (status IN ('pending', 'in_progress', 'completed'))
);

-- Create time_entries table for tracking hours
CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  hours NUMERIC(10, 2),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for job_items
CREATE INDEX IF NOT EXISTS idx_job_items_tenant_id ON job_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_job_items_job_id ON job_items(job_id);
CREATE INDEX IF NOT EXISTS idx_job_items_quote_item_id ON job_items(quote_item_id);
CREATE INDEX IF NOT EXISTS idx_job_items_status ON job_items(status);

-- Create indexes for time_entries
CREATE INDEX IF NOT EXISTS idx_time_entries_tenant_id ON time_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_job_id ON time_entries(job_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_start_time ON time_entries(start_time DESC);

-- Add updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_job_items_updated_at
  BEFORE UPDATE ON job_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_time_entries_updated_at
  BEFORE UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Add comments
COMMENT ON TABLE job_items IS 'Planned work items from quote (materials, labor, other)';
COMMENT ON TABLE time_entries IS 'Time tracking entries for jobs';

-- Verify tables were created
SELECT 'job_items table created' as status WHERE EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'job_items'
);

SELECT 'time_entries table created' as status WHERE EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'time_entries'
);
