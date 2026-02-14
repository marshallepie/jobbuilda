-- Create jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  job_number VARCHAR(50) NOT NULL,
  quote_id UUID,
  client_id UUID NOT NULL,
  site_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
  scheduled_start DATE,
  scheduled_end DATE,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  assigned_to UUID,
  estimated_hours NUMERIC(10, 2),
  actual_hours NUMERIC(10, 2) DEFAULT 0.00,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT jobs_status_check CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'on_hold')),
  CONSTRAINT jobs_tenant_job_number_unique UNIQUE (tenant_id, job_number)
);

-- Create job_items table
CREATE TABLE IF NOT EXISTS job_items (
  id UUID PRIMARY KEY,
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
  id UUID PRIMARY KEY,
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

-- Create indexes for jobs
CREATE INDEX IF NOT EXISTS idx_jobs_tenant_id ON jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_site_id ON jobs(site_id);
CREATE INDEX IF NOT EXISTS idx_jobs_quote_id ON jobs(quote_id);
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_to ON jobs(assigned_to);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_start ON jobs(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);

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

-- Add updated_at trigger for jobs
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add updated_at trigger for job_items
CREATE TRIGGER update_job_items_updated_at
  BEFORE UPDATE ON job_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add updated_at trigger for time_entries
CREATE TRIGGER update_time_entries_updated_at
  BEFORE UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to recalculate job actual hours from time entries
CREATE OR REPLACE FUNCTION recalculate_job_actual_hours()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE jobs
  SET
    actual_hours = COALESCE((
      SELECT SUM(hours)
      FROM time_entries
      WHERE job_id = COALESCE(NEW.job_id, OLD.job_id)
    ), 0),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.job_id, OLD.job_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalculate job actual hours when time entries change
CREATE TRIGGER recalculate_job_hours_on_insert
  AFTER INSERT ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_job_actual_hours();

CREATE TRIGGER recalculate_job_hours_on_update
  AFTER UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_job_actual_hours();

CREATE TRIGGER recalculate_job_hours_on_delete
  AFTER DELETE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_job_actual_hours();
