-- ============================================
-- Complete Tests MCP Schema Setup
-- ============================================
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tests table if it has wrong schema
DROP TABLE IF EXISTS test_certificates CASCADE;
DROP TABLE IF EXISTS test_measurements CASCADE;
DROP TABLE IF EXISTS tests CASCADE;

-- Electrical compliance tests
CREATE TABLE tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  test_number VARCHAR(50) NOT NULL UNIQUE,
  job_id UUID NOT NULL,
  client_id UUID NOT NULL,
  site_id UUID NOT NULL,
  test_type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
  test_date DATE,
  completion_date DATE,
  next_inspection_date DATE,
  tested_by UUID NOT NULL,
  outcome VARCHAR(50),
  notes TEXT,
  premises_type VARCHAR(50),
  earthing_arrangements VARCHAR(100),
  schedule_of_inspections JSONB,
  inspector_name VARCHAR(255),
  inspector_registration_number VARCHAR(100),
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
  circuit_ref VARCHAR(100),
  measurement_type VARCHAR(100) NOT NULL,
  measurement_name VARCHAR(255) NOT NULL,
  value DECIMAL(10, 3),
  unit VARCHAR(50),
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
  certificate_type VARCHAR(100) NOT NULL,
  issue_date DATE NOT NULL,
  expiry_date DATE,
  storage_url TEXT,
  file_size_bytes INTEGER,
  generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  generated_by UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_certificates_tenant ON test_certificates(tenant_id);
CREATE INDEX idx_certificates_test ON test_certificates(test_id);
CREATE INDEX idx_certificates_number ON test_certificates(certificate_number);

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

-- Function to generate test numbers
CREATE OR REPLACE FUNCTION generate_test_number(p_tenant_id UUID, p_test_type VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  v_date_str VARCHAR(8);
  v_count INTEGER;
  v_prefix VARCHAR(10);
  v_number VARCHAR(50);
BEGIN
  v_date_str := TO_CHAR(NOW(), 'YYYYMMDD');

  CASE p_test_type
    WHEN 'eicr' THEN v_prefix := 'EICR';
    WHEN 'eic' THEN v_prefix := 'EIC';
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

-- Verify setup
SELECT 'Tests table created' as status, COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'tests';
