import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  DIRECT_RUNTIME_CONNECT_TIMEOUT_MS,
  DIRECT_RUNTIME_STATEMENT_TIMEOUT_MS,
  runProbe,
} from '../scripts/probe-membership-rehearsal-runtime.mjs';

const serviceDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoDir = resolve(serviceDir, '..', '..');
const providerScript = resolve(repoDir, 'docs/provider-sql/20261107_add_auth_tenant_memberships.sql');
const runbook = resolve(repoDir, 'docs/AUTH_TENANT_MEMBERSHIPS_RUNBOOK.md');
const workflow = resolve(repoDir, '.github/workflows/membership-migration-artifact.yml');
const coordinatorDb = resolve(repoDir, 'apps/coordinator/src/lib/db.ts');
const probeScript = resolve(serviceDir, 'scripts/probe-membership-rehearsal-runtime.mjs');
const migrationsDir = resolve(serviceDir, 'migrations');
const sql = readFileSync(providerScript, 'utf8');
const guide = readFileSync(runbook, 'utf8');
const workflowSource = readFileSync(workflow, 'utf8');
const coordinatorDbSource = readFileSync(coordinatorDb, 'utf8');
const probeSource = readFileSync(probeScript, 'utf8');

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

const coordinatorPreflightHeading = '### Coordinator `DATABASE_URL` runtime-role preflight — required, no write';
const staffAuthorizationHeading = '## Authorize one existing staff principal — separate approved operation';
const postApplySchemaReadbackHeading = '## Post-apply schema readback — required before coordinator grant, mapping, or application release';
const postGrantCoordinatorVerificationHeading = '## Post-grant coordinator-role verification — required before mapping or application release';

function sectionAfterHeading(markdown, heading) {
  const headingOffset = markdown.indexOf(heading);
  assert.notEqual(headingOffset, -1, `runbook must contain ${heading}`);
  const afterHeading = markdown.slice(headingOffset + heading.length);
  const nextSectionOffset = afterHeading.indexOf('\n## ');
  return nextSectionOffset === -1 ? afterHeading : afterHeading.slice(0, nextSectionOffset);
}

function firstSqlBlockAfterHeading(markdown, heading) {
  const headingOffset = markdown.indexOf(heading);
  assert.notEqual(headingOffset, -1, `runbook must contain ${heading}`);
  const afterHeading = markdown.slice(headingOffset + heading.length);
  const match = afterHeading.match(/^```sql\n([\s\S]*?)^```/m);
  assert.ok(match, `${heading} must be followed by a SQL code block`);
  return match[1];
}

function assertStaffAuthorizationSqlBlock(block) {
  assert.equal(
    (block.match(/NULL::uuid/g) ?? []).length,
    3,
    'staff authorization must expose exactly three UUID placeholders',
  );
  for (const required of [
    'BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;',
    'reviewed_auth_user_id uuid := NULL::uuid',
    'reviewed_user_id uuid := NULL::uuid',
    'reviewed_tenant_id uuid := NULL::uuid',
    'FROM public.users AS app_user',
    'app_user.id = reviewed_user_id',
    'app_user.tenant_id = reviewed_tenant_id',
    'IF exact_app_user_count = 0 THEN',
    'ELSIF exact_app_user_count > 1 THEN',
    'membership.auth_user_id = reviewed_auth_user_id',
    'membership.user_id = reviewed_user_id',
    "membership.status = 'active'",
    'membership.revoked_at IS NULL',
    'IF active_auth_binding_count > 0 THEN',
    'IF active_app_binding_count > 0 THEN',
    'INSERT INTO public.auth_tenant_memberships (auth_user_id, user_id, tenant_id)',
    'RETURNING id INTO inserted_membership_id;',
    "set_config('app.reviewed_auth_user_id', reviewed_auth_user_id::text, true)",
    "set_config('app.reviewed_user_id', reviewed_user_id::text, true)",
    "set_config('app.reviewed_tenant_id', reviewed_tenant_id::text, true)",
    'INTO final_active_tuple_count',
    'membership.auth_user_id = reviewed_auth_user_id',
    'membership.user_id = reviewed_user_id',
    'membership.tenant_id = reviewed_tenant_id',
    'IF final_active_tuple_count <> 1 THEN',
    "auth_user_id = current_setting('app.reviewed_auth_user_id', true)::uuid",
    "user_id = current_setting('app.reviewed_user_id', true)::uuid",
    "tenant_id = current_setting('app.reviewed_tenant_id', true)::uuid",
    'COMMIT;',
  ]) assert.match(block, new RegExp(regexEscape(required)));

  assert.equal(
    (block.match(/INSERT\s+INTO\s+public\.auth_tenant_memberships\b/gi) ?? []).length,
    1,
    'staff authorization must contain exactly one membership INSERT',
  );
  assert.doesNotMatch(block, /\bauth\.users\b|\bemail\b|\bmetadata\b/i,
    'staff authorization must not look up auth.users, email, or metadata');
  assert.ok(
    block.indexOf('FROM public.users AS app_user')
      < block.indexOf('INSERT INTO public.auth_tenant_memberships'),
    'exact public.users validation must precede the membership insert',
  );
  assert.ok(
    block.indexOf('IF active_auth_binding_count > 0 THEN')
      < block.indexOf('INSERT INTO public.auth_tenant_memberships'),
    'active auth-user conflict check must precede the membership insert',
  );
  assert.ok(
    block.indexOf('IF active_app_binding_count > 0 THEN')
      < block.indexOf('INSERT INTO public.auth_tenant_memberships'),
    'active app-user conflict check must precede the membership insert',
  );
  assert.ok(
    block.indexOf("auth_user_id = current_setting('app.reviewed_auth_user_id', true)::uuid")
      > block.indexOf('INSERT INTO public.auth_tenant_memberships'),
    'final readback must follow the membership insert and use the reviewed auth-user tuple value',
  );
}

function assertStaffMappingManifestGate(section) {
  const heading = '### Mandatory mapping-manifest gate — before the membership INSERT';
  const headingOffset = section.indexOf(heading);
  const sqlOffset = section.indexOf('```sql');
  assert.notEqual(headingOffset, -1, 'staff authorization must require a mapping-manifest gate');
  assert.notEqual(sqlOffset, -1, 'staff authorization section must contain its SQL block');
  assert.ok(headingOffset < sqlOffset, 'mapping-manifest gate must precede the membership SQL');

  for (const required of [
    '| Exact Auth UUID |',
    '| Exact application user UUID |',
    '| Exact tenant UUID |',
    '| Business label |',
    '| Source and ownership evidence |',
    'Auth-to-app-user, app-user-to-tenant, and Auth-to-tenant relational edge',
    'three-UUID tuple verbatim',
    'Revalidate the\nverbatim tuple against the manifest immediately before execution and against the\nfinal SQL query before approval',
    '**NO MAPPING PROPOSED**',
  ]) assert.match(section, new RegExp(regexEscape(required)));

  assert.match(
    section,
    /This manifest—not email, Auth confirmation, login activity, `auth\.users` lookup,\s+or metadata—is the authority for proposing the mapping\./,
    'email, auth confirmation, login activity, auth lookup, and metadata must not authorize a mapping',
  );
  assert.match(
    section,
    /If the application principal is absent, the\s+tenant is absent, or any required relational edge lacks source\/ownership evidence,\s+record \*\*NO MAPPING PROPOSED\*\*/,
    'missing application principal, tenant, or relational evidence must fail closed as NO MAPPING PROPOSED',
  );
  assert.match(
    section,
    /Do not run the INSERT, infer a link,\s+or use a different identifier to fill the gap/,
    'a missing mapping edge must prohibit the insert and identifier substitution',
  );
}

function assertCoordinatorRuntimeRolePreflight(block) {
  for (const required of [
    "configured_role name := NULL::name",
    'SELECT oid INTO coordinator_role FROM pg_roles WHERE rolname = configured_role',
    'NOT rolcanlogin',
    "has_table_privilege(coordinator_role, membership_table, 'SELECT')",
    "ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']",
    'IF EXISTS (SELECT 1 FROM pg_class WHERE oid = membership_table AND relowner = coordinator_role)',
    'WITH RECURSIVE reachable_roles(role_oid, role_path) AS',
    'JOIN pg_auth_members AS membership ON membership.member = reachable_roles.role_oid',
    'WHERE NOT membership.roleid = ANY (reachable_roles.role_path)',
    'relation.relowner = reachable_roles.role_oid',
    'OR role.rolsuper',
    'OR role.rolbypassrls',
    "OR has_table_privilege(reachable_roles.role_oid, membership_table, 'INSERT')",
    "OR has_table_privilege(reachable_roles.role_oid, membership_table, 'UPDATE')",
    "OR has_table_privilege(reachable_roles.role_oid, membership_table, 'DELETE')",
    "OR has_table_privilege(reachable_roles.role_oid, membership_table, 'TRUNCATE')",
    "OR has_table_privilege(reachable_roles.role_oid, membership_table, 'REFERENCES')",
    "OR has_table_privilege(reachable_roles.role_oid, membership_table, 'TRIGGER')",
  ]) assert.match(block, new RegExp(regexEscape(required)));

  assert.match(
    block,
    /WHERE oid = coordinator_role AND \(NOT rolcanlogin OR rolsuper OR rolbypassrls\)/,
    'configured role must have LOGIN and be rejected when superuser or BYPASSRLS',
  );
}

