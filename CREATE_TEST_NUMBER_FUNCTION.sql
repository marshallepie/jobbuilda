-- Create the generate_test_number function for tests-mcp
-- Run this in Supabase SQL Editor

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
    WHEN 'eic' THEN v_prefix := 'EIC';
    WHEN 'pat' THEN v_prefix := 'PAT';
    WHEN 'initial_verification' THEN v_prefix := 'EIC';
    WHEN 'periodic_inspection' THEN v_prefix := 'PIR';
    WHEN 'minor_works' THEN v_prefix := 'MW';
    ELSE v_prefix := 'TEST';
  END CASE;

  -- Count globally (not per-tenant) because test_number has a global UNIQUE constraint
  SELECT COUNT(*) INTO v_count
  FROM tests
  WHERE test_number LIKE v_prefix || '-' || v_date_str || '-%';

  v_number := v_prefix || '-' || v_date_str || '-' || LPAD((v_count + 1)::TEXT, 3, '0');

  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- Verify it was created
SELECT proname, prokind
FROM pg_proc
WHERE proname = 'generate_test_number';
