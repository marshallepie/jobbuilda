import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serviceDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoDir = resolve(serviceDir, '..', '..');
const providerScript = resolve(repoDir, 'docs/provider-sql/20261107_add_auth_tenant_memberships.sql');
const runbook = resolve(repoDir, 'docs/AUTH_TENANT_MEMBERSHIPS_RUNBOOK.md');
const migrationsDir = resolve(serviceDir, 'migrations');
const sql = readFileSync(providerScript, 'utf8');
const guide = readFileSync(runbook, 'utf8');

const regexEscape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function assertCanonicalDefault(artifact, column, expression) {
  assert.match(
    artifact,
    new RegExp(
      `a\\.attrelid = membership_oid\\s+AND a\\.attname = '${regexEscape(column)}'\\s+AND pg_get_expr\\(d\\.adbin, d\\.adrelid\\) = '${regexEscape(expression)}'`,
    ),
    `${column} must have canonical default ${expression}`,
  );
}

test('membership migration is provider-only and has required safety controls', () => {
  assert.equal(existsSync(providerScript), true, 'provider script must exist');
  assert.equal(existsSync(runbook), true, 'operator runbook must exist');
  assert.equal(
    readdirSync(migrationsDir).some((name) => name.includes('auth_tenant_memberships')),
    false,
    'node-pg-migrate must not discover the provider-owned membership script',
  );

  for (const required of [
    'BEGIN;',
    'COMMIT;',
    'FOREIGN KEY (user_id, tenant_id) REFERENCES public.users (id, tenant_id)',
    'Legacy full-history UNIQUE(auth_user_id, user_id, tenant_id) is incompatible',
    'compatibility evidence: the catalog definition must be the required definition',
    'CREATE TABLE IF NOT EXISTS does not repair defaults on an existing relation',
    'Existing auth_tenant_memberships defaults are incompatible',
    "pg_get_expr(i.indpred, i.indrelid)",
    'i.indnkeyatts = 1 AND i.indnatts = 1',
    'i.indnkeyatts = 3 AND i.indnatts = 3',
    'i.indkey::smallint[] = ARRAY[',
    "pg_get_expr(i.indpred, i.indrelid) = '((status = ''active''::text) AND (revoked_at IS NULL))'",
    "confrelid = 'public.users'::regclass",
    'auth_tenant_memberships_one_active_auth_user',
    'auth_tenant_memberships_one_active_app_user',
    'ENABLE ROW LEVEL SECURITY',
    'REVOKE ALL PRIVILEGES ON TABLE public.auth_tenant_memberships FROM anon, authenticated, PUBLIC',
    'never reads email or auth metadata',
  ]) assert.match(sql, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  for (const [column, expression] of [
    ['id', 'gen_random_uuid()'],
    ['status', "''active''::text"],
    ['created_at', 'now()'],
    ['activated_at', 'now()'],
  ]) assertCanonicalDefault(sql, column, expression);

  assert.doesNotMatch(sql, /INSERT\s+INTO\s+public\.auth_tenant_memberships/i);
  assert.doesNotMatch(sql, /ADD\s+CONSTRAINT\s+\S+\s+UNIQUE\s*\(\s*auth_user_id\s*,\s*user_id\s*,\s*tenant_id\s*\)/i);
  assert.doesNotMatch(sql, /pg_get_indexdef\(i\.indexrelid\)\s+LIKE/i);
  assert.doesNotMatch(sql, /pg_get_expr\(i\.indpred, i\.indrelid\)\s+LIKE/i);
  assert.ok(
    sql.indexOf('ADD CONSTRAINT users_id_tenant_id_key UNIQUE (id, tenant_id)')
      < sql.indexOf('CREATE TABLE IF NOT EXISTS public.auth_tenant_memberships'),
    'the referenced composite key must exist before the membership foreign key',
  );
  assert.match(guide, /Use only the Supabase Dashboard SQL Editor/);
  assert.match(guide, /Do \*\*not\*\* run `pnpm db:migrate`, `node-pg-migrate`,\s*`psql`/);
  assert.match(guide, /Required provider preflight — no write/);
  assert.match(guide, /Exact repeat-run/);
  assert.match(guide, /Incompatible existing relation\/object/);
  assert.match(guide, /Duplicate active bindings/);
  assert.match(guide, /Revoke then rebind/);
  assert.match(guide, /Tenant mismatch/);
  assert.match(guide, /Browser role denial/);
  assert.match(guide, /Coordinator runtime role/);
  assert.match(guide, /SELECT-only/);
  assert.match(guide, /Readback — required before mapping or application release/);
  assert.match(guide, /does not reject unrelated supplemental indexes/);
  assert.match(guide, /default_expression/);
  assert.match(guide, /canonical defaults are required exactly/);
  assert.match(guide, /SELECT count\(\*\) AS policy_count\s+FROM pg_policies/);
  assert.match(guide, /policy_count.*must be `0`/);
});

test('canonical activated_at default assertion rejects an altered expectation', () => {
  const altered = sql.replace(
    "a.attrelid = membership_oid AND a.attname = 'activated_at'\n      AND pg_get_expr(d.adbin, d.adrelid) = 'now()'",
    "a.attrelid = membership_oid AND a.attname = 'activated_at'\n      AND pg_get_expr(d.adbin, d.adrelid) = 'CURRENT_TIMESTAMP'",
  );

  assert.notEqual(altered, sql, 'test mutation must alter the activated_at expected default');
  assert.throws(() => assertCanonicalDefault(altered, 'activated_at', 'now()'));
});