function assertPopulatedMembershipGuard(artifact) {
  const guard = artifact.slice(
    artifact.indexOf('-- A populated mapping table is never an idempotent reapply:'),
    artifact.indexOf('CREATE EXTENSION IF NOT EXISTS pgcrypto;'),
  );
  assert.match(
    guard,
    /SET LOCAL lock_timeout = '5s';\s+BEGIN\s+EXECUTE 'LOCK TABLE public\.auth_tenant_memberships IN ACCESS EXCLUSIVE MODE';\s+EXCEPTION\s+WHEN lock_not_available THEN\s+RAISE EXCEPTION 'Could not acquire ACCESS EXCLUSIVE lock on public\.auth_tenant_memberships within 5 seconds; a conflicting transaction is active\. No DDL was applied; wait for it to finish and retry the complete script\.';\s+END;\s+EXECUTE 'SELECT EXISTS \(SELECT 1 FROM public\.auth_tenant_memberships\)'\s+INTO membership_has_rows;/s,
    'the pre-DDL guard must use a transaction-local bounded ACCESS EXCLUSIVE lock, fail clearly on contention, and query only after locking',
  );
  assert.match(
    guard,
    /IF membership_has_rows THEN\s+RAISE EXCEPTION 'Existing public\.auth_tenant_memberships contains rows; stop before DDL and use the approved mapping lifecycle';/s,
    'a populated membership table must fail closed before DDL',
  );

  const guardOffset = artifact.indexOf('-- A populated mapping table is never an idempotent reapply:');
  assert.notEqual(guardOffset, -1, 'the populated-membership guard must exist');
  for (const ddl of [
    'CREATE EXTENSION IF NOT EXISTS pgcrypto;',
    'ALTER TABLE public.users ADD CONSTRAINT users_id_tenant_id_key UNIQUE (id, tenant_id);',
    'CREATE TABLE IF NOT EXISTS public.auth_tenant_memberships',
  ]) {
    const ddlOffset = artifact.indexOf(ddl);
    assert.notEqual(ddlOffset, -1, `migration must include ${ddl}`);
    assert.ok(guardOffset < ddlOffset, `populated-membership guard must occur before ${ddl}`);
  }
}

function assertLifecycleUniqueIndexPreflight(artifact) {
  const guard = artifact.slice(
    artifact.indexOf('-- A populated mapping table is never an idempotent reapply:'),
    artifact.indexOf('CREATE EXTENSION IF NOT EXISTS pgcrypto;'),
  );
  for (const required of [
    'FROM pg_index i',
    'AND i.indisunique',
    'AND NOT (',
    'i.indisprimary',
    'i.indnkeyatts = 1 AND i.indnatts = 1',
    'i.indexprs IS NULL',
    'i.indpred IS NULL',
    'ARRAY[id_attnum]::smallint[]',
    'ARRAY[auth_user_id_attnum]::smallint[]',
    'ARRAY[user_id_attnum]::smallint[]',
    "pg_get_expr(i.indpred, i.indrelid) = '((status = ''active''::text) AND (revoked_at IS NULL))'",
    'Existing unique index or constraint is incompatible',
  ]) assert.match(guard, new RegExp(regexEscape(required)));
  assert.equal((guard.match(/AND i\.indexprs IS NULL/g) ?? []).length, 3,
    'only the three direct-key canonical unique shapes may avoid expression keys');
  assert.equal((guard.match(/i\.indnkeyatts = 1 AND i\.indnatts = 1/g) ?? []).length, 3,
    'the canonical primary and active-only unique shapes must have no INCLUDE columns');
  assert.equal((guard.match(/pg_get_expr\(i\.indpred, i\.indrelid\) = '\(\(status = ''active''::text\) AND \(revoked_at IS NULL\)\)'/g) ?? []).length, 2,
    'both active-only canonical identity keys must retain the exact predicate');
}
function assertWorkflowSelfTrigger(artifact) {
  for (const trigger of ['push', 'pull_request']) {
    const triggerPaths = artifact.match(new RegExp(
      `^  ${trigger}:\\n    paths:\\n((?:      - .+\\n)+)`,
      'm',
    ))?.[1];
    assert.ok(triggerPaths, `${trigger} must declare a paths filter`);
    for (const [path, purpose] of [
      ['.github/workflows/membership-migration-artifact.yml', 'workflow-only edits validate it'],
      ['services/identity-mcp/scripts/probe-membership-rehearsal-runtime.mjs', 'direct-runtime probe edits validate it'],
    ]) {
      assert.match(
        triggerPaths,
        new RegExp(`^      - ${regexEscape(path)}$`, 'm'),
        `${trigger} paths must include ${path} so ${purpose}`,
      );
    }
  }
}

function assertRuntimeLookupPolicy(artifact) {
  assert.match(
    artifact,
    /CREATE POLICY auth_tenant_memberships_runtime_select\s+ON public\.auth_tenant_memberships\s+FOR SELECT\s+TO PUBLIC\s+USING \(current_user = session_user\);/s,
    'the policy must allow only a direct runtime login; the table ACL supplies the exact-role boundary',
  );
  assert.match(
    artifact,
    /REVOKE ALL PRIVILEGES ON TABLE public\.auth_tenant_memberships FROM anon, authenticated, PUBLIC;[\s\S]*?CREATE POLICY auth_tenant_memberships_runtime_select/s,
    'browser/PUBLIC privilege revocation must precede the public policy',
  );
  assert.doesNotMatch(artifact, /CREATE POLICY[\s\S]*?FOR ALL/s, 'runtime policy must not authorize mutations');
}

function assertExistingRelationAclPreflight(artifact) {
  assert.match(
    artifact,
    /FROM pg_class c\s+CROSS JOIN LATERAL aclexplode\(coalesce\(c\.relacl, acldefault\('r', c\.relowner\)\)\) acl\s+LEFT JOIN pg_roles r ON r\.oid = acl\.grantee\s+WHERE c\.oid = membership_oid\s+AND acl\.grantee <> c\.relowner\s+AND r\.rolname IS DISTINCT FROM 'service_role'/s,
    'a pre-existing membership relation may tolerate only service_role relation ACLs',
  );
  assert.match(
    artifact,
    /JOIN pg_attribute a ON a\.attrelid = c\.oid\s+CROSS JOIN LATERAL aclexplode\(coalesce\(a\.attacl, acldefault\('c', c\.relowner\)\)\) acl\s+WHERE c\.oid = membership_oid\s+AND a\.attnum > 0\s+AND NOT a\.attisdropped\s+AND acl\.grantee <> c\.relowner/s,
    'a pre-existing membership relation must reject every non-owner column ACL',
  );
  assert.match(
    artifact,
    /Existing auth_tenant_memberships RLS or ACLs are incompatible; expected RLS enabled, only legacy service_role relation ACLs, and no non-owner column ACLs/,
  );
}

function assertServiceRoleRemediationAndPostDdlAclAssertions(artifact) {
  const createTableOffset = artifact.indexOf('CREATE TABLE IF NOT EXISTS public.auth_tenant_memberships');
  const revoke = 'REVOKE ALL PRIVILEGES ON TABLE public.auth_tenant_memberships FROM service_role;';
  const revokeOffset = artifact.indexOf(revoke);
  assert.notEqual(createTableOffset, -1, 'membership table creation must exist');
  assert.ok(revokeOffset > createTableOffset, 'service_role revoke must occur after CREATE TABLE IF NOT EXISTS');
  assert.ok(
    revokeOffset < artifact.indexOf('CREATE UNIQUE INDEX IF NOT EXISTS auth_tenant_memberships_one_active_auth_user'),
    'service_role revoke must precede subsequent membership DDL',
  );

  const postPolicy = artifact.slice(artifact.indexOf('CREATE POLICY auth_tenant_memberships_runtime_select'));
  assert.match(
    postPolicy,
    /remaining non-owner relation or column ACL[\s\S]*?FROM pg_class c\s+CROSS JOIN LATERAL aclexplode\(coalesce\(c\.relacl, acldefault\('r', c\.relowner\)\)\) acl\s+WHERE c\.oid = 'public\.auth_tenant_memberships'::regclass\s+AND acl\.grantee <> c\.relowner[\s\S]*?non-owner direct table ACLs after DDL/s,
    'post-DDL assertion must reject every remaining non-owner relation ACL',
  );
  assert.match(
    postPolicy,
    /JOIN pg_attribute a ON a\.attrelid = c\.oid\s+CROSS JOIN LATERAL aclexplode\(coalesce\(a\.attacl, acldefault\('c', c\.relowner\)\)\) acl\s+WHERE c\.oid = 'public\.auth_tenant_memberships'::regclass\s+AND a\.attnum > 0\s+AND NOT a\.attisdropped\s+AND acl\.grantee <> c\.relowner[\s\S]*?non-owner column ACLs after DDL/s,
    'post-DDL assertion must reject every non-owner column ACL',
  );
}

function assertLifecycleGuardFunctionOwnership(artifact, markdown) {
  const ownershipGuard = artifact.slice(
    artifact.indexOf('-- This function is provider-owned only when it is absent or already belongs'),
    artifact.indexOf('CREATE OR REPLACE FUNCTION public.auth_tenant_memberships_lifecycle_guard()'),
  );
  assert.match(ownershipGuard, /lifecycle_guard_oid oid := to_regprocedure\('public\.auth_tenant_memberships_lifecycle_guard\(\)'\)/);
  assert.match(ownershipGuard, /FROM pg_trigger trigger\s+WHERE trigger\.tgfoid = lifecycle_guard_oid\) <> 2/s,
    'an existing lifecycle guard must have exactly two trigger references');
  for (const [name, type] of [
    ['auth_tenant_memberships_lifecycle_guard', '31'],
    ['auth_tenant_memberships_no_truncate', '34'],
  ]) {
    assert.match(
      ownershipGuard,
      new RegExp(String.raw`trigger\.tgfoid = lifecycle_guard_oid[\s\S]*?trigger\.tgrelid = 'public\.auth_tenant_memberships'::regclass[\s\S]*?trigger\.tgname = '${name}'[\s\S]*?NOT trigger\.tgisinternal[\s\S]*?trigger\.tgenabled = 'O'[\s\S]*?trigger\.tgtype = ${type}`),
      `the existing lifecycle guard may be referenced only by canonical ${name}`,
    );
  }
  assert.match(ownershipGuard, /stop before replacing the function or changing its ACL/);
  assert.ok(ownershipGuard.length > 0, 'function ownership guard must precede CREATE OR REPLACE');
  assert.ok(
    artifact.indexOf('END $$;', artifact.indexOf('-- This function is provider-owned only when it is absent or already belongs'))
      < artifact.indexOf('REVOKE ALL ON FUNCTION public.auth_tenant_memberships_lifecycle_guard() FROM PUBLIC;'),
    'function ownership guard must precede the function ACL revoke',
  );

  const preflight = firstSqlBlockAfterHeading(markdown, '## Required provider preflight — no write');
  for (const required of [
    "to_regprocedure('public.auth_tenant_memberships_lifecycle_guard()') AS oid",
    'LEFT JOIN pg_trigger AS trigger ON trigger.tgfoid = lifecycle_guard.oid',
    'trigger.tgrelid::regclass AS trigger_relation',
    'pg_get_triggerdef(trigger.oid) AS trigger_definition',
  ]) assert.match(preflight, new RegExp(regexEscape(required)));
  assert.match(markdown, new RegExp(regexEscape(
    'safe to replace only when absent or referenced by\n-- exactly these two canonical triggers on this relation',
  )));
  assert.match(markdown, new RegExp(regexEscape(
    'Any other result is a\n-- stop condition; do not apply the script or repair the dependency by hand',
  )));
}

