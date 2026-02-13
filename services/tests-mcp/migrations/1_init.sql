-- Tests MCP Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Electrical compliance tests
CREATE TABLE tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  test_number VARCHAR(50) NOT NULL UNIQUE,
  job_id UUID NOT NULL, -- Reference to jobs-mcp
  client_id UUID NOT NULL, -- Reference to clients-mcp
  site_id UUID NOT NULL, -- Reference to clients-mcp
  test_type VARCHAR(100) NOT NULL, -- 'eicr', 'pat', 'initial_verification', 'periodic_inspection', 'minor_works'
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'in_progress', 'completed', 'failed'
  test_date DATE,
  completion_date DATE,
  next_inspection_date DATE,
  tested_by UUID NOT NULL, -- User who performed test
  outcome VARCHAR(50), -- 'satisfactory', 'unsatisfactory', 'requires_improvement'
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tests_tenant ON tests(tenant_id);
CREATE INDEX idx_tests_job ON tests(job_id);
CREATE INDEX idx_tests_client ON tests(client_id);
CREATE INDEX idx_tests_status ON tests(status);
CREATE INDEX idx_tests_type ON tests(test_type);
CREATE INDEX idx_tests_number ON tests(test_number);

-- Test measurements and readings
CREATE TABLE test_measurements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  circuit_ref VARCHAR(100), -- e.g., 'Ring Final 1', 'Lighting Circuit 2'
  measurement_type VARCHAR(100) NOT NULL, -- 'continuity', 'insulation', 'earth_loop', 'rcd', 'polarity', 'voltage'
  measurement_name VARCHAR(255) NOT NULL,
  value DECIMAL(10, 3),
  unit VARCHAR(50), -- 'ohm', 'mohm', 'ms', 'v', 'a'
  min_acceptable DECIMAL(10, 3),
  max_acceptable DECIMAL(10, 3),
  pass BOOLEAN,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_measurements_tenant ON test_measurements(tenant_id);
CREATE INDEX idx_measurements_test ON test_measurements(test_id);
CREATE INDEX idx_measurements_type ON test_measurements(measurement_type);
CREATE INDEX idx_measurements_circuit ON test_measurements(circuit_ref);

-- Test certificates
CREATE TABLE test_certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  certificate_number VARCHAR(50) NOT NULL UNIQUE,
  certificate_type VARCHAR(100) NOT NULL, -- 'eicr', 'minor_works', 'eic', 'pat'
  issue_date DATE NOT NULL,
  expiry_date DATE,
  storage_url TEXT, -- S3 URL for PDF
  file_size_bytes INTEGER,
  generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  generated_by UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_certificates_tenant ON test_certificates(tenant_id);
CREATE INDEX idx_certificates_test ON test_certificates(test_id);
CREATE INDEX idx_certificates_number ON test_certificates(certificate_number);

-- Event outbox for reliable event publishing
CREATE TABLE event_outbox (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(255) NOT NULL,
  tenant_id UUID NOT NULL,
  payload JSONB NOT NULL,
  published_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outbox_unpublished ON event_outbox(created_at) WHERE published_at IS NULL;

-- Trigger: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tests_updated_at
BEFORE UPDATE ON tests
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Function to generate next test number
CREATE OR REPLACE FUNCTION generate_test_number(p_tenant_id UUID, p_test_type VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  v_date_str VARCHAR(8);
  v_count INTEGER;
  v_prefix VARCHAR(10);
  v_number VARCHAR(50);
BEGIN
  v_date_str := TO_CHAR(NOW(), 'YYYYMMDD');

  -- Determine prefix based on test type
  CASE p_test_type
    WHEN 'eicr' THEN v_prefix := 'EICR';
    WHEN 'pat' THEN v_prefix := 'PAT';
    WHEN 'initial_verification' THEN v_prefix := 'EIC';
    WHEN 'periodic_inspection' THEN v_prefix := 'PIR';
    WHEN 'minor_works' THEN v_prefix := 'MW';
    ELSE v_prefix := 'TEST';
  END CASE;

  SELECT COUNT(*) INTO v_count
  FROM tests
  WHERE tenant_id = p_tenant_id
    AND test_number LIKE v_prefix || '-' || v_date_str || '-%';

  v_number := v_prefix || '-' || v_date_str || '-' || LPAD((v_count + 1)::TEXT, 3, '0');

  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- Function to generate certificate number
CREATE OR REPLACE FUNCTION generate_certificate_number(p_tenant_id UUID, p_certificate_type VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  v_date_str VARCHAR(8);
  v_count INTEGER;
  v_prefix VARCHAR(10);
  v_number VARCHAR(50);
BEGIN
  v_date_str := TO_CHAR(NOW(), 'YYYYMMDD');

  CASE p_certificate_type
    WHEN 'eicr' THEN v_prefix := 'CERT-EICR';
    WHEN 'eic' THEN v_prefix := 'CERT-EIC';
    WHEN 'pat' THEN v_prefix := 'CERT-PAT';
    WHEN 'minor_works' THEN v_prefix := 'CERT-MW';
    ELSE v_prefix := 'CERT';
  END CASE;

  SELECT COUNT(*) INTO v_count
  FROM test_certificates
  WHERE tenant_id = p_tenant_id
    AND certificate_number LIKE v_prefix || '-' || v_date_str || '-%';

  v_number := v_prefix || '-' || v_date_str || '-' || LPAD((v_count + 1)::TEXT, 3, '0');

  RETURN v_number;
END;
$$ LANGUAGE plpgsql;
