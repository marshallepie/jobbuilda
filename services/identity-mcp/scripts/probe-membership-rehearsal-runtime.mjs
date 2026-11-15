import { Client } from 'pg';

const APPROVED_TARGET_REF = 'afygozgefepayoenwccl';
const APPROVED_PARENT_REF = 'jnwxueomquywrqcgbgfd';
const APPROVED_DIRECT_HOST = `db.${APPROVED_TARGET_REF}.supabase.co`;
const APPROVED_DIRECT_PORT = '5432';
const APPROVED_DATABASE_NAME = 'postgres';
const REQUIRED_ENVIRONMENT = [
  'MEMBERSHIP_REHEARSAL_TARGET_REF',
  'MEMBERSHIP_REHEARSAL_PARENT_REF',
  'MEMBERSHIP_REHEARSAL_RUNTIME_ROLE',
  'MEMBERSHIP_REHEARSAL_DB_HOST',
  'MEMBERSHIP_REHEARSAL_DB_PORT',
  'MEMBERSHIP_REHEARSAL_DB_NAME',
  'MEMBERSHIP_REHEARSAL_DATABASE_URL',
  'MEMBERSHIP_REHEARSAL_AUTH_USER_ID',
  'MEMBERSHIP_REHEARSAL_USER_ID',
  'MEMBERSHIP_REHEARSAL_TENANT_ID',
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const QUERY = `SELECT
  current_user = session_user AS direct_login_identity,
  current_user = $4::name AS configured_runtime_role_identity,
  count(*) AS active_membership_count
FROM public.auth_tenant_memberships
WHERE auth_user_id = $1::uuid
  AND user_id = $2::uuid
  AND tenant_id = $3::uuid
  AND status = 'active'
  AND revoked_at IS NULL;`;

function fail(message) {
  process.stderr.write(`membership rehearsal probe refused: ${message}\n`);
  process.exitCode = 1;
}

function requiredEnvironment() {
  const missing = REQUIRED_ENVIRONMENT.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) throw new Error('required rehearsal environment is incomplete');

  const values = Object.fromEntries(REQUIRED_ENVIRONMENT.map((name) => [name, process.env[name].trim()]));
  if (values.MEMBERSHIP_REHEARSAL_TARGET_REF !== APPROVED_TARGET_REF
    || values.MEMBERSHIP_REHEARSAL_PARENT_REF !== APPROVED_PARENT_REF) {
    throw new Error('target binding is not the approved disposable branch');
  }
  if (process.env.DATABASE_URL?.trim()) {
    throw new Error('DATABASE_URL fallback is forbidden');
  }
  if (values.MEMBERSHIP_REHEARSAL_DB_HOST.toLowerCase() !== APPROVED_DIRECT_HOST
    || values.MEMBERSHIP_REHEARSAL_DB_PORT !== APPROVED_DIRECT_PORT
    || values.MEMBERSHIP_REHEARSAL_DB_NAME !== APPROVED_DATABASE_NAME) {
    throw new Error('connection tuple is not the approved direct disposable tuple');
  }
  if (['service_role', 'postgres', 'supabase_admin'].includes(values.MEMBERSHIP_REHEARSAL_RUNTIME_ROLE.toLowerCase())) {
    throw new Error('service or administrative runtime role is forbidden');
  }
  for (const name of [
    'MEMBERSHIP_REHEARSAL_AUTH_USER_ID',
    'MEMBERSHIP_REHEARSAL_USER_ID',
    'MEMBERSHIP_REHEARSAL_TENANT_ID',
  ]) {
    if (!UUID.test(values[name])) throw new Error('synthetic membership tuple is invalid');
  }
  return values;
}

function assertUrlMatchesApprovedTuple(values) {
  let url;
  try {
    url = new URL(values.MEMBERSHIP_REHEARSAL_DATABASE_URL);
  } catch {
    throw new Error('direct runtime connection URL is invalid');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || url.hostname.toLowerCase() !== APPROVED_DIRECT_HOST
    || url.port !== APPROVED_DIRECT_PORT
    || decodeURIComponent(url.pathname.slice(1)) !== APPROVED_DATABASE_NAME
    || decodeURIComponent(url.username) !== values.MEMBERSHIP_REHEARSAL_RUNTIME_ROLE
    || !url.password
    || !['require', 'verify-ca', 'verify-full'].includes(url.searchParams.get('sslmode'))) {
    throw new Error('direct runtime connection URL does not match the approved tuple');
  }
  return url.toString();
}

async function main() {
  let values;
  let connectionString;
  try {
    values = requiredEnvironment();
    connectionString = assertUrlMatchesApprovedTuple(values);
  } catch (error) {
    fail(error.message);
    return;
  }

  const client = new Client({ connectionString, application_name: 'jobbuilda-membership-rehearsal-probe' });
  try {
    await client.connect();
    const result = await client.query({
      text: QUERY,
      values: [
        values.MEMBERSHIP_REHEARSAL_AUTH_USER_ID,
        values.MEMBERSHIP_REHEARSAL_USER_ID,
        values.MEMBERSHIP_REHEARSAL_TENANT_ID,
        values.MEMBERSHIP_REHEARSAL_RUNTIME_ROLE,
      ],
      rowMode: 'array',
    });
    const [directLogin, configuredRole, activeCount] = result.rows[0] ?? [];
    if (directLogin !== true || configuredRole !== true || Number(activeCount) !== 1) {
      fail('positive lookup acceptance criteria were not met');
      return;
    }
    process.stdout.write(JSON.stringify({
      result: 'pass',
      target_ref: APPROVED_TARGET_REF,
      probe: 'direct-runtime-positive-lookup',
    }) + '\n');
  } catch {
    fail('direct runtime probe failed; stop and do not retry against another target');
  } finally {
    await client.end().catch(() => {});
  }
}

await main();