function assertLifecycleTriggerReplacementPreflight(artifact) {
  const preflightStart = artifact.indexOf('-- DROP TRIGGER IF EXISTS matches by trigger name, not function or trigger shape.');
  const firstDrop = artifact.indexOf('DROP TRIGGER IF EXISTS auth_tenant_memberships_lifecycle_guard');
  const secondDrop = artifact.indexOf('DROP TRIGGER IF EXISTS auth_tenant_memberships_no_truncate');
  const firstCreate = artifact.indexOf('CREATE TRIGGER auth_tenant_memberships_lifecycle_guard');
  assert.notEqual(preflightStart, -1, 'trigger replacement preflight must exist');
  assert.notEqual(firstDrop, -1, 'lifecycle trigger drop must exist');
  assert.notEqual(secondDrop, -1, 'truncate trigger drop must exist');
  assert.notEqual(firstCreate, -1, 'lifecycle trigger recreation must exist');
  assert.ok(preflightStart < firstDrop, 'trigger replacement preflight must precede the lifecycle trigger drop');
  assert.ok(preflightStart < secondDrop, 'trigger replacement preflight must precede the truncate trigger drop');
  assert.ok(preflightStart < firstCreate, 'trigger replacement preflight must precede trigger recreation');

  const preflight = artifact.slice(preflightStart, firstDrop);
  assert.match(preflight, /DO \$\$\s+BEGIN\s+IF \(SELECT count\(\*\)[\s\S]*?AND NOT trigger\.tgisinternal\) <> 0\s+AND \([\s\S]*?AND NOT trigger\.tgisinternal\) <> 2/s,
    'preflight must permit zero user triggers and otherwise require exactly two');
  for (const [name, type] of [
    ['auth_tenant_memberships_lifecycle_guard', '31'],
    ['auth_tenant_memberships_no_truncate', '34'],
  ]) {
    const triggerStart = preflight.indexOf(`trigger.tgname = '${name}'`);
    assert.notEqual(triggerStart, -1, `preflight must inspect ${name}`);
    const triggerCheckEnd = preflight.indexOf('::regprocedure', triggerStart);
    assert.notEqual(triggerCheckEnd, -1, `preflight must bind ${name} to a function identity`);
    const triggerCheck = preflight.slice(triggerStart, triggerCheckEnd + '::regprocedure'.length);
    assert.match(
      triggerCheck,
      new RegExp(String.raw`trigger\.tgname = '${name}'[\s\S]*?NOT trigger\.tgisinternal[\s\S]*?trigger\.tgenabled = 'O'[\s\S]*?trigger\.tgtype = ${type}[\s\S]*?trigger\.tgfoid = 'public\.auth_tenant_memberships_lifecycle_guard\(\)'::regprocedure`),
      `preflight must require the enabled canonical ${name} trigger and lifecycle function identity`,
    );
  }
  assert.match(preflight, /stop before DROP TRIGGER\. Expected zero user triggers or exactly the two enabled canonical lifecycle triggers/,
    'preflight must report a clear fail-closed stop condition');
}

function assertMembershipLifecycleGuard(artifact) {
  for (const required of [
    'CREATE OR REPLACE FUNCTION public.auth_tenant_memberships_lifecycle_guard()',
    "IF TG_OP = 'DELETE' OR TG_OP = 'TRUNCATE' THEN",
    "IF TG_OP = 'INSERT' THEN",
    "NEW.status <> 'active' OR NEW.revoked_at IS NOT NULL OR NEW.revoked_reason IS NOT NULL",
    'NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id',
    'NEW.user_id IS DISTINCT FROM OLD.user_id',
    'NEW.tenant_id IS DISTINCT FROM OLD.tenant_id',
    'NEW.created_at IS DISTINCT FROM OLD.created_at',
    'NEW.activated_at IS DISTINCT FROM OLD.activated_at',
    "IF OLD.status <> 'active' OR OLD.revoked_at IS NOT NULL OR OLD.revoked_reason IS NOT NULL THEN",
    "IF NEW.status <> 'revoked'",
    'OR NEW.revoked_at IS NULL',
    'OR NEW.revoked_at < OLD.activated_at',
    "OR btrim(NEW.revoked_reason) = ''",
    'REVOKE ALL ON FUNCTION public.auth_tenant_memberships_lifecycle_guard() FROM PUBLIC;',
    'CREATE TRIGGER auth_tenant_memberships_lifecycle_guard',
    'BEFORE INSERT OR UPDATE OR DELETE ON public.auth_tenant_memberships',
    'CREATE TRIGGER auth_tenant_memberships_no_truncate',
    'BEFORE TRUNCATE ON public.auth_tenant_memberships',
    'trigger.tgtype = 31',
    'trigger.tgtype = 34',
    "trigger.tgfoid = 'public.auth_tenant_memberships_lifecycle_guard()'::regprocedure",
    "WHERE tgrelid = 'public.auth_tenant_memberships'::regclass\n        AND NOT tgisinternal) <> 2",
  ]) assert.match(artifact, new RegExp(regexEscape(required)));
  assert.equal(
    (artifact.match(/^CREATE TRIGGER /gm) ?? []).length,
    2,
    'the relation must define exactly the two canonical triggers, with no supplemental trigger definition',
  );
  const triggerPostcondition = artifact.slice(
    artifact.indexOf('-- CREATE TRIGGER has no IF NOT EXISTS.'),
    artifact.indexOf('ALTER TABLE public.auth_tenant_memberships ENABLE ROW LEVEL SECURITY;'),
  );
  assert.equal(
    (triggerPostcondition.match(/trigger\.tgenabled = 'O'/g) ?? []).length,
    2,
    'both recreated canonical triggers must be enabled',
  );
  assert.equal(
    (triggerPostcondition.match(/trigger\.tgfoid = 'public\.auth_tenant_memberships_lifecycle_guard\(\)'::regprocedure/g) ?? []).length,
    2,
    'both recreated canonical triggers must resolve to the exact lifecycle guard function identity',
  );
  assert.equal(
    (artifact.match(/WHERE status = 'active' AND revoked_at IS NULL;/g) ?? []).length,
    3,
    'the two one-active unique indexes and active lookup index must retain active-only rebind predicates',
  );
}

function assertDirectRuntimeEvidenceBoundary(markdown) {
  for (const required of [
    'SQL Editor evidence is deliberately limited to schema,\ncatalog, lifecycle, and RLS-negative rehearsal.',
    'current_user <> session_user',
    'Mandatory direct coordinator-role positive probe — disposable target only',
    'former `afygozgefepayoenwccl`',
    'retired and forbidden',
    'fresh approved, addressable disposable\nbranch decision',
    'provider cost approval',
    'status `ACTIVE_HEALTHY`; and `with_data=false`',
    'clean no-membership baseline',
    'Do not reset,\nreuse, repair, or fall back to another branch, the parent, or production',
    'MEMBERSHIP_REHEARSAL_TARGET_REF`, immutable',
    'MEMBERSHIP_REHEARSAL_PARENT_REF=jnwxueomquywrqcgbgfd',
    'MEMBERSHIP_REHEARSAL_RUNTIME_ROLE',
    'MEMBERSHIP_REHEARSAL_DB_HOST',
    'MEMBERSHIP_REHEARSAL_DB_PORT',
    'MEMBERSHIP_REHEARSAL_DB_NAME',
    'MEMBERSHIP_REHEARSAL_DATABASE_URL',
    'distinct correctly formatted Supabase project ref',
    '**Two independent gates are mandatory.** **(A) Provider discovery and approval**',
    'plus Dashboard verification establish the selected branch\'s parent, status,\n`with_data`, and addressability.',
    '**(B) The Node probe** validates only the\nsupplied target-ref format, immutable parent ref, target/parent inequality and\nretired-target denial, direct host/port/database, runtime role, and URL tuple.',
    'It does not query the provider control plane or Dashboard and cannot prove provider\napproval, branch parent, status, `with_data`, or addressability. If the required\nprovider evidence is absent, do not run the Node probe.',
    'direct endpoint is exactly `db.<target-ref>.supabase.co:5432/postgres`',
    'There is **no\nprovider fallback and no production fallback**',
    'Node.js 20.11 or\nnewer',
    'exactly **5,000 ms** for the `pg` `connectionTimeoutMillis`, `query_timeout`,\nand server `statement_timeout` options',
    'fails the probe nonzero with the fixed redacted failure message',
    'current_user = session_user AS direct_login_identity',
    'Bind\n`$4` to the exact reviewed non-secret `MEMBERSHIP_REHEARSAL_RUNTIME_ROLE`',
    'server-side exact configured-role identity comparison',
    'current_user = $4::name AS configured_runtime_role_identity',
    'configured_runtime_role_identity = true',
    'active_membership_count = 1',
    'do not record the URL, password, full connection string, raw\nquery parameters, or server error text',
  ]) assert.match(markdown, new RegExp(regexEscape(required)));
}

