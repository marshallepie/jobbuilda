-- Jobs MCP Server - Initial Schema
-- Creates tables for jobs, job items, and time tracking

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Jobs table
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  job_number VARCHAR(50) NOT NULL,
  quote_id UUID,
  client_id UUID NOT NULL,
  site_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'on_hold', 'completed', 'cancelled')),
  scheduled_start DATE,
  scheduled_end DATE,
  actual_start TIMESTAMP,
  actual_end TIMESTAMP,
  assigned_to UUID,
  estimated_hours DECIMAL(10, 2),
  actual_hours DECIMAL(10, 2) DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, job_number)
);

CREATE INDEX idx_jobs_tenant_id ON jobs(tenant_id);
CREATE INDEX idx_jobs_client_id ON jobs(client_id);
CREATE INDEX idx_jobs_site_id ON jobs(site_id);
CREATE INDEX idx_jobs_quote_id ON jobs(quote_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_assigned_to ON jobs(assigned_to);
CREATE INDEX idx_jobs_scheduled_start ON jobs(scheduled_start);

-- Job items (planned work items from quote)
CREATE TABLE job_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  quote_item_id UUID,
  item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('material', 'labor', 'other')),
  description TEXT NOT NULL,
  quantity_planned DECIMAL(10, 2) NOT NULL,
  quantity_used DECIMAL(10, 2) DEFAULT 0,
  unit VARCHAR(50) DEFAULT 'unit',
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_items_tenant_id ON job_items(tenant_id);
CREATE INDEX idx_job_items_job_id ON job_items(job_id);
CREATE INDEX idx_job_items_item_type ON job_items(item_type);
CREATE INDEX idx_job_items_status ON job_items(status);

-- Time entries (technician time tracking)
CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  hours DECIMAL(10, 2),
  break_minutes INTEGER DEFAULT 0,
  description TEXT,
  is_overtime BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_time_entries_tenant_id ON time_entries(tenant_id);
CREATE INDEX idx_time_entries_job_id ON time_entries(job_id);
CREATE INDEX idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX idx_time_entries_date ON time_entries(date);

-- Event outbox table for reliable event publishing
CREATE TABLE event_outbox (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(255) NOT NULL,
  tenant_id UUID NOT NULL,
  payload JSONB NOT NULL,
  published_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_event_outbox_unpublished ON event_outbox(created_at) WHERE published_at IS NULL;
CREATE INDEX idx_event_outbox_tenant_id ON event_outbox(tenant_id);

-- Updated timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_items_updated_at
  BEFORE UPDATE ON job_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_time_entries_updated_at
  BEFORE UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to recalculate job actual hours from time entries
CREATE OR REPLACE FUNCTION recalculate_job_hours()
RETURNS TRIGGER AS $$
DECLARE
  v_total_hours DECIMAL(10, 2);
BEGIN
  -- Get job_id from NEW or OLD record
  IF TG_OP = 'DELETE' THEN
    -- Recalculate for the job that lost a time entry
    SELECT COALESCE(SUM(hours), 0)
    INTO v_total_hours
    FROM time_entries
    WHERE job_id = OLD.job_id;

    UPDATE jobs
    SET actual_hours = v_total_hours
    WHERE id = OLD.job_id;
  ELSE
    -- Recalculate for the job that gained/modified a time entry
    SELECT COALESCE(SUM(hours), 0)
    INTO v_total_hours
    FROM time_entries
    WHERE job_id = NEW.job_id;

    UPDATE jobs
    SET actual_hours = v_total_hours
    WHERE id = NEW.job_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recalculate_job_hours_after_insert
  AFTER INSERT ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_job_hours();

CREATE TRIGGER recalculate_job_hours_after_update
  AFTER UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_job_hours();

CREATE TRIGGER recalculate_job_hours_after_delete
  AFTER DELETE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_job_hours();

-- Comments for documentation
COMMENT ON TABLE jobs IS 'Jobs converted from approved quotes with scheduling and tracking';
COMMENT ON TABLE job_items IS 'Planned work items from quote (materials, labor, other)';
COMMENT ON TABLE time_entries IS 'Technician time tracking for jobs';
COMMENT ON TABLE event_outbox IS 'Outbox pattern for reliable event publishing to NATS';
