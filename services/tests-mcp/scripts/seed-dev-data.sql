-- Seed data for tests-mcp (development/testing)

-- Insert test for completed Job 1 (Kitchen Rewire)
INSERT INTO tests (id, tenant_id, test_number, job_id, client_id, site_id, test_type, title, description, status, test_date, completion_date, tested_by, outcome, created_at, updated_at)
VALUES
  ('80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'EIC-20260212-001', '50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0002-000000000001', 'initial_verification', 'Kitchen Rewire - Electrical Installation Certificate', 'Initial verification following complete kitchen rewire', 'completed', '2026-02-12', '2026-02-12', '00000000-0000-0000-0000-000000000101', 'satisfactory', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day');

-- Insert test for in-progress Job 3 (Office LED Upgrade)
INSERT INTO tests (id, tenant_id, test_number, job_id, client_id, site_id, test_type, title, description, status, test_date, tested_by, created_at, updated_at)
VALUES
  ('80000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'MW-20260213-001', '50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0002-000000000002', 'minor_works', 'Office LED Installation - Minor Works', 'Minor works certificate for LED panel installation', 'in_progress', '2026-02-13', '00000000-0000-0000-0000-000000000101', NOW(), NOW());

-- Insert test measurements for Test 1 (Kitchen Rewire - completed)
INSERT INTO test_measurements (tenant_id, test_id, circuit_ref, measurement_type, measurement_name, value, unit, min_acceptable, max_acceptable, pass, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'Ring Final 1', 'continuity', 'R1+R2 Continuity', 0.18, 'ohm', NULL, 1.0, true, NOW() - INTERVAL '1 day'),
  ('00000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'Ring Final 1', 'insulation', 'Line-Earth Insulation', 150.5, 'mohm', 1.0, NULL, true, NOW() - INTERVAL '1 day'),
  ('00000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'Ring Final 1', 'earth_loop', 'Zs Earth Fault Loop', 0.62, 'ohm', NULL, 1.44, true, NOW() - INTERVAL '1 day'),
  ('00000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'Ring Final 1', 'rcd', 'RCD Trip Time @ 1x', 22.0, 'ms', NULL, 300.0, true, NOW() - INTERVAL '1 day'),
  ('00000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'Lighting Circuit 1', 'continuity', 'R1+R2 Continuity', 0.25, 'ohm', NULL, 1.0, true, NOW() - INTERVAL '1 day'),
  ('00000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'Lighting Circuit 1', 'insulation', 'Line-Earth Insulation', 175.8, 'mohm', 1.0, NULL, true, NOW() - INTERVAL '1 day');

-- Insert test measurements for Test 2 (Office LED - in progress)
INSERT INTO test_measurements (tenant_id, test_id, circuit_ref, measurement_type, measurement_name, value, unit, pass, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002', 'Lighting Circuit 3', 'polarity', 'Polarity Check', 1.0, 'pass', true, NOW()),
  ('00000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002', 'Lighting Circuit 3', 'voltage', 'Supply Voltage', 232.5, 'v', true, NOW());

-- Insert certificate for Test 1 (completed)
INSERT INTO test_certificates (tenant_id, test_id, certificate_number, certificate_type, issue_date, expiry_date, storage_url, generated_by, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'CERT-EIC-20260212-001', 'eic', '2026-02-12', NULL, 'https://storage.jobbuilda.com/certificates/00000000-0000-0000-0000-000000000001/CERT-EIC-20260212-001.pdf', '00000000-0000-0000-0000-000000000101', NOW() - INTERVAL '1 day');

-- Verification queries
SELECT 'Tests created:' as status, COUNT(*) as count FROM tests;
SELECT 'Test measurements created:' as status, COUNT(*) as count FROM test_measurements;
SELECT 'Certificates created:' as status, COUNT(*) as count FROM test_certificates;

-- Show tests with status
SELECT
  test_number,
  test_type,
  title,
  status,
  outcome,
  test_date,
  completion_date
FROM tests
ORDER BY test_date DESC;

-- Show test measurements summary
SELECT
  t.test_number,
  tm.circuit_ref,
  tm.measurement_type,
  tm.measurement_name,
  tm.value,
  tm.unit,
  tm.pass
FROM test_measurements tm
JOIN tests t ON t.id = tm.test_id
ORDER BY t.test_number, tm.circuit_ref, tm.measurement_type;
