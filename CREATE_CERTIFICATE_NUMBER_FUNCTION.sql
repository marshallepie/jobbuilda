-- ============================================
-- Create generate_certificate_number function
-- Run this in Supabase SQL Editor
-- ============================================

CREATE OR REPLACE FUNCTION generate_certificate_number(p_tenant_id UUID, p_cert_type VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  v_date_str VARCHAR(8);
  v_count    INTEGER;
  v_prefix   VARCHAR(20);
  v_number   VARCHAR(50);
BEGIN
  v_date_str := TO_CHAR(NOW(), 'YYYYMMDD');

  -- Determine prefix based on certificate type
  CASE p_cert_type
    WHEN 'eic'         THEN v_prefix := 'CERT-EIC';
    WHEN 'eicr'        THEN v_prefix := 'CERT-EICR';
    WHEN 'minor_works' THEN v_prefix := 'CERT-MW';
    WHEN 'pat'         THEN v_prefix := 'CERT-PAT';
    ELSE v_prefix := 'CERT';
  END CASE;

  -- Count globally (unique constraint on certificate_number is global, not per-tenant)
  SELECT COUNT(*) INTO v_count
  FROM test_certificates
  WHERE certificate_number LIKE v_prefix || '-' || v_date_str || '-%';

  v_number := v_prefix || '-' || v_date_str || '-' || LPAD((v_count + 1)::TEXT, 3, '0');

  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- Verify
SELECT proname FROM pg_proc WHERE proname = 'generate_certificate_number';
