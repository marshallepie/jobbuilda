-- Seed data for variations-mcp (development/testing)

-- Insert test variations for Job 3 (Office LED Upgrade - in progress)
INSERT INTO variations (id, tenant_id, variation_number, job_id, title, description, reason, status, created_by, created_at, updated_at)
VALUES
  ('70000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'V-20260213-001', '50000000-0000-0000-0000-000000000003', 'Additional Emergency Lights', 'Client requested additional emergency lighting in the corridors', 'client_request', 'approved', '00000000-0000-0000-0000-000000000101', NOW() - INTERVAL '1 day', NOW() - INTERVAL '5 hours'),
  ('70000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'V-20260213-002', '50000000-0000-0000-0000-000000000003', 'Extra Data Points', 'Client wants 6 additional data points in main office area', 'client_request', 'pending', '00000000-0000-0000-0000-000000000101', NOW(), NOW());

-- Insert variation items for Variation 1 (approved)
INSERT INTO variation_items (tenant_id, variation_id, item_type, description, quantity, unit, unit_price_ex_vat, line_total_ex_vat, vat_rate, line_vat, line_total_inc_vat, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'material', 'Emergency LED Exit Sign', 4, 'unit', 35.00, 140.00, 20.00, 28.00, 168.00, NOW() - INTERVAL '1 day', NOW() - INTERVAL '5 hours'),
  ('00000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'material', 'Emergency Bulkhead Light', 6, 'unit', 42.00, 252.00, 20.00, 50.40, 302.40, NOW() - INTERVAL '1 day', NOW() - INTERVAL '5 hours'),
  ('00000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'labor', 'Emergency lighting installation', 4, 'hour', 45.00, 180.00, 20.00, 36.00, 216.00, NOW() - INTERVAL '1 day', NOW() - INTERVAL '5 hours');

-- Insert variation items for Variation 2 (pending)
INSERT INTO variation_items (tenant_id, variation_id, item_type, description, quantity, unit, unit_price_ex_vat, line_total_ex_vat, vat_rate, line_vat, line_total_inc_vat, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', 'material', 'Cat6 Data Cable', 200, 'metre', 0.65, 130.00, 20.00, 26.00, 156.00, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', 'material', 'RJ45 Data Outlets', 6, 'unit', 12.50, 75.00, 20.00, 15.00, 90.00, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', 'labor', 'Data cabling and termination', 8, 'hour', 45.00, 360.00, 20.00, 72.00, 432.00, NOW(), NOW());

-- Update variation 1 approval details
UPDATE variations
SET approved_at = NOW() - INTERVAL '5 hours',
    approved_by = '00000000-0000-0000-0000-000000000101'
WHERE id = '70000000-0000-0000-0000-000000000001';

-- Verification queries
SELECT 'Variations created:' as status, COUNT(*) as count FROM variations;
SELECT 'Variation items created:' as status, COUNT(*) as count FROM variation_items;

-- Show variations with totals
SELECT
  variation_number,
  title,
  status,
  reason,
  subtotal_ex_vat,
  vat_amount,
  total_inc_vat
FROM variations
ORDER BY created_at DESC;

-- Show variation items summary
SELECT
  v.variation_number,
  v.title,
  vi.item_type,
  vi.description,
  vi.quantity,
  vi.unit,
  vi.line_total_inc_vat
FROM variation_items vi
JOIN variations v ON v.id = vi.variation_id
ORDER BY v.variation_number, vi.created_at;
