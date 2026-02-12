-- Seed data for clients-mcp development and testing

-- Insert test client
INSERT INTO clients (id, tenant_id, name, email, phone, company, notes, gdpr_consent, gdpr_consent_date)
VALUES (
  '00000000-0000-0000-0001-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'John Smith',
  'john.smith@example.com',
  '+44 7700 900123',
  'Smith Enterprises Ltd',
  'Preferred contact time: 9am-5pm weekdays',
  true,
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Insert second test client
INSERT INTO clients (id, tenant_id, name, email, phone, company, notes, gdpr_consent, gdpr_consent_date)
VALUES (
  '00000000-0000-0000-0001-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Sarah Johnson',
  'sarah.johnson@example.com',
  '+44 7700 900456',
  null,
  'Gate code: 1234',
  true,
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Insert site for first client
INSERT INTO sites (id, tenant_id, client_id, name, address_line1, address_line2, city, county, postcode, country, access_notes)
VALUES (
  '00000000-0000-0000-0002-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0001-000000000001',
  'Main Office',
  '123 High Street',
  'Unit 5',
  'London',
  'Greater London',
  'SW1A 1AA',
  'United Kingdom',
  'Reception on ground floor, ask for facilities manager'
) ON CONFLICT (id) DO NOTHING;

-- Insert second site for first client
INSERT INTO sites (id, tenant_id, client_id, name, address_line1, address_line2, city, county, postcode, country, access_notes)
VALUES (
  '00000000-0000-0000-0002-000000000002',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0001-000000000001',
  'Warehouse',
  '456 Industrial Estate',
  null,
  'Manchester',
  'Greater Manchester',
  'M1 1AA',
  'United Kingdom',
  'Access via side entrance, keypad code provided on day'
) ON CONFLICT (id) DO NOTHING;

-- Insert site for second client
INSERT INTO sites (id, tenant_id, client_id, name, address_line1, address_line2, city, county, postcode, country, access_notes)
VALUES (
  '00000000-0000-0000-0002-000000000003',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0001-000000000002',
  'Home',
  '78 Oak Avenue',
  null,
  'Birmingham',
  'West Midlands',
  'B1 1AA',
  'United Kingdom',
  'Dog in back garden - please use front door'
) ON CONFLICT (id) DO NOTHING;

-- Display seeded data
SELECT 'Clients:' as info;
SELECT id, name, email, company, gdpr_consent FROM clients;

SELECT 'Sites:' as info;
SELECT s.id, c.name as client_name, s.name as site_name, s.postcode
FROM sites s
JOIN clients c ON s.client_id = c.id
ORDER BY c.name, s.name;
