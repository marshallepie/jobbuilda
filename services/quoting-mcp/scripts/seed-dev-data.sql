-- Seed data for quoting-mcp (development/testing)

-- Insert test leads
INSERT INTO leads (id, tenant_id, client_id, name, email, phone, address, description, source, status, assigned_to, created_at, updated_at)
VALUES
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000001', 'Kitchen Rewire', 'john@smithresidence.com', '020 1234 5678', '123 Oak Street, London SW1A 1AA', 'Complete kitchen rewire for renovation project', 'website', 'quoted', '00000000-0000-0000-0000-000000000101', NOW() - INTERVAL '14 days', NOW() - INTERVAL '5 days'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000002', 'Office Lighting Upgrade', 'facilities@techstartup.co.uk', '020 8765 4321', '45 Tech Park, Manchester M1 1AB', 'LED lighting upgrade for open-plan office', 'referral', 'contacted', '00000000-0000-0000-0000-000000000101', NOW() - INTERVAL '7 days', NOW() - INTERVAL '6 days'),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', NULL, 'Commercial Building Rewire', 'enquiries@retailcorp.co.uk', '0161 555 1234', '88 High Street, Birmingham B1 1BB', 'Full electrical rewire for retail premises', 'website', 'new', '00000000-0000-0000-0000-000000000101', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days');

-- Insert test quotes
INSERT INTO quotes (id, tenant_id, quote_number, lead_id, client_id, site_id, title, description, status, valid_until, terms, created_by, created_at, updated_at)
VALUES
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Q-20260212-001', '30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0002-000000000001', 'Kitchen Rewire - Complete Installation', 'Full rewire including new consumer unit, sockets, lighting circuits', 'sent', NOW() + INTERVAL '30 days', 'Payment terms: 50% deposit, 50% on completion. VAT included.', '00000000-0000-0000-0000-000000000101', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Q-20260212-002', NULL, '00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0002-000000000002', 'Office LED Lighting Upgrade', 'Replace existing fluorescent tubes with LED panels', 'draft', NOW() + INTERVAL '45 days', 'Payment terms: Net 30 days. VAT included.', '00000000-0000-0000-0000-000000000101', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day');

-- Insert quote line items for Quote 1 (Kitchen Rewire)
INSERT INTO quote_items (id, tenant_id, quote_id, item_type, product_id, sku, description, quantity, unit, unit_price_ex_vat, markup_percent, line_total_ex_vat, vat_rate, line_total_inc_vat, sort_order, created_at, updated_at)
VALUES
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'material', '20000000-0000-0000-0000-000000000002', 'ACM-CBL-025', '2.5mm Twin & Earth Cable', 150, 'metre', 1.85, 35, 375.19, 20.00, 450.23, 0, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'material', '20000000-0000-0000-0000-000000000003', 'ACM-SKT-001', '13A Socket Outlets', 12, 'unit', 3.20, 40, 53.76, 20.00, 64.51, 1, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'material', '20000000-0000-0000-0000-000000000004', 'ACM-RCD-001', 'RCBO 32A Type B', 4, 'unit', 28.50, 30, 148.20, 20.00, 177.84, 2, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'labor', NULL, NULL, 'Kitchen rewire labor - 3 days', 3, 'day', 350.00, 0, 1050.00, 20.00, 1260.00, 3, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'other', NULL, NULL, 'Electrical testing and certification', 1, 'unit', 150.00, 0, 150.00, 20.00, 180.00, 4, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days');

-- Insert quote line items for Quote 2 (Office LED Lighting)
INSERT INTO quote_items (id, tenant_id, quote_id, item_type, product_id, sku, description, quantity, unit, unit_price_ex_vat, markup_percent, line_total_ex_vat, vat_rate, line_total_inc_vat, sort_order, created_at, updated_at)
VALUES
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'material', '20000000-0000-0000-0000-000000000005', 'BL-PNL-600', '600x600 LED Panel', 24, 'unit', 45.00, 45, 1566.00, 20.00, 1879.20, 0, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'labor', NULL, NULL, 'LED panel installation - 2 days', 2, 'day', 350.00, 0, 700.00, 20.00, 840.00, 1, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'other', NULL, NULL, 'Disposal of old fluorescent fittings', 1, 'unit', 100.00, 0, 100.00, 20.00, 120.00, 2, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day');

-- Verification queries
SELECT 'Leads created:' as status, COUNT(*) as count FROM leads;
SELECT 'Quotes created:' as status, COUNT(*) as count FROM quotes;
SELECT 'Quote items created:' as status, COUNT(*) as count FROM quote_items;

-- Show quote totals
SELECT
  quote_number,
  title,
  status,
  CONCAT('£', ROUND(subtotal_ex_vat::numeric, 2)) as subtotal_ex_vat,
  CONCAT('£', ROUND(vat_amount::numeric, 2)) as vat_amount,
  CONCAT('£', ROUND(total_inc_vat::numeric, 2)) as total_inc_vat
FROM quotes
ORDER BY created_at DESC;
