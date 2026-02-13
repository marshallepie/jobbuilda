-- Seed data for suppliers-mcp (development/testing)

-- Insert test suppliers
INSERT INTO suppliers (id, tenant_id, name, contact_name, email, phone, website, account_number, payment_terms, is_active, created_at, updated_at)
VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Acme Electrical Supplies', 'John Smith', 'john@acme-electrical.co.uk', '020 1234 5678', 'https://acme-electrical.co.uk', 'ACC12345', '30 days', true, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'British Lighting Ltd', 'Sarah Jones', 'sarah@british-lighting.co.uk', '020 8765 4321', 'https://british-lighting.co.uk', 'BL-98765', '60 days', true, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'CableCo Distributors', 'Mike Wilson', 'mike@cableco.co.uk', '0161 555 1234', 'https://cableco.co.uk', 'CC-2024-001', '45 days', false, NOW(), NOW());

-- Insert test products for Acme Electrical Supplies
INSERT INTO products (id, tenant_id, supplier_id, sku, name, description, category, unit, current_price_ex_vat, current_price_inc_vat, vat_rate, last_price_update, is_available, lead_time_days, minimum_order_quantity, created_at, updated_at)
VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'ACM-LED-001', '10W LED Downlight', 'Energy efficient LED downlight, warm white, 700 lumens', 'Lighting', 'unit', 12.50, 15.00, 20.00, NOW(), true, 3, 1, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'ACM-CBL-025', '2.5mm Twin & Earth Cable', 'High quality 2.5mm² T&E cable, per metre', 'Cables', 'metre', 1.85, 2.22, 20.00, NOW(), true, 1, 100, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'ACM-SKT-001', '13A Socket Outlet White', 'Standard 13A single socket, white finish', 'Accessories', 'unit', 3.20, 3.84, 20.00, NOW(), true, 2, 10, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'ACM-RCD-001', 'RCBO 32A Type B', '32A Type B RCBO with 30mA trip', 'Circuit Protection', 'unit', 28.50, 34.20, 20.00, NOW(), true, 5, 1, NOW(), NOW());

-- Insert test products for British Lighting Ltd
INSERT INTO products (id, tenant_id, supplier_id, sku, name, description, category, unit, current_price_ex_vat, current_price_inc_vat, vat_rate, last_price_update, is_available, lead_time_days, minimum_order_quantity, created_at, updated_at)
VALUES
  ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'BL-PNL-600', '600x600 LED Panel', 'Premium 40W LED panel, 4000K, 4800 lumens', 'Lighting', 'unit', 45.00, 54.00, 20.00, NOW(), true, 7, 1, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'BL-EMG-001', 'Emergency Light Twin Spot', 'LED emergency twin spot light, 3 hour battery', 'Lighting', 'unit', 32.00, 38.40, 20.00, NOW(), true, 5, 1, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'BL-FIT-001', 'LED Batten 5ft', '5ft LED batten fitting, 60W, 7200 lumens', 'Lighting', 'unit', 28.75, 34.50, 20.00, NOW(), false, 10, 1, NOW(), NOW());

-- Insert some price history
INSERT INTO price_history (id, tenant_id, product_id, price_ex_vat, price_inc_vat, vat_rate, changed_by, changed_at, reason)
VALUES
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 11.50, 13.80, 20.00, '00000000-0000-0000-0000-000000000101', NOW() - INTERVAL '30 days', 'Supplier price increase'),
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 1.75, 2.10, 20.00, '00000000-0000-0000-0000-000000000101', NOW() - INTERVAL '60 days', 'Initial price');

-- Verification queries
SELECT 'Suppliers created:' as status, COUNT(*) as count FROM suppliers;
SELECT 'Products created:' as status, COUNT(*) as count FROM products;
SELECT 'Price history entries:' as status, COUNT(*) as count FROM price_history;
