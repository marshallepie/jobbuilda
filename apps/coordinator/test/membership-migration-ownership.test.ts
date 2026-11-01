import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
const identityMigration = path.join(
  repositoryRoot,
  'services/identity-mcp/migrations/5_add_auth_tenant_memberships.sql',
);
const legacyCoordinatorMigration = path.join(
  repositoryRoot,
  'apps/coordinator/migrations/002_server_auth_tenant_memberships.sql',
);

test('tenant membership migration is identity-owned and narrowly ACL-contained', () => {
  assert.equal(existsSync(identityMigration), true, 'identity-owned membership migration must exist');
  assert.equal(existsSync(legacyCoordinatorMigration), false, 'coordinator must not own the membership migration');

  const sql = readFileSync(identityMigration, 'utf8');
  assert.match(sql, /to_regclass\('public\.auth_tenant_memberships'\)/);
  assert.match(sql, /RAISE EXCEPTION[\s\S]*existing public\.auth_tenant_memberships/i);
  assert.match(sql, /FOREIGN KEY \(user_id, tenant_id\)[\s\S]*REFERENCES public\.users \(id, tenant_id\)/i);
  assert.match(sql, /auth_tenant_memberships_one_active_auth_user/);
  assert.match(sql, /auth_tenant_memberships_one_active_app_user/);
  assert.match(sql, /REVOKE ALL PRIVILEGES ON TABLE public\.auth_tenant_memberships FROM anon, authenticated, PUBLIC/i);
  assert.doesNotMatch(sql, /REVOKE\s+ALL\s+PRIVILEGES\s+ON\s+ALL\s+(?:TABLES|SEQUENCES)\s+IN\s+SCHEMA\s+public/i);
});