function assertRestrictedDirectRuntimeProbe(artifact) {
  for (const required of [
    "const EXPECTED_PARENT_REF = 'jnwxueomquywrqcgbgfd';",
    "const RETIRED_TARGET_REF = 'afygozgefepayoenwccl';",
    'const SUPABASE_PROJECT_REF = /^[a-z]{20}$/;',
    "const APPROVED_DIRECT_PORT = '5432';",
    "const APPROVED_DATABASE_NAME = 'postgres';",
    'export const DIRECT_RUNTIME_CONNECT_TIMEOUT_MS = 5_000;',
    'export const DIRECT_RUNTIME_STATEMENT_TIMEOUT_MS = 5_000;',
    "'MEMBERSHIP_REHEARSAL_DATABASE_URL'",
    'if (environment.DATABASE_URL?.trim())',
    "throw new Error('DATABASE_URL fallback is forbidden')",
    'new URL(values.MEMBERSHIP_REHEARSAL_DATABASE_URL)',
    'values.MEMBERSHIP_REHEARSAL_TARGET_REF === EXPECTED_PARENT_REF',
    'values.MEMBERSHIP_REHEARSAL_TARGET_REF === RETIRED_TARGET_REF',
    'url.hostname.toLowerCase() !== `db.${values.MEMBERSHIP_REHEARSAL_TARGET_REF}.supabase.co`',
    'url.port !== APPROVED_DIRECT_PORT',
    'decodeURIComponent(url.pathname.slice(1)) !== APPROVED_DATABASE_NAME',
    'decodeURIComponent(url.username) !== values.MEMBERSHIP_REHEARSAL_RUNTIME_ROLE',
    "runtimeRole === 'service_role' || runtimeRole === 'postgres' || runtimeRole.startsWith('supabase_')",
    'new ClientConstructor({',
    'connectionTimeoutMillis: DIRECT_RUNTIME_CONNECT_TIMEOUT_MS',
    'query_timeout: DIRECT_RUNTIME_STATEMENT_TIMEOUT_MS',
    'statement_timeout: DIRECT_RUNTIME_STATEMENT_TIMEOUT_MS',
    'await client.connect()',
    'await client.query({',
    'text: QUERY',
    'MEMBERSHIP_REHEARSAL_AUTH_USER_ID',
    'MEMBERSHIP_REHEARSAL_USER_ID',
    'MEMBERSHIP_REHEARSAL_TENANT_ID',
    'current_user = session_user AS direct_login_identity',
    'current_user = $4::name AS configured_runtime_role_identity',
    'active_membership_count',
    'rowMode: \'array\'',
    'directLogin !== true || configuredRole !== true || Number(activeCount) !== 1',
    "await client.end().catch(() => {})",
    'function isDirectCliEntrypoint()',
    'const entrypoint = process.argv[1];',
    "typeof entrypoint === 'string'",
    'resolve(entrypoint) === fileURLToPath(import.meta.url)',
    'if (isDirectCliEntrypoint()) {',
    'process.exitCode = await runProbe();',
  ]) assert.match(artifact, new RegExp(regexEscape(required)));

  assert.doesNotMatch(artifact, /process\.env\.DATABASE_URL(?!\?\.trim)/, 'probe must never use DATABASE_URL as a connection fallback');
  assert.doesNotMatch(artifact, /\bfetch\(|https?:\/\/|ACTIVE_HEALTHY|with_data\b/i,
    'probe must not perform or claim provider discovery, approval, or branch-status validation');
  assert.doesNotMatch(artifact, /process\.argv(?!\[1\])|dotenv|\.env(?:[/'"]|$)|\bPool\(/, 'probe must not accept CLI credentials, load credential files, or create a pool');
  assert.doesNotMatch(artifact, /import\.meta\.main/, 'probe CLI entrypoint must support Node.js 20.11');
  assert.doesNotMatch(artifact, /INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM|SET ROLE|BEGIN;|COMMIT;/i, 'probe must issue no mutation, role switch, or transaction control');
}

function assertSyntheticFixtureLifecycle(markdown) {
  for (const required of [
    'Synthetic fixture lifecycle and reset isolation',
    'fixture register outside this migration',
    'newly generated UUIDs',
    'public.users.tenant_id` equals the\nfixture tenant',
    'newly approved, addressable\ndisposable branch',
    'Never reuse a branch that contains a malformed table',
    'read back the named\nmalformed object and confirm that it remains unchanged after the provider-script\nrollback',
    'exactly two historical\nrows, exactly one active/unrevoked row',
    'After the positive probe, revoke the active synthetic row',
    'zero active/unrevoked rows and two retained revoked rows',
    'failed cleanup/readback is a\nstop condition',
    'Do not delete history, truncate the membership table, or use a\nproduction or parent project to clean up',
  ]) assert.match(markdown, new RegExp(regexEscape(required)));
}

function assertPostApplyAndPostGrantAclReadback(markdown) {
  const postApply = sectionAfterHeading(markdown, postApplySchemaReadbackHeading);
  const postGrant = sectionAfterHeading(markdown, postGrantCoordinatorVerificationHeading);

  for (const required of [
    'Before the separate coordinator authorization',
    'Do **not** rerun the Coordinator `DATABASE_URL` runtime-role preflight\nat this stage',
    'that preflight requires the separately approved direct coordinator\n`SELECT` grant',
    'both the relation-ACL and column-ACL inventories\nreturn **zero rows**',
  ]) assert.match(postApply, new RegExp(regexEscape(required)));

  for (const required of [
    'Only after the preceding post-apply schema readback has recorded zero non-owner\nrelation and column ACL rows',
    'perform **Authorize the verified coordinator runtime\nlookup — separate approved operation** above. Then rerun the exact **Coordinator\n`DATABASE_URL` runtime-role preflight** block',
    "WHERE relation.oid = 'public.auth_tenant_memberships'::regclass\n  AND acl.grantee <> relation.relowner",
    'AND a.attnum > 0\n  AND NOT a.attisdropped\n  AND acl.grantee <> relation.relowner',
    'relation inventory returns **exactly one**\nnon-owner row—the reviewed coordinator runtime role with `SELECT`',
    'ACL inventory returns **zero rows**',
    'this is a direct grant, no other non-owner `SELECT` grantee exists',
  ]) assert.match(postGrant, new RegExp(regexEscape(required)));
}

test('membership migration is provider-only and has required safety controls', () => {
  assert.equal(existsSync(providerScript), true, 'provider script must exist');
  assert.equal(existsSync(runbook), true, 'operator runbook must exist');
  assert.equal(existsSync(workflow), true, 'artifact workflow must exist');
  assert.equal(existsSync(probeScript), true, 'restricted direct-runtime probe must exist');
  assert.equal(
    readdirSync(migrationsDir).some((name) => name.includes('auth_tenant_memberships')),
    false,
    'node-pg-migrate must not discover the provider-owned membership script',
  );

  for (const required of [
    'BEGIN;',
    'COMMIT;',
    'FOREIGN KEY (user_id, tenant_id) REFERENCES public.users (id, tenant_id)',
    'Existing unique index or constraint is incompatible',
    'JOIN pg_index i ON i.indexrelid = x.oid',
    'i.indrelid IS DISTINCT FROM membership_oid',
    'Canonical auth_tenant_memberships index name is already attached to another relation',
    'AND i.indpred IS NULL',
    "i.indrelid = 'public.auth_tenant_memberships'::regclass",
    'Canonical auth_tenant_memberships indexes must be attached to the membership relation with exact predicates',
    'compatibility evidence: the catalog definition must be the required definition',
    'CREATE TABLE IF NOT EXISTS does not repair defaults on an existing relation',
    'Existing auth_tenant_memberships defaults are incompatible',
    'CREATE TEMPORARY TABLE auth_tenant_memberships_constraint_shape_probe',
    'pg_get_constraintdef(oid) = expected_status_constraint',
    'pg_get_constraintdef(oid) = expected_revocation_lifecycle_constraint',
    'Existing auth_tenant_memberships RLS policy is incompatible; expected only the canonical runtime SELECT policy',
    "pg_get_expr(i.indpred, i.indrelid)",
    'i.indnkeyatts = 1 AND i.indnatts = 1',
    'i.indnkeyatts = 3 AND i.indnatts = 3',
    '(i.indkey::smallint[])[0:2] = ARRAY[',
    "pg_get_expr(i.indpred, i.indrelid) = '((status = ''active''::text) AND (revoked_at IS NULL))'",
    "confrelid = 'public.users'::regclass",
    'auth_tenant_memberships_one_active_auth_user',
    'auth_tenant_memberships_one_active_app_user',
    'ENABLE ROW LEVEL SECURITY',
    'REVOKE ALL PRIVILEGES ON TABLE public.auth_tenant_memberships FROM anon, authenticated, PUBLIC',
    'CREATE POLICY auth_tenant_memberships_runtime_select',
    'USING (current_user = session_user)',
    'never reads email or auth metadata',
  ]) assert.match(sql, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  assertPopulatedMembershipGuard(sql);
  assertLifecycleUniqueIndexPreflight(sql);
  assertLifecycleGuardFunctionOwnership(sql, guide);
  assertLifecycleTriggerReplacementPreflight(sql);
  assertMembershipLifecycleGuard(sql);
  assertExistingRelationAclPreflight(sql);
  assertServiceRoleRemediationAndPostDdlAclAssertions(sql);
  assertWorkflowSelfTrigger(workflowSource);
  assert.match(guide, /canonical relation created by this script \*\*with zero rows\*\*/);
  assert.match(guide, /no non-owner column ACLs/);
  assert.match(guide, /relation\*\* ACLs for `service_role` only/);
  assert.match(guide, /this script revokes\s+those ACLs from this table only after `CREATE TABLE IF NOT EXISTS`/);
  assert.match(guide, /script does not identify or grant the coordinator runtime role/);
  assert.match(guide, /separately\s+approved exact-role `SELECT` grant later in this runbook/);
  assert.match(guide, /Any existing membership row is a stop\s+condition: the script fails before DDL/);
  assert.match(guide, /Existing-membership lock policy and retry/);
  assert.match(guide, /transaction-local `lock_timeout` of \*\*5 seconds\*\* before requesting its\s+`ACCESS EXCLUSIVE` lock/);
  assert.match(guide, /Could not acquire\s+ACCESS EXCLUSIVE lock \.\.\. within 5 seconds/);
  assert.match(guide, /no DDL is applied and the transaction\s+rolls back/);
  assert.match(guide, /retry the \*\*complete\s+unchanged script\*\*/);

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
  assert.doesNotMatch(sql, /pg_get_constraintdef\(oid\)\s+LIKE/i, 'constraint compatibility must not use loose LIKE checks');
  assertRuntimeLookupPolicy(sql);
  assert.ok(
    sql.indexOf('Existing unique index or constraint is incompatible')
      < sql.indexOf('CREATE EXTENSION IF NOT EXISTS pgcrypto;'),
    'non-canonical unique indexes must be rejected before DDL',
  );
  assert.match(sql, /\(i\.indkey::smallint\[\]\)\[0:0\] = ARRAY\[/);
  assert.doesNotMatch(
    sql,
    /i\.indkey::smallint\[\]\s*=\s*ARRAY\[/,
    'int2vector casts are zero-based and must be sliced before comparison to one-based ARRAY literals',
  );
  assert.doesNotMatch(sql, /\(i\.indkey::smallint\[\]\)\[1:3\]/);
  assert.ok(
    sql.indexOf('Canonical auth_tenant_memberships index name is already attached to another relation')
      < sql.indexOf('CREATE TABLE IF NOT EXISTS public.auth_tenant_memberships'),
    'canonical index-name collisions must be rejected before membership DDL',
  );
  const postCreateIndexAssertion = sql.slice(sql.indexOf('-- CREATE INDEX IF NOT EXISTS is not evidence'));
  for (const canonicalIndex of [
    'auth_tenant_memberships_one_active_auth_user',
    'auth_tenant_memberships_one_active_app_user',
    'auth_tenant_memberships_active_lookup',
  ]) assert.match(postCreateIndexAssertion, new RegExp(canonicalIndex));
  assert.match(postCreateIndexAssertion, /\)\) <> 3/);
  assert.match(postCreateIndexAssertion, /pg_get_expr\(i\.indpred, i\.indrelid\) = '\(\(status = ''active''::text\) AND \(revoked_at IS NULL\)\)'/);
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
  assert.match(guide, /Coordinator `DATABASE_URL` runtime-role preflight — required, no write/);
  assert.match(guide, /exact PostgreSQL role name only/);
  assert.match(guide, /has `LOGIN`/);
  assert.match(guide, /Do not infer it from the SQL Editor's `current_user`/);
  assert.match(guide, /no concrete role name is prescribed by R01a/);
  const coordinatorPreflightSql = firstSqlBlockAfterHeading(guide, coordinatorPreflightHeading);
  assertCoordinatorRuntimeRolePreflight(coordinatorPreflightSql);
  const staffAuthorizationSection = sectionAfterHeading(guide, staffAuthorizationHeading);
  assertStaffMappingManifestGate(staffAuthorizationSection);
  const staffAuthorizationSql = firstSqlBlockAfterHeading(guide, staffAuthorizationHeading);
  assertStaffAuthorizationSqlBlock(staffAuthorizationSql);
  assertDirectRuntimeEvidenceBoundary(guide);
  assertRestrictedDirectRuntimeProbe(probeSource);
  assertSyntheticFixtureLifecycle(guide);
  assert.match(guide, /node services\/identity-mcp\/scripts\/probe-membership-rehearsal-runtime\.mjs/);
  assertPostApplyAndPostGrantAclReadback(guide);
  assert.match(guide, /cannot own or ALTER\/DDL public\.auth_tenant_memberships/);
  assert.match(guide, /Authorize the verified coordinator runtime lookup — separate approved operation/);
  assert.match(guide, /direct `SELECT` grant to the reviewed deployment role/);
  assert.match(guide, /EXECUTE format\('GRANT SELECT ON TABLE public\.auth_tenant_memberships TO %I', configured_role\)/);
  assert.match(guide, /only the configured coordinator runtime role may hold non-owner SELECT/);
  assert.match(guide, /Then rerun the exact \*\*Coordinator\s+`DATABASE_URL` runtime-role preflight\*\* block/);
  assert.match(guide, /A changed\/unknown role, a failed preflight/);
  assert.match(
    coordinatorDbSource,
    /new Pool\(\{\s+connectionString: process\.env\.DATABASE_URL,/s,
    'coordinator Pool must use DATABASE_URL for its connection identity',
  );
  assert.doesNotMatch(sql, /^\s*GRANT\b/im, 'provider script must not grant a guessed coordinator role');
  assert.doesNotMatch(sql, /\bpostgres\b/i, 'provider script must not guess a provider superuser role');
  assert.match(guide, /Post-apply schema readback — required before coordinator grant, mapping, or application release/);
  assert.match(guide, /fails closed for every unique index or constraint except the\s+exact canonical `id` primary key/);
  assert.match(guide, /expression-key indexes\s+\(`indkey` attribute `0`\) and semantically all-row predicates such as `WHERE TRUE`/);
  assert.match(guide, /does not reject\s+unrelated supplemental \*\*non-unique\*\* indexes/);
  assert.match(guide, /differently named\s+non-partial multi-column unique indexes containing each of\s+`auth_user_id` and `user_id`/);
  assert.match(guide, /attach one canonical index\s+name to another table/);
  assert.match(guide, /default_expression/);
  assert.match(guide, /canonical defaults are required exactly/);
  assert.match(guide, /SELECT count\(\*\) AS policy_count\s+FROM pg_policies/);
  assert.match(guide, /policy_count.*must be `1`/);
  assert.match(guide, /both the relation-ACL and column-ACL inventories\s+return \*\*zero rows\*\*/);
  assert.match(guide, /REVOKE ALL PRIVILEGES ON TABLE public\.auth_tenant_memberships FROM service_role/);
  assert.match(guide, /table-local and does not change default privileges, roles, or any other\s+table/);
  assert.match(guide, /exact coordinator `SELECT` grant remains the later separately approved\s+operation/);

  const revocationSection = guide.slice(guide.indexOf('## Revoke access'));
  const revocationSql = revocationSection.match(/```sql\n([\s\S]*?)```/)?.[1];
  assert.ok(revocationSql, 'revocation SQL example must exist');
  assert.match(revocationSql, /WITH reviewed_input AS/);
  assert.match(revocationSql, /NULL::uuid AS auth_user_id/);
  assert.match(revocationSql, /NULL::text AS revoked_reason/);
  assert.match(
    revocationSql,
    /WHERE auth_user_id IS NOT NULL\s+AND revoked_reason IS NOT NULL\s+AND btrim\(revoked_reason\) <> ''/,
    'revocation input must fail closed for NULL or blank reasons',
  );
  assert.match(
    revocationSql,
    /matched_active_memberships AS MATERIALIZED \(\s+SELECT membership\.id\s+FROM public\.auth_tenant_memberships AS membership\s+CROSS JOIN validated_input AS input\s+WHERE membership\.auth_user_id = input\.auth_user_id\s+AND membership\.status = 'active'\s+AND membership\.revoked_at IS NULL/s,
    'only active, unrevoked memberships may be candidates',
  );
  assert.match(
    revocationSql,
    /single_active_membership AS \(\s+SELECT id\s+FROM matched_active_memberships\s+WHERE \(SELECT count\(\*\) FROM matched_active_memberships\) = 1/s,
    'the update must be gated on exactly one active, unrevoked candidate',
  );
  assert.match(revocationSql, /FROM validated_input AS input\s+CROSS JOIN single_active_membership AS candidate/);
  assert.match(revocationSql, /WHERE membership\.id = candidate\.id\s+AND membership\.auth_user_id = input\.auth_user_id\s+AND membership\.status = 'active'\s+AND membership\.revoked_at IS NULL/s);
  assert.match(revocationSql, /RETURNING membership\.auth_user_id/);
  assert.doesNotMatch(
    revocationSql,
    /(^|[^:]):(?:'[A-Za-z_][A-Za-z0-9_]*'|[A-Za-z_][A-Za-z0-9_]*)/m,
    'Dashboard SQL must not contain psql-style variables',
  );
  assert.match(revocationSection, /`NULL` defaults intentionally update no rows if either value\s+is left unreplaced/);
  assert.match(revocationSection, /must return \*\*exactly one\*\* reviewed\s+row/);
  assert.match(revocationSection, /Zero rows or more than one row is a stop condition/);
});

test('staff authorization SQL assertions reject weakened validation, conflict, insert, or readback controls', () => {
  const staffAuthorizationSql = firstSqlBlockAfterHeading(guide, staffAuthorizationHeading);
  for (const [name, expected, replacement] of [
    ['serializable transaction', 'BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;', 'BEGIN;'],
    ['exact tenant validation', 'app_user.tenant_id = reviewed_tenant_id', 'app_user.tenant_id = reviewed_user_id'],
    ['zero app-user stop', 'IF exact_app_user_count = 0 THEN', 'IF FALSE THEN'],
    ['multiple app-user stop', 'ELSIF exact_app_user_count > 1 THEN', 'ELSIF FALSE THEN'],
    ['auth-user active conflict check', 'IF active_auth_binding_count > 0 THEN', 'IF FALSE THEN'],
    ['app-user active conflict check', 'IF active_app_binding_count > 0 THEN', 'IF FALSE THEN'],
    ['insert returning', 'RETURNING id INTO inserted_membership_id;', 'RETURNING id;'],
    ['auth-user readback value', "auth_user_id = current_setting('app.reviewed_auth_user_id', true)::uuid", 'auth_user_id IS NOT NULL'],
    ['app-user readback value', "user_id = current_setting('app.reviewed_user_id', true)::uuid", 'user_id IS NOT NULL'],
    ['tenant readback value', "tenant_id = current_setting('app.reviewed_tenant_id', true)::uuid", 'tenant_id IS NOT NULL'],
    ['final readback cardinality', 'IF final_active_tuple_count <> 1 THEN', 'IF TRUE THEN'],
    ['commit', 'COMMIT;', '-- no commit'],
  ]) {
    const altered = staffAuthorizationSql.replace(expected, replacement);
    assert.notEqual(altered, staffAuthorizationSql, `${name} mutation must alter the staff authorization SQL`);
    assert.throws(() => assertStaffAuthorizationSqlBlock(altered), `${name} assertion must reject a weakened staff authorization control`);
  }

  for (const [name, appended] of [
    ['extra UUID placeholder', '\\nSELECT NULL::uuid;'],
    ['auth.users lookup', '\\nSELECT id FROM auth.users;'],
    ['email lookup', '\\nSELECT email FROM public.users;'],
    ['metadata lookup', '\\nSELECT metadata FROM public.users;'],
  ]) {
    assert.throws(
      () => assertStaffAuthorizationSqlBlock(`${staffAuthorizationSql}${appended}`),
      `${name} assertion must reject a prohibited staff authorization variant`,
    );
  }
});

test('coordinator runtime-role preflight assertions reject weakened controls', () => {
  const coordinatorPreflightSql = firstSqlBlockAfterHeading(guide, coordinatorPreflightHeading);
  const mutations = [
    ['configured role existence', 'SELECT oid INTO coordinator_role FROM pg_roles WHERE rolname = configured_role', 'SELECT oid INTO coordinator_role FROM pg_roles WHERE rolname = NULL::name'],
    ['LOGIN capability', 'NOT rolcanlogin', 'FALSE'],
    ['SELECT permission', "has_table_privilege(coordinator_role, membership_table, 'SELECT')", "has_table_privilege(coordinator_role, membership_table, 'USAGE')"],
    ['direct ownership', 'relowner = coordinator_role', 'relowner = 0'],
    ['membership recursion direction', 'membership.member = reachable_roles.role_oid', 'membership.roleid = reachable_roles.role_oid'],
    ['membership recursion cycle guard', 'WHERE NOT membership.roleid = ANY (reachable_roles.role_path)', 'WHERE membership.roleid IS NOT NULL'],
  ];

  const deniedPrivileges = ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];
  const deniedPrivilegesControl = `ARRAY[${deniedPrivileges.map((privilege) => `'${privilege}'`).join(', ')}]`;
  for (const privilege of deniedPrivileges) {
    mutations.push([
      `${privilege} denied privilege`,
      deniedPrivilegesControl,
      deniedPrivilegesControl.replace(`'${privilege}'`, `'${privilege}_REMOVED'`),
    ]);
  }

  for (const [name, expected, replacement] of mutations) {
    const altered = coordinatorPreflightSql.replace(expected, replacement);
    assert.notEqual(altered, coordinatorPreflightSql, `${name} mutation must alter the preflight block`);
    assert.throws(() => assertCoordinatorRuntimeRolePreflight(altered), `${name} assertion must reject a weakened preflight`);
  }

  for (const [name, expected, replacement] of [
    ['reachable-role superuser denial', 'OR role.rolsuper', 'OR FALSE'],
    ['reachable-role BYPASSRLS denial', 'OR role.rolbypassrls', 'OR FALSE'],
    ...['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'].map((privilege) => [
      `reachable-role ${privilege} denial`,
      `OR has_table_privilege(reachable_roles.role_oid, membership_table, '${privilege}')`,
      'OR FALSE',
    ]),
  ]) {
    const altered = coordinatorPreflightSql.replace(expected, replacement);
    assert.notEqual(altered, coordinatorPreflightSql, `${name} mutation must alter the preflight block`);
    assert.throws(() => assertCoordinatorRuntimeRolePreflight(altered), `${name} assertion must reject a weakened preflight`);
  }
});

test('populated membership guard assertions reject omission or DDL reordering', () => {
  const noBoundedLock = sql.replace("SET LOCAL lock_timeout = '5s';", "SET LOCAL lock_timeout = '0';");
  assert.notEqual(noBoundedLock, sql, 'test mutation must alter the transaction-local lock timeout');
  assert.throws(() => assertPopulatedMembershipGuard(noBoundedLock));

  const noLockContentionFailure = sql.replace('WHEN lock_not_available THEN', 'WHEN undefined_table THEN');
  assert.notEqual(noLockContentionFailure, sql, 'test mutation must remove the lock-contention handler');
  assert.throws(() => assertPopulatedMembershipGuard(noLockContentionFailure));

  const noRowCheck = sql.replace(
    "EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.auth_tenant_memberships)'",
    "EXECUTE 'SELECT false'",
  );
  assert.notEqual(noRowCheck, sql, 'test mutation must remove the row-existence query');
  assert.throws(() => assertPopulatedMembershipGuard(noRowCheck));

  const ddlBeforeGuard = sql.replace(
    'BEGIN;\n\n-- A populated mapping table is never an idempotent reapply:',
    'BEGIN;\n\nCREATE EXTENSION IF NOT EXISTS pgcrypto;\n\n-- A populated mapping table is never an idempotent reapply:',
  );
  assert.notEqual(ddlBeforeGuard, sql, 'test mutation must move DDL before the guard');
  assert.throws(() => assertPopulatedMembershipGuard(ddlBeforeGuard));
});

test('lifecycle unique-index preflight assertions reject expression and all-row predicate bypasses', () => {
  for (const [name, expected, replacement] of [
    ['unique-only filter', 'AND i.indisunique', 'AND NOT i.indisunique'],
    ['expression-key rejection', 'AND i.indexprs IS NULL', 'AND i.indexprs IS NOT NULL'],
    ['included-column rejection', 'i.indnkeyatts = 1 AND i.indnatts = 1', 'i.indnkeyatts = 1 AND i.indnatts = 2'],
    ['auth canonical key', 'ARRAY[auth_user_id_attnum]::smallint[]', 'ARRAY[id_attnum]::smallint[]'],
    ['app canonical key', 'ARRAY[user_id_attnum]::smallint[]', 'ARRAY[id_attnum]::smallint[]'],
    ['all-row WHERE TRUE rejection', "pg_get_expr(i.indpred, i.indrelid) = '((status = ''active''::text) AND (revoked_at IS NULL))'", "pg_get_expr(i.indpred, i.indrelid) IN ('((status = ''active''::text) AND (revoked_at IS NULL))', 'true')"],
  ]) {
    const altered = sql.replace(expected, replacement);
    assert.notEqual(altered, sql, `${name} mutation must alter the provider script`);
    assert.throws(() => assertLifecycleUniqueIndexPreflight(altered), `${name} assertion must reject a weakened lifecycle preflight`);
  }
});

test('workflow self-trigger assertions reject omitted push or pull-request paths', () => {
  for (const trigger of ['push', 'pull_request']) {
    const marker = `  ${trigger}:\n    paths:\n`;
    const start = workflowSource.indexOf(marker);
    assert.notEqual(start, -1, `${trigger} trigger block must exist`);
    const triggerBlock = workflowSource.slice(start).match(
      /^  [^\n]+:\n(?:    [^\n]*\n|      [^\n]*\n)*/,
    )?.[0];
    assert.ok(triggerBlock, `${trigger} trigger block must be readable`);
    for (const [path, label] of [
      ['.github/workflows/membership-migration-artifact.yml', 'workflow self-trigger'],
      ['services/identity-mcp/scripts/probe-membership-rehearsal-runtime.mjs', 'direct-runtime probe path'],
    ]) {
      const altered = workflowSource.replace(
        triggerBlock,
        triggerBlock.replace(`      - ${path}\n`, ''),
      );
      assert.notEqual(altered, workflowSource, `${trigger} mutation must remove the ${label}`);
      assert.throws(() => assertWorkflowSelfTrigger(altered), `${trigger} assertion must reject a missing ${label}`);
    }
  }
});

test('canonical activated_at default assertion rejects an altered expectation', () => {
  const altered = sql.replace(
    "a.attrelid = membership_oid AND a.attname = 'activated_at'\n      AND pg_get_expr(d.adbin, d.adrelid) = 'now()'",
    "a.attrelid = membership_oid AND a.attname = 'activated_at'\n      AND pg_get_expr(d.adbin, d.adrelid) = 'CURRENT_TIMESTAMP'",
  );

  assert.notEqual(altered, sql, 'test mutation must alter the activated_at expected default');
  assert.throws(() => assertCanonicalDefault(altered, 'activated_at', 'now()'));
});

test('runtime lookup policy assertions reject browser-readable or role-switch variants', () => {
  for (const [name, expected, replacement] of [
    ['role-switch guard', 'USING (current_user = session_user)', 'USING (true)'],
    ['select-only command', 'FOR SELECT', 'FOR ALL'],
    ['browser privilege revocation', 'FROM anon, authenticated, PUBLIC', 'FROM anon, authenticated'],
  ]) {
    const altered = sql.replace(expected, replacement);
    assert.notEqual(altered, sql, `${name} mutation must alter the provider script`);
    assert.throws(() => assertRuntimeLookupPolicy(altered), `${name} assertion must reject a weakened RLS/ACL boundary`);
  }
});

test('existing relation ACL preflight permits only legacy service_role relation ACLs and rejects column ACLs', () => {
  for (const [name, expected, replacement] of [
    ['non-service role tolerance', "r.rolname IS DISTINCT FROM 'service_role'", "r.rolname NOT IN ('service_role', 'other_role')"],
    ['service-role-only condition', "r.rolname IS DISTINCT FROM 'service_role'", 'FALSE'],
    ['column ACL condition', 'AND a.attnum > 0\n      AND NOT a.attisdropped\n      AND acl.grantee <> c.relowner', 'AND a.attnum > 0\n      AND NOT a.attisdropped\n      AND acl.grantee = c.relowner'],
  ]) {
    const altered = sql.replace(expected, replacement);
    assert.notEqual(altered, sql, `${name} mutation must alter the provider script`);
    assert.throws(() => assertExistingRelationAclPreflight(altered), `${name} assertion must reject a weakened existing-relation ACL preflight`);
  }
});

test('service_role remediation and post-DDL ACL assertions reject omission or bypasses', () => {
  for (const [name, expected, replacement] of [
    ['service_role revoke', 'REVOKE ALL PRIVILEGES ON TABLE public.auth_tenant_memberships FROM service_role;', '-- missing service_role remediation'],
    ['post-DDL relation ACL condition', "WHERE c.oid = 'public.auth_tenant_memberships'::regclass\n      AND acl.grantee <> c.relowner\n  ) THEN\n    RAISE EXCEPTION 'auth_tenant_memberships has non-owner direct table ACLs after DDL", "WHERE c.oid = 'public.auth_tenant_memberships'::regclass\n      AND acl.grantee = c.relowner\n  ) THEN\n    RAISE EXCEPTION 'auth_tenant_memberships has non-owner direct table ACLs after DDL"],
    ['post-DDL column ACL assertion', "RAISE EXCEPTION 'auth_tenant_memberships has non-owner column ACLs after DDL; remediate the grant source and rerun the complete script';", '-- missing column ACL assertion'],
  ]) {
    const altered = sql.replace(expected, replacement);
    assert.notEqual(altered, sql, `${name} mutation must alter the provider script`);
    assert.throws(() => assertServiceRoleRemediationAndPostDdlAclAssertions(altered), `${name} assertion must reject a weakened post-DDL ACL control`);
  }
});

test('lifecycle trigger assertions reject deletion, reactivation, tuple mutation, or active-rebind weakening', () => {
  for (const [name, expected, replacement] of [
    ['DELETE guard', "IF TG_OP = 'DELETE' OR TG_OP = 'TRUNCATE' THEN", "IF TG_OP = 'TRUNCATE' THEN"],
    ['tuple immutability', 'NEW.tenant_id IS DISTINCT FROM OLD.tenant_id', 'FALSE'],
    ['revoked terminal state', "IF OLD.status <> 'active' OR OLD.revoked_at IS NOT NULL OR OLD.revoked_reason IS NOT NULL THEN", 'IF FALSE THEN'],
    ['active-to-revoked transition', "IF NEW.status <> 'revoked'", 'IF FALSE'],
    ['partial active auth index', "WHERE status = 'active' AND revoked_at IS NULL;", 'WHERE status = \'active\';'],
  ]) {
    const altered = sql.replace(expected, replacement);
    assert.notEqual(altered, sql, `${name} mutation must alter the provider script`);
    assert.throws(() => {
      assertMembershipLifecycleGuard(altered);
      assertLifecycleUniqueIndexPreflight(altered);
    }, `${name} assertion must reject weakened lifecycle controls`);
  }
});

test('lifecycle trigger replacement preflight statically rejects a same-named foreign-function variant', () => {
  const preflightStart = sql.indexOf('-- DROP TRIGGER IF EXISTS matches by trigger name, not function or trigger shape.');
  const firstDrop = sql.indexOf('DROP TRIGGER IF EXISTS auth_tenant_memberships_lifecycle_guard');
  assert.notEqual(preflightStart, -1, 'trigger replacement preflight must exist');
  assert.notEqual(firstDrop, -1, 'lifecycle trigger drop must exist');
  const preflight = sql.slice(preflightStart, firstDrop);
  const malformedPreflight = preflight.replace(
    "trigger.tgfoid = 'public.auth_tenant_memberships_lifecycle_guard()'::regprocedure",
    "trigger.tgfoid = 'pg_catalog.current_database()'::regprocedure",
  );
  assert.notEqual(malformedPreflight, preflight, 'same-named foreign-function mutation must alter the preflight');
  const malformedArtifact = `${sql.slice(0, preflightStart)}${malformedPreflight}${sql.slice(firstDrop)}`;
  assert.throws(
    () => assertLifecycleTriggerReplacementPreflight(malformedArtifact),
    'the static assertion must reject a same-named trigger accepted with a foreign function identity',
  );
});

test('lifecycle trigger assertions reject supplemental trigger definitions and catalog-count bypasses', () => {
  const supplementalTrigger = sql.replace(
    '-- CREATE TRIGGER has no IF NOT EXISTS.',
    `CREATE TRIGGER auth_tenant_memberships_supplemental_bypass
  BEFORE INSERT ON public.auth_tenant_memberships
  FOR EACH ROW EXECUTE FUNCTION public.auth_tenant_memberships_lifecycle_guard();

-- CREATE TRIGGER has no IF NOT EXISTS.`,
  );
  assert.notEqual(supplementalTrigger, sql, 'supplemental trigger mutation must alter the provider script');
  assert.throws(
    () => assertMembershipLifecycleGuard(supplementalTrigger),
    'a supplemental trigger definition must be rejected before provider execution',
  );

  const namedOnlyCatalogCount = sql.replace(
    "WHERE tgrelid = 'public.auth_tenant_memberships'::regclass\n        AND NOT tgisinternal) <> 2",
    "WHERE tgrelid = 'public.auth_tenant_memberships'::regclass\n        AND tgname IN ('auth_tenant_memberships_lifecycle_guard', 'auth_tenant_memberships_no_truncate')\n        AND NOT tgisinternal) <> 2",
  );
  assert.notEqual(namedOnlyCatalogCount, sql, 'catalog-count bypass mutation must alter the provider script');
  assert.throws(
    () => assertMembershipLifecycleGuard(namedOnlyCatalogCount),
    'a named-only trigger count must be rejected because it permits supplemental triggers',
  );
});

test('post-apply and post-grant ACL readback assertions reject reordered or weakened acceptance criteria', () => {
  for (const [name, expected, replacement] of [
    ['post-apply coordinator-preflight deferral', 'Do **not** rerun the Coordinator `DATABASE_URL` runtime-role preflight\nat this stage', 'Rerun the Coordinator `DATABASE_URL` runtime-role preflight at this stage'],
    ['post-apply zero relation-and-column ACL result', 'both the relation-ACL and column-ACL inventories\nreturn **zero rows**', 'both ACL inventories may contain the coordinator grant'],
    ['post-grant ordering', 'Only after the preceding post-apply schema readback has recorded zero non-owner\nrelation and column ACL rows', 'Before the post-apply schema readback'],
    ['post-grant runtime-role preflight', 'Then rerun the exact **Coordinator\n`DATABASE_URL` runtime-role preflight** block', 'Then optionally inspect the runtime role'],
    ['post-grant exactly-one relation ACL', 'relation inventory returns **exactly one**\nnon-owner row—the reviewed coordinator runtime role with `SELECT`', 'relation inventory returns any reviewed row'],
    ['post-grant zero column ACLs', 'ACL inventory returns **zero rows**', 'ACL inventory may return reviewed column grants'],
  ]) {
    const altered = guide.replace(expected, replacement);
    assert.notEqual(altered, guide, `${name} mutation must alter the runbook`);
    assert.throws(() => assertPostApplyAndPostGrantAclReadback(altered), `${name} assertion must reject a weakened ACL readback sequence`);
  }
});

test('direct runtime evidence boundary rejects SQL Editor substitution or target fallback', () => {
  for (const [name, expected, replacement] of [
    ['SQL Editor negative boundary', 'current_user <> session_user', 'current_user = session_user'],
    ['disposable target binding', 'distinct correctly formatted Supabase project ref', 'unrestricted target ref'],
    ['no production fallback', 'provider fallback and no production fallback', 'provider fallback is allowed'],
    ['finite timeout policy', 'exactly **5,000 ms** for the `pg` `connectionTimeoutMillis`, `query_timeout`,\nand server `statement_timeout` options', 'use provider defaults'],
    ['login identity check', 'current_user = session_user AS direct_login_identity', 'true AS direct_login_identity'],
    ['reviewed-role parameter binding', 'Bind\n`$4` to the exact reviewed non-secret `MEMBERSHIP_REHEARSAL_RUNTIME_ROLE`', 'read the role label from the client'],
    ['server-side configured-role comparison', 'current_user = $4::name AS configured_runtime_role_identity', 'true AS configured_runtime_role_identity'],
    ['server-observed current-user comparison', 'current_user = $4::name AS configured_runtime_role_identity', 'session_user = $4::name AS configured_runtime_role_identity'],
    ['configured-role acceptance criterion', 'configured_runtime_role_identity = true', 'configured_runtime_role_identity = false'],
    ['redacted evidence', 'do not record the URL, password, full connection string, raw\nquery parameters, or server error text', 'record all connection details'],
  ]) {
    const altered = guide.replace(expected, replacement);
    assert.notEqual(altered, guide, `${name} mutation must alter the runbook`);
    assert.throws(() => assertDirectRuntimeEvidenceBoundary(altered), `${name} assertion must reject a weakened direct-probe boundary`);
  }
});

test('restricted direct-runtime probe and synthetic fixture lifecycle reject weakened controls', () => {
  for (const [name, expected, replacement] of [
    ['target format validation', 'const SUPABASE_PROJECT_REF = /^[a-z]{20}$/;', 'const SUPABASE_PROJECT_REF = /.*/;'],
    ['immutable parent', "const EXPECTED_PARENT_REF = 'jnwxueomquywrqcgbgfd';", 'const EXPECTED_PARENT_REF = process.env.MEMBERSHIP_REHEARSAL_PARENT_REF;'],
    ['target-parent distinction', 'values.MEMBERSHIP_REHEARSAL_TARGET_REF === EXPECTED_PARENT_REF', 'false'],
    ['retired target rejection', 'values.MEMBERSHIP_REHEARSAL_TARGET_REF === RETIRED_TARGET_REF', 'false'],
    ['DATABASE_URL fallback rejection', "throw new Error('DATABASE_URL fallback is forbidden')", "// fallback allowed"],
    ['direct host equality', 'url.hostname.toLowerCase() !== `db.${values.MEMBERSHIP_REHEARSAL_TARGET_REF}.supabase.co`', 'false'],
    ['managed role rejection', "runtimeRole === 'service_role' || runtimeRole === 'postgres' || runtimeRole.startsWith('supabase_')", 'false'],
    ['finite connection timeout constant', 'export const DIRECT_RUNTIME_CONNECT_TIMEOUT_MS = 5_000;', 'export const DIRECT_RUNTIME_CONNECT_TIMEOUT_MS = 0;'],
    ['finite statement timeout constant', 'export const DIRECT_RUNTIME_STATEMENT_TIMEOUT_MS = 5_000;', 'export const DIRECT_RUNTIME_STATEMENT_TIMEOUT_MS = 0;'],
    ['connection timeout', 'connectionTimeoutMillis: DIRECT_RUNTIME_CONNECT_TIMEOUT_MS', 'connectionTimeoutMillis: 0'],
    ['client query timeout', 'query_timeout: DIRECT_RUNTIME_STATEMENT_TIMEOUT_MS', 'query_timeout: 0'],
    ['server statement timeout', 'statement_timeout: DIRECT_RUNTIME_STATEMENT_TIMEOUT_MS', 'statement_timeout: 0'],
    ['parameterized query', 'text: QUERY', "text: 'SELECT true'"],
    ['direct login acceptance', 'directLogin !== true || configuredRole !== true || Number(activeCount) !== 1', 'false'],
  ]) {
    const altered = probeSource.replace(expected, replacement);
    assert.notEqual(altered, probeSource, `${name} mutation must alter the probe`);
    assert.throws(() => assertRestrictedDirectRuntimeProbe(altered), `${name} assertion must reject a weakened probe`);
  }

  for (const [name, expected, replacement] of [
    ['fresh branch isolation', 'newly approved, addressable\ndisposable branch', 'shared reusable state'],
    ['malformed-object rollback readback', 'read back the named\nmalformed object and confirm that it remains unchanged after the provider-script\nrollback', 'continue without readback'],
    ['pre-probe active-row readback', 'exactly two historical\nrows, exactly one active/unrevoked row', 'any history is acceptable'],
    ['cleanup readback', 'zero active/unrevoked rows and two retained revoked rows', 'cleanup is optional'],
  ]) {
    const altered = guide.replace(expected, replacement);
    assert.notEqual(altered, guide, `${name} mutation must alter the runbook`);
    assert.throws(() => assertSyntheticFixtureLifecycle(altered), `${name} assertion must reject a weakened fixture lifecycle`);
  }
});

test('direct-runtime timeout rejection is nonzero and cannot instantiate a foreign target client', async () => {
  const validEnvironment = {
    MEMBERSHIP_REHEARSAL_TARGET_REF: 'disposablerehearsalx',
    MEMBERSHIP_REHEARSAL_PARENT_REF: 'jnwxueomquywrqcgbgfd',
    MEMBERSHIP_REHEARSAL_RUNTIME_ROLE: 'reviewed_runtime_role',
    MEMBERSHIP_REHEARSAL_DB_HOST: 'db.disposablerehearsalx.supabase.co',
    MEMBERSHIP_REHEARSAL_DB_PORT: '5432',
    MEMBERSHIP_REHEARSAL_DB_NAME: 'postgres',
    MEMBERSHIP_REHEARSAL_DATABASE_URL: 'postgresql://reviewed_runtime_role:password@db.disposablerehearsalx.supabase.co:5432/postgres?sslmode=require',
    MEMBERSHIP_REHEARSAL_AUTH_USER_ID: '11111111-1111-4111-8111-111111111111',
    MEMBERSHIP_REHEARSAL_USER_ID: '22222222-2222-4222-8222-222222222222',
    MEMBERSHIP_REHEARSAL_TENANT_ID: '33333333-3333-4333-8333-333333333333',
  };
  const timeoutClient = [];
  class RejectingClient {
    constructor(options) {
      timeoutClient.push(options);
    }
    async connect() {
      throw new Error('simulated connection timeout');
    }
    async end() {}
  }
  const stderr = [];
  const timeoutExitCode = await runProbe({
    environment: validEnvironment,
    ClientConstructor: RejectingClient,
    writeStdout: () => {},
    writeStderr: (message) => stderr.push(message),
  });
  assert.equal(timeoutExitCode, 1, 'a bounded connection rejection must set the direct executable nonzero');
  assert.equal(timeoutClient.length, 1, 'the approved target creates exactly one client');
  assert.equal(timeoutClient[0].connectionTimeoutMillis, DIRECT_RUNTIME_CONNECT_TIMEOUT_MS);
  assert.equal(timeoutClient[0].query_timeout, DIRECT_RUNTIME_STATEMENT_TIMEOUT_MS);
  assert.equal(timeoutClient[0].statement_timeout, DIRECT_RUNTIME_STATEMENT_TIMEOUT_MS);
  assert.deepEqual(stderr, ['membership rehearsal probe refused: direct runtime probe failed; stop and do not retry against another target\n']);

  let foreignClientConstructed = false;
  class ForeignClient {
    constructor() {
      foreignClientConstructed = true;
    }
  }
  const foreignExitCode = await runProbe({
    environment: { ...validEnvironment, MEMBERSHIP_REHEARSAL_DB_HOST: 'db.foreign.supabase.co' },
    ClientConstructor: ForeignClient,
    writeStdout: () => {},
    writeStderr: () => {},
  });
  assert.equal(foreignExitCode, 1, 'a foreign target rejection must set the direct executable nonzero');
  assert.equal(foreignClientConstructed, false, 'a foreign target must be rejected before a client can attempt a socket');

  for (const [name, environment] of [
    ['retired target', {
      ...validEnvironment,
      MEMBERSHIP_REHEARSAL_TARGET_REF: 'afygozgefepayoenwccl',
      MEMBERSHIP_REHEARSAL_DB_HOST: 'db.afygozgefepayoenwccl.supabase.co',
      MEMBERSHIP_REHEARSAL_DATABASE_URL: 'postgresql://reviewed_runtime_role:***@db.afygozgefepayoenwccl.supabase.co:5432/postgres?sslmode=require',
    }],
    ['malformed target ref', { ...validEnvironment, MEMBERSHIP_REHEARSAL_TARGET_REF: 'not-a-project-ref' }],
    ['parent target', {
      ...validEnvironment,
      MEMBERSHIP_REHEARSAL_TARGET_REF: 'jnwxueomquywrqcgbgfd',
      MEMBERSHIP_REHEARSAL_DB_HOST: 'db.jnwxueomquywrqcgbgfd.supabase.co',
      MEMBERSHIP_REHEARSAL_DATABASE_URL: 'postgresql://reviewed_runtime_role:***@db.jnwxueomquywrqcgbgfd.supabase.co:5432/postgres?sslmode=require',
    }],
    ['environment database port mismatch', { ...validEnvironment, MEMBERSHIP_REHEARSAL_DB_PORT: '6543' }],
    ['environment database name mismatch', { ...validEnvironment, MEMBERSHIP_REHEARSAL_DB_NAME: 'wrong_database' }],
    ['URL hostname mismatch with valid environment host', {
      ...validEnvironment,
      MEMBERSHIP_REHEARSAL_DATABASE_URL: 'postgresql://reviewed_runtime_role:***@db.foreign.supabase.co:5432/postgres?sslmode=require',
    }],
    ['URL port mismatch', {
      ...validEnvironment,
      MEMBERSHIP_REHEARSAL_DATABASE_URL: 'postgresql://reviewed_runtime_role:***@db.disposablerehearsalx.supabase.co:6543/postgres?sslmode=require',
    }],
    ['URL database mismatch', {
      ...validEnvironment,
      MEMBERSHIP_REHEARSAL_DATABASE_URL: 'postgresql://reviewed_runtime_role:***@db.disposablerehearsalx.supabase.co:5432/wrong_database?sslmode=require',
    }],
    ['URL username mismatch with non-admin role', {
      ...validEnvironment,
      MEMBERSHIP_REHEARSAL_DATABASE_URL: 'postgresql://different_non_admin_role:***@db.disposablerehearsalx.supabase.co:5432/postgres?sslmode=require',
    }],
    ['missing URL SSL mode', {
      ...validEnvironment,
      MEMBERSHIP_REHEARSAL_DATABASE_URL: 'postgresql://reviewed_runtime_role:***@db.disposablerehearsalx.supabase.co:5432/postgres',
    }],
    ['invalid URL SSL mode', {
      ...validEnvironment,
      MEMBERSHIP_REHEARSAL_DATABASE_URL: 'postgresql://reviewed_runtime_role:***@db.disposablerehearsalx.supabase.co:5432/postgres?sslmode=disable',
    }],
    ...['service_role', 'postgres', 'supabase_admin', 'supabase_auth_admin', 'SUPABASE_CUSTOM'].map((runtimeRole) => [
      `managed runtime role ${runtimeRole}`,
      {
        ...validEnvironment,
        MEMBERSHIP_REHEARSAL_RUNTIME_ROLE: runtimeRole,
        MEMBERSHIP_REHEARSAL_DATABASE_URL: `postgresql://${runtimeRole}:***@db.disposablerehearsalx.supabase.co:5432/postgres?sslmode=require`,
      },
    ]),
  ]) {
    let rejectedClientConstructed = false;
    class NoNetworkClient {
      constructor() {
        rejectedClientConstructed = true;
      }
    }
    const exitCode = await runProbe({
      environment,
      ClientConstructor: NoNetworkClient,
      writeStdout: () => {},
      writeStderr: () => {},
    });
    assert.equal(exitCode, 1, `${name} must reject nonzero`);
    assert.equal(rejectedClientConstructed, false, `${name} must reject before constructing a network client`);
  }
});

test('direct-runtime CLI guard runs the documented command but never auto-runs on import', () => {
  const documentedInvocation = spawnSync(process.execPath, [probeScript], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH },
  });
  assert.equal(documentedInvocation.status, 1, 'the documented direct invocation must execute and reject missing required environment');
  assert.equal(documentedInvocation.stdout, '');
  assert.equal(
    documentedInvocation.stderr,
    'membership rehearsal probe refused: required rehearsal environment is incomplete\n',
    'the CLI rejection must remain redacted',
  );

  const validEnvironment = {
    MEMBERSHIP_REHEARSAL_TARGET_REF: 'disposablerehearsalx',
    MEMBERSHIP_REHEARSAL_PARENT_REF: 'jnwxueomquywrqcgbgfd',
    MEMBERSHIP_REHEARSAL_RUNTIME_ROLE: 'reviewed_runtime_role',
    MEMBERSHIP_REHEARSAL_DB_HOST: 'db.disposablerehearsalx.supabase.co',
    MEMBERSHIP_REHEARSAL_DB_PORT: '5432',
    MEMBERSHIP_REHEARSAL_DB_NAME: 'postgres',
    MEMBERSHIP_REHEARSAL_DATABASE_URL: 'postgresql://reviewed_runtime_role:***@db.disposablerehearsalx.supabase.co:5432/postgres?sslmode=require',
    MEMBERSHIP_REHEARSAL_AUTH_USER_ID: '11111111-1111-4111-8111-111111111111',
    MEMBERSHIP_REHEARSAL_USER_ID: '22222222-2222-4222-8222-222222222222',
    MEMBERSHIP_REHEARSAL_TENANT_ID: '33333333-3333-4333-8333-433333333333',
  };
  const importOnly = spawnSync(process.execPath, [
    '--input-type=module',
    '--eval',
    `import net from 'node:net';
let connectionAttempts = 0;
net.Socket.prototype.connect = function blockedProbeNetworkConnection() {
  connectionAttempts += 1;
  throw new Error('unexpected probe network connection');
};
await import(${JSON.stringify(pathToFileURL(probeScript).href)});
if (connectionAttempts !== 0) {
  process.stderr.write('unexpected probe network connection\\n');
  process.exitCode = 1;
}`,
  ], {
    encoding: 'utf8',
    env: validEnvironment,
  });
  assert.equal(importOnly.status, 0, 'importing the probe must not invoke the CLI');
  assert.equal(importOnly.stdout, '', 'importing the probe must not write stdout');
  assert.equal(importOnly.stderr, '', 'importing the probe must not write stderr or attempt a network connection');
});
