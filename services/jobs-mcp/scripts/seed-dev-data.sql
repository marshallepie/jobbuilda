-- Seed data for jobs-mcp (development/testing)

-- Insert test jobs (linked to existing quotes)
INSERT INTO jobs (id, tenant_id, job_number, quote_id, client_id, site_id, title, description, status, scheduled_start, scheduled_end, assigned_to, estimated_hours, created_by, created_at, updated_at)
VALUES
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'J-20260213-001', '40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0002-000000000001', 'Kitchen Rewire - Installation', 'Complete kitchen rewire including new consumer unit', 'completed', '2026-02-10', '2026-02-12', '00000000-0000-0000-0000-000000000101', 24, '00000000-0000-0000-0000-000000000101', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day'),
  ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'J-20260213-002', NULL, '00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0002-000000000002', 'Emergency Call - Circuit Fault', 'Emergency callout for tripping circuit', 'completed', '2026-02-11', '2026-02-11', '00000000-0000-0000-0000-000000000102', 3, '00000000-0000-0000-0000-000000000101', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
  ('50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'J-20260213-003', '40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0002-000000000002', 'Office LED Lighting Upgrade', 'Replace fluorescent tubes with LED panels', 'in_progress', '2026-02-13', '2026-02-14', '00000000-0000-0000-0000-000000000101', 16, '00000000-0000-0000-0000-000000000101', NOW(), NOW());

-- Update jobs with actual start/end times
UPDATE jobs SET actual_start = NOW() - INTERVAL '3 days' WHERE id = '50000000-0000-0000-0000-000000000001';
UPDATE jobs SET actual_end = NOW() - INTERVAL '1 day' WHERE id = '50000000-0000-0000-0000-000000000001';
UPDATE jobs SET actual_start = NOW() - INTERVAL '2 days', actual_end = NOW() - INTERVAL '2 days' WHERE id = '50000000-0000-0000-0000-000000000002';
UPDATE jobs SET actual_start = NOW() WHERE id = '50000000-0000-0000-0000-000000000003';

-- Insert job items for Kitchen Rewire
INSERT INTO job_items (id, tenant_id, job_id, item_type, description, quantity_planned, quantity_used, unit, status, created_at, updated_at)
VALUES
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'material', '2.5mm Twin & Earth Cable', 150, 145, 'metre', 'completed', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day'),
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'material', '13A Socket Outlets', 12, 12, 'unit', 'completed', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day'),
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'material', 'RCBO 32A Type B', 4, 4, 'unit', 'completed', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day'),
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'labor', 'Kitchen rewire labor', 3, 3, 'day', 'completed', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day');

-- Insert job items for Emergency Call
INSERT INTO job_items (id, tenant_id, job_id, item_type, description, quantity_planned, quantity_used, unit, status, created_at, updated_at)
VALUES
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', 'labor', 'Emergency callout diagnostic', 2, 2.5, 'hour', 'completed', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', 'material', 'MCB 32A Type B', 1, 1, 'unit', 'completed', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days');

-- Insert job items for Office LED Upgrade (in progress)
INSERT INTO job_items (id, tenant_id, job_id, item_type, description, quantity_planned, quantity_used, unit, status, created_at, updated_at)
VALUES
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000003', 'material', '600x600 LED Panels', 24, 8, 'unit', 'in_progress', NOW(), NOW()),
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000003', 'labor', 'LED panel installation', 2, 0, 'day', 'in_progress', NOW(), NOW());

-- Insert time entries for Kitchen Rewire (completed job)
INSERT INTO time_entries (id, tenant_id, job_id, user_id, date, start_time, end_time, hours, break_minutes, description, created_at, updated_at)
VALUES
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', NOW()::date - INTERVAL '3 days', (NOW() - INTERVAL '3 days' + INTERVAL '8 hours')::timestamp, (NOW() - INTERVAL '3 days' + INTERVAL '17 hours')::timestamp, 8.5, 30, 'Initial rewire work', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', NOW()::date - INTERVAL '2 days', (NOW() - INTERVAL '2 days' + INTERVAL '8 hours')::timestamp, (NOW() - INTERVAL '2 days' + INTERVAL '17 hours')::timestamp, 8.5, 30, 'Continued rewire work', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', NOW()::date - INTERVAL '2 days', (NOW() - INTERVAL '2 days' + INTERVAL '8 hours')::timestamp, (NOW() - INTERVAL '2 days' + INTERVAL '13 hours')::timestamp, 4.5, 30, 'Assisted with second day', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', NOW()::date - INTERVAL '1 day', (NOW() - INTERVAL '1 day' + INTERVAL '8 hours')::timestamp, (NOW() - INTERVAL '1 day' + INTERVAL '13 hours')::timestamp, 4.5, 30, 'Final connections and testing', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day');

-- Insert time entries for Emergency Call
INSERT INTO time_entries (id, tenant_id, job_id, user_id, date, start_time, end_time, hours, break_minutes, description, created_at, updated_at)
VALUES
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000102', NOW()::date - INTERVAL '2 days', (NOW() - INTERVAL '2 days' + INTERVAL '15 hours')::timestamp, (NOW() - INTERVAL '2 days' + INTERVAL '17 hours' + INTERVAL '30 minutes')::timestamp, 2.5, 0, 'Emergency diagnostic and repair', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days');

-- Insert time entries for Office LED Upgrade (in progress)
INSERT INTO time_entries (id, tenant_id, job_id, user_id, date, start_time, end_time, hours, break_minutes, description, created_at, updated_at)
VALUES
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000101', NOW()::date, (NOW()::date + INTERVAL '8 hours')::timestamp, (NOW()::date + INTERVAL '12 hours')::timestamp, 4, 0, 'Started LED panel installation', NOW(), NOW());

-- Verification queries
SELECT 'Jobs created:' as status, COUNT(*) as count FROM jobs;
SELECT 'Job items created:' as status, COUNT(*) as count FROM job_items;
SELECT 'Time entries created:' as status, COUNT(*) as count FROM time_entries;

-- Show job summary with actual hours
SELECT
  job_number,
  title,
  status,
  scheduled_start,
  estimated_hours,
  actual_hours
FROM jobs
ORDER BY created_at DESC;
