-- Seed data for development and testing
-- Test tenant and admin user with permissions

-- Insert test tenant
INSERT INTO tenants (id, name, plan, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Test Electrical Co',
  'standard',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Insert admin user
INSERT INTO users (id, tenant_id, email, name, role, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000001',
  'admin@test.com',
  'Test Admin',
  'admin',
  NOW(),
  NOW()
) ON CONFLICT (tenant_id, email) DO NOTHING;

-- Insert technician user
INSERT INTO users (id, tenant_id, email, name, role, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000001',
  'tech@test.com',
  'Test Technician',
  'technician',
  NOW(),
  NOW()
) ON CONFLICT (tenant_id, email) DO NOTHING;

-- Insert client user
INSERT INTO users (id, tenant_id, email, name, role, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000103',
  '00000000-0000-0000-0000-000000000001',
  'client@test.com',
  'Test Client',
  'client',
  NOW(),
  NOW()
) ON CONFLICT (tenant_id, email) DO NOTHING;

-- Grant permissions to admin user
INSERT INTO permissions (user_id, scope)
VALUES
  ('00000000-0000-0000-0000-000000000101', 'identity:issue_portal_token'),
  ('00000000-0000-0000-0000-000000000101', 'identity:read_users'),
  ('00000000-0000-0000-0000-000000000101', 'identity:manage_users'),
  ('00000000-0000-0000-0000-000000000101', 'quotes:create'),
  ('00000000-0000-0000-0000-000000000101', 'quotes:approve'),
  ('00000000-0000-0000-0000-000000000101', 'jobs:create'),
  ('00000000-0000-0000-0000-000000000101', 'jobs:manage')
ON CONFLICT (user_id, scope) DO NOTHING;

-- Grant permissions to technician user
INSERT INTO permissions (user_id, scope)
VALUES
  ('00000000-0000-0000-0000-000000000102', 'jobs:view'),
  ('00000000-0000-0000-0000-000000000102', 'jobs:update_time'),
  ('00000000-0000-0000-0000-000000000102', 'materials:scan')
ON CONFLICT (user_id, scope) DO NOTHING;

-- Display seeded data
SELECT 'Tenants:' as info;
SELECT id, name, plan FROM tenants;

SELECT 'Users:' as info;
SELECT id, email, name, role FROM users;

SELECT 'Permissions:' as info;
SELECT u.email, p.scope
FROM permissions p
JOIN users u ON p.user_id = u.id
ORDER BY u.email, p.scope;
