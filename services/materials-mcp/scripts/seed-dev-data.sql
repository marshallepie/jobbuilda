-- Seed data for materials-mcp (development/testing)

-- Insert test materials (common electrical supplies)
INSERT INTO materials (id, tenant_id, sku, name, description, category, unit, unit_cost, current_stock, min_stock_level, reorder_quantity, created_at, updated_at)
VALUES
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'CABLE-2.5-TE', '2.5mm Twin & Earth Cable', 'Standard twin and earth cable', 'Cables', 'metre', 1.25, 500, 100, 250, NOW(), NOW()),
  ('60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'SOCKET-13A-WH', '13A Socket Outlet White', 'Standard 13A socket outlet', 'Accessories', 'unit', 3.50, 50, 20, 50, NOW(), NOW()),
  ('60000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'RCBO-32A-B', 'RCBO 32A Type B', 'Residual current circuit breaker', 'Distribution', 'unit', 45.00, 15, 5, 10, NOW(), NOW()),
  ('60000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'MCB-32A-B', 'MCB 32A Type B', 'Miniature circuit breaker', 'Distribution', 'unit', 8.50, 25, 10, 20, NOW(), NOW()),
  ('60000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'LED-600-40W', '600x600 LED Panel 40W', 'Office LED panel light', 'Lighting', 'unit', 28.00, 8, 12, 20, NOW(), NOW()),
  ('60000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'CABLE-1.5-TE', '1.5mm Twin & Earth Cable', 'Lighting circuit cable', 'Cables', 'metre', 0.85, 300, 50, 200, NOW(), NOW());

-- Record initial stock transfers (purchases)
INSERT INTO material_transfers (tenant_id, material_id, transfer_type, quantity, reference, recorded_by, recorded_at, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'purchase', 500, 'PO-2026-001', '00000000-0000-0000-0000-000000000101', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
  ('00000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', 'purchase', 50, 'PO-2026-001', '00000000-0000-0000-0000-000000000101', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
  ('00000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000003', 'purchase', 20, 'PO-2026-002', '00000000-0000-0000-0000-000000000101', NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days'),
  ('00000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000004', 'purchase', 30, 'PO-2026-002', '00000000-0000-0000-0000-000000000101', NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days'),
  ('00000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000005', 'purchase', 30, 'PO-2026-003', '00000000-0000-0000-0000-000000000101', NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),
  ('00000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000006', 'purchase', 300, 'PO-2026-001', '00000000-0000-0000-0000-000000000101', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days');

-- Assign materials to Job 1 (Kitchen Rewire - completed)
INSERT INTO job_material_usage (tenant_id, job_id, material_id, quantity_planned, quantity_used, unit_cost, notes, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 150, 145, 1.25, 'Kitchen circuit wiring', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day'),
  ('00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', 12, 12, 3.50, 'Kitchen socket outlets', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day'),
  ('00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000003', 4, 4, 45.00, 'Kitchen circuit protection', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day');

-- Record material usage on Job 1 (deducting from stock)
INSERT INTO material_transfers (tenant_id, material_id, transfer_type, quantity, job_id, reference, recorded_by, recorded_at, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'usage', -145, '50000000-0000-0000-0000-000000000001', 'Job J-20260213-001', '00000000-0000-0000-0000-000000000101', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
  ('00000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', 'usage', -12, '50000000-0000-0000-0000-000000000001', 'Job J-20260213-001', '00000000-0000-0000-0000-000000000101', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
  ('00000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000003', 'usage', -4, '50000000-0000-0000-0000-000000000001', 'Job J-20260213-001', '00000000-0000-0000-0000-000000000101', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day');

-- Assign materials to Job 2 (Emergency Call - completed)
INSERT INTO job_material_usage (tenant_id, job_id, material_id, quantity_planned, quantity_used, unit_cost, notes, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000004', 1, 1, 8.50, 'Replace faulty MCB', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days');

-- Record material usage on Job 2
INSERT INTO material_transfers (tenant_id, material_id, transfer_type, quantity, job_id, reference, recorded_by, recorded_at, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000004', 'usage', -1, '50000000-0000-0000-0000-000000000002', 'Job J-20260213-002', '00000000-0000-0000-0000-000000000102', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days');

-- Assign materials to Job 3 (Office LED Upgrade - in progress)
INSERT INTO job_material_usage (tenant_id, job_id, material_id, quantity_planned, quantity_used, unit_cost, notes, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000005', 24, 8, 28.00, 'LED panel replacement', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000006', 100, 30, 0.85, 'LED circuit wiring', NOW(), NOW());

-- Record partial material usage on Job 3 (in progress)
INSERT INTO material_transfers (tenant_id, material_id, transfer_type, quantity, job_id, reference, recorded_by, recorded_at, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000005', 'usage', -8, '50000000-0000-0000-0000-000000000003', 'Job J-20260213-003', '00000000-0000-0000-0000-000000000101', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000006', 'usage', -30, '50000000-0000-0000-0000-000000000003', 'Job J-20260213-003', '00000000-0000-0000-0000-000000000101', NOW(), NOW());

-- Add stock adjustment (simulate a stocktake correction)
INSERT INTO material_transfers (tenant_id, material_id, transfer_type, quantity, reference, notes, recorded_by, recorded_at, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000003', 'adjustment', -1, 'STOCK-CHECK-2026-02', 'Found damaged unit during stocktake', '00000000-0000-0000-0000-000000000101', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days');

-- Verification queries
SELECT 'Materials created:' as status, COUNT(*) as count FROM materials;
SELECT 'Material transfers recorded:' as status, COUNT(*) as count FROM material_transfers;
SELECT 'Job material assignments:' as status, COUNT(*) as count FROM job_material_usage;
SELECT 'Active stock alerts:' as status, COUNT(*) as count FROM stock_alerts WHERE resolved_at IS NULL;

-- Show materials with current stock
SELECT
  sku,
  name,
  category,
  current_stock,
  min_stock_level,
  CASE
    WHEN min_stock_level IS NOT NULL AND current_stock <= min_stock_level THEN 'LOW'
    ELSE 'OK'
  END as stock_status
FROM materials
ORDER BY category, name;

-- Show job material usage summary
SELECT
  jmu.job_id,
  m.sku,
  m.name,
  jmu.quantity_planned,
  jmu.quantity_used,
  (jmu.quantity_used * jmu.unit_cost) as total_cost
FROM job_material_usage jmu
JOIN materials m ON m.id = jmu.material_id
ORDER BY jmu.job_id, m.name;
