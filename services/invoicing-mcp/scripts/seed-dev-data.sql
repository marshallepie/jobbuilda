-- Seed data for invoicing-mcp (development/testing)

-- Insert invoice for completed Job 1 (Kitchen Rewire)
INSERT INTO invoices (id, tenant_id, invoice_number, job_id, client_id, site_id, invoice_date, due_date, payment_terms_days, status, created_by, created_at, updated_at)
VALUES
  ('90000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'INV-20260212-001', '50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0002-000000000001', '2026-02-12', '2026-03-14', 30, 'sent', '00000000-0000-0000-0000-000000000101', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day');

-- Insert invoice items for Invoice 1 (labor and materials from job)
INSERT INTO invoice_items (tenant_id, invoice_id, item_type, description, quantity, unit, unit_price_ex_vat, line_total_ex_vat, vat_rate, line_vat, line_total_inc_vat, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'labor', 'Kitchen rewire - 3 days labor', 3, 'day', 350.00, 1050.00, 20.00, 210.00, 1260.00, NOW() - INTERVAL '1 day'),
  ('00000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'material', '2.5mm Twin & Earth Cable - 145m', 145, 'metre', 1.25, 181.25, 20.00, 36.25, 217.50, NOW() - INTERVAL '1 day'),
  ('00000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'material', '13A Socket Outlets', 12, 'unit', 3.50, 42.00, 20.00, 8.40, 50.40, NOW() - INTERVAL '1 day'),
  ('00000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'material', 'RCBO 32A Type B', 4, 'unit', 45.00, 180.00, 20.00, 36.00, 216.00, NOW() - INTERVAL '1 day');

-- Update invoice 1 with sent details
UPDATE invoices
SET sent_at = NOW() - INTERVAL '1 day',
    storage_url = 'https://storage.jobbuilda.com/invoices/00000000-0000-0000-0000-000000000001/INV-20260212-001.pdf'
WHERE id = '90000000-0000-0000-0000-000000000001';

-- Insert draft invoice for Job 3 (Office LED - in progress)
INSERT INTO invoices (id, tenant_id, invoice_number, job_id, client_id, site_id, invoice_date, due_date, payment_terms_days, status, notes, created_by, created_at, updated_at)
VALUES
  ('90000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'INV-20260213-001', '50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0002-000000000002', '2026-02-13', '2026-03-15', 30, 'draft', 'Initial draft - awaiting final materials count', '00000000-0000-0000-0000-000000000101', NOW(), NOW());

-- Insert invoice items for Invoice 2 (LED installation)
INSERT INTO invoice_items (tenant_id, invoice_id, item_type, description, quantity, unit, unit_price_ex_vat, line_total_ex_vat, vat_rate, line_vat, line_total_inc_vat, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000002', 'labor', 'LED panel installation - 2 days', 2, 'day', 350.00, 700.00, 20.00, 140.00, 840.00, NOW()),
  ('00000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000002', 'material', '600x600 LED Panels', 8, 'unit', 28.00, 224.00, 20.00, 44.80, 268.80, NOW()),
  ('00000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000002', 'material', '1.5mm Cable for LED circuits', 30, 'metre', 0.85, 25.50, 20.00, 5.10, 30.60, NOW());

-- Verification queries
SELECT 'Invoices created:' as status, COUNT(*) as count FROM invoices;
SELECT 'Invoice items created:' as status, COUNT(*) as count FROM invoice_items;

-- Show invoices with totals
SELECT
  invoice_number,
  status,
  invoice_date,
  due_date,
  subtotal_ex_vat,
  vat_amount,
  total_inc_vat,
  amount_paid,
  amount_due
FROM invoices
ORDER BY invoice_date DESC;

-- Show invoice items summary
SELECT
  i.invoice_number,
  ii.item_type,
  ii.description,
  ii.quantity,
  ii.unit,
  ii.line_total_inc_vat
FROM invoice_items ii
JOIN invoices i ON i.id = ii.invoice_id
ORDER BY i.invoice_number, ii.created_at;
