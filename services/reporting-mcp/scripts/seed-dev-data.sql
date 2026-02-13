-- Seed data for reporting-mcp (development/testing)

-- Insert financial events from invoicing (revenue)
INSERT INTO financial_events (id, tenant_id, event_type, event_id, occurred_at, entity_type, entity_id, amount_ex_vat, vat_amount, amount_inc_vat, category, job_id, client_id, raw_event)
VALUES
  -- Invoice 1 sent (revenue event)
  ('f0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'invoice.sent', 'e0000000-0000-0000-0000-000000000001', '2026-02-12 10:00:00', 'invoice', '90000000-0000-0000-0000-000000000001', 1453.25, 290.65, 1743.90, 'revenue', '50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000001', '{"invoice_id": "90000000-0000-0000-0000-000000000001", "amount": 1743.90}'::jsonb),

  -- Invoice 2 draft (not counted until sent)
  ('f0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'invoice.created', 'e0000000-0000-0000-0000-000000000002', '2026-02-13 09:00:00', 'invoice', '90000000-0000-0000-0000-000000000002', 949.50, 189.90, 1139.40, 'revenue', '50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0001-000000000002', '{"invoice_id": "90000000-0000-0000-0000-000000000002", "amount": 1139.40}'::jsonb);

-- Insert financial events from materials (costs)
INSERT INTO financial_events (id, tenant_id, event_type, event_id, occurred_at, entity_type, entity_id, amount_ex_vat, vat_amount, amount_inc_vat, category, subcategory, job_id, raw_event)
VALUES
  -- Material purchase events (costs)
  ('f0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'material.purchased', 'e0000000-0000-0000-0000-000000000003', '2026-02-10 14:30:00', 'material', '70000000-0000-0000-0000-000000000001', 181.25, 36.25, 217.50, 'cost', 'materials', '50000000-0000-0000-0000-000000000001', '{"material_id": "70000000-0000-0000-0000-000000000001", "quantity": 145, "unit_price": 1.25}'::jsonb),

  ('f0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'material.purchased', 'e0000000-0000-0000-0000-000000000004', '2026-02-10 15:00:00', 'material', '70000000-0000-0000-0000-000000000002', 42.00, 8.40, 50.40, 'cost', 'materials', '50000000-0000-0000-0000-000000000001', '{"material_id": "70000000-0000-0000-0000-000000000002", "quantity": 12, "unit_price": 3.50}'::jsonb),

  ('f0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'material.purchased', 'e0000000-0000-0000-0000-000000000005', '2026-02-11 11:00:00', 'material', '70000000-0000-0000-0000-000000000003', 180.00, 36.00, 216.00, 'cost', 'materials', '50000000-0000-0000-0000-000000000001', '{"material_id": "70000000-0000-0000-0000-000000000003", "quantity": 4, "unit_price": 45.00}'::jsonb);

-- Insert payment received events
INSERT INTO financial_events (id, tenant_id, event_type, event_id, occurred_at, entity_type, entity_id, amount_ex_vat, vat_amount, amount_inc_vat, category, client_id, raw_event)
VALUES
  -- Payment for Invoice 1
  ('f0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'payment.succeeded', 'e0000000-0000-0000-0000-000000000006', '2026-02-13 15:11:31', 'payment', 'b0000000-0000-0000-0000-000000000001', 1453.25, 290.65, 1743.90, 'payment_received', '00000000-0000-0000-0001-000000000001', '{"transaction_id": "b0000000-0000-0000-0000-000000000001", "invoice_id": "90000000-0000-0000-0000-000000000001", "amount": 1743.90}'::jsonb);

-- Verification queries
SELECT 'Financial events created:' as status, COUNT(*) as count FROM financial_events;

-- Show financial events summary by category
SELECT
  category,
  COUNT(*) as event_count,
  SUM(amount_ex_vat) as total_ex_vat,
  SUM(vat_amount) as total_vat,
  SUM(amount_inc_vat) as total_inc_vat
FROM financial_events
GROUP BY category
ORDER BY category;

-- Create a VAT return for February 2026
-- This will be generated via the API, but we can verify the data is ready
SELECT
  'Revenue events for VAT:' as note,
  SUM(vat_amount) as total_output_vat,
  SUM(amount_ex_vat) as total_sales_ex_vat
FROM financial_events
WHERE category = 'revenue'
  AND occurred_at >= '2026-02-01'
  AND occurred_at < '2026-03-01';

SELECT
  'Cost events for VAT:' as note,
  SUM(vat_amount) as total_input_vat,
  SUM(amount_ex_vat) as total_purchases_ex_vat
FROM financial_events
WHERE category = 'cost'
  AND occurred_at >= '2026-02-01'
  AND occurred_at < '2026-03-01';
