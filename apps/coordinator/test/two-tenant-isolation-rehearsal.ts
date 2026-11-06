import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createConnection } from 'node:net';
import Fastify from 'fastify';
import pg from 'pg';
import { MCPClient } from '@jobbuilda/mcp-sdk';
import { registerAccountIsolationContainment } from '../src/lib/account-isolation-containment.js';
import { registerServerAuth } from '../src/lib/auth.js';
import { identityRoutes } from '../src/routes/identity.js';
import { clientsRoutes } from '../src/routes/clients.js';
import { quotingRoutes } from '../src/routes/quoting.js';
import { invoicingRoutes } from '../src/routes/invoicing.js';
import { runWithPreservedFailure } from '../src/lib/rehearsal-runner.js';
import { startNatsCapture } from '../src/lib/nats-capture.js';
import {
  assertRequiredRehearsalMcpArtifacts,
  type McpEntrypoints,
} from '../src/lib/mcp-artifacts.js';

const REHEARSAL_REF = 'jwnfweldmfdeapfzfunq';
const PRODUCTION_REF = 'jnwxueomquywrqcgbgfd';
const SUPABASE_URL = `https://${REHEARSAL_REF}.supabase.co`;

type Fixture = { tenant_id: string; user_id: string; client_id: string; quote_id: string; invoice_id: string; email: string };
type Membership = { auth_user_id: string; tenant_id: string; user_id: string; email: string; role: 'admin' };

type FixtureCounts = { clients: number; quotes: number; invoices: number };
type FixtureSnapshot = { snapshot: unknown };
type McpServiceName = 'identity' | 'clients' | 'quoting' | 'invoicing';

const STARTUP_TIMEOUT_MS = 8_000;
const DATABASE_TIMEOUT_MS = 5_000;

function fail(message: string): never {
  throw new Error(`REHEARSAL_BLOCKED: ${message}`);
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) fail(`${name} is required`);
  return value;
}

function safeResult(operation: string, status: number, assertion: string): void {
  console.log(JSON.stringify({ operation, status, assertion }));
}

function assertStatus(operation: string, actual: number, expected: number, assertion: string): void {
  safeResult(operation, actual, assertion);
  assert.equal(actual, expected, `${operation}: expected ${expected}, got ${actual}`);
}

function sanitizedError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, 'postgresql://[redacted]')
    .replace(/(?:Bearer|apikey|authorization)\s+[^\s,]+/gi, '$1 [redacted]')
    .slice(0, 300);
}

async function bounded<T>(stage: string, timeoutMs: number, operation: () => Promise<T>): Promise<T> {
  const started = performance.now();
  let timer: NodeJS.Timeout | undefined;
  try {
    const value = await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms while awaiting ${stage}`)), timeoutMs);
      }),
    ]);
    safeResult(`startup-${stage}`, 200, `ready in ${Math.round(performance.now() - started)}ms`);
    return value;
  } catch (error) {
    safeResult(`startup-${stage}`, 503, `failed in ${Math.round(performance.now() - started)}ms: ${sanitizedError(error)}`);
    throw new Error(`REHEARSAL_BLOCKED: startup ${stage} failed: ${sanitizedError(error)}`);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function readSyntheticFixture(pool: pg.Pool, member: Membership, alias: 'A' | 'B'): Promise<Fixture> {
  const clientName = `Synthetic Rehearsal ${alias} Client`;
  const quoteTitle = `Synthetic Rehearsal ${alias} Quote`;
  const invoiceNumber = `SYN-${alias}-INVOICE-0001`;
  const result = await pool.query<{ client_id: string; quote_id: string; invoice_id: string }>(
    `SELECT c.id::text AS client_id, q.id::text AS quote_id, i.id::text AS invoice_id
       FROM public.clients c
       JOIN public.quotes q ON q.tenant_id = c.tenant_id AND q.client_id = c.id AND q.title = $3
       JOIN public.invoices i ON i.tenant_id = c.tenant_id AND i.client_id = c.id AND i.quote_id = q.id AND i.invoice_number = $4
      WHERE c.tenant_id = $1 AND c.name = $2`,
    [member.tenant_id, clientName, quoteTitle, invoiceNumber],
  );
  if (result.rows.length !== 1) fail(`tenant ${alias} requires exactly one pre-existing synthetic client, quote, and invoice fixture`);
  return { tenant_id: member.tenant_id, user_id: member.user_id, email: member.email, ...result.rows[0] };
}

async function passwordGrant(email: string, password: string): Promise<string> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: required('SUPABASE_SERVICE_ROLE_KEY'), 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) fail(`password grant failed with HTTP ${response.status}`);
  const body = await response.json() as { access_token?: string };
  if (!body.access_token) fail('password grant returned no access token');
  return body.access_token;
}

async function createB2(email: string, password: string): Promise<string> {
  const key = required('SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!response.ok) fail(`GoTrue Admin create-user failed with HTTP ${response.status}`);
  const body = await response.json() as { id?: string };
  if (!body.id) fail('GoTrue Admin create-user returned no identity id');
  return body.id;
}


async function ensureSyntheticFixture(pool: pg.Pool, member: Membership, alias: 'A' | 'B'): Promise<Fixture> {
  const label = `Synthetic Rehearsal ${alias}`;
  const clientName = `${label} Client`;
  const quoteTitle = `${label} Quote`;
  const quoteNumber = `SYN-${alias}-QUOTE-0001`;
  const invoiceNumber = `SYN-${alias}-INVOICE-0001`;
  const clientEmail = `synthetic-rehearsal-${alias.toLowerCase()}@example.invalid`;

  const connection = await pool.connect();
  try {
    await connection.query('BEGIN');
    const tenant = await connection.query<{ id: string }>(
      `UPDATE public.tenants
          SET name = $2, trading_name = $2, email = $3,
              address_line1 = '1 Synthetic Rehearsal Way', city = 'Testville',
              postcode = 'TE5 7AA', website = 'https://example.invalid/rehearsal'
        WHERE id = $1
      RETURNING id::text`,
      [member.tenant_id, `${label} Business`, clientEmail],
    );
    if (tenant.rows.length !== 1) fail(`tenant ${alias} business-profile fixture was not found`);

    const clientRows = await connection.query<{ id: string }>(
      `SELECT id::text FROM public.clients WHERE tenant_id = $1 AND name = $2 ORDER BY created_at`,
      [member.tenant_id, clientName],
    );
    if (clientRows.rows.length > 1) fail(`tenant ${alias} has duplicate synthetic client fixtures`);
    const clientId = clientRows.rows[0]?.id ?? (await connection.query<{ id: string }>(
      `INSERT INTO public.clients (tenant_id, name, email, address_line1, city, postcode, notes)
       VALUES ($1, $2, $3, '1 Synthetic Rehearsal Way', 'Testville', 'TE5 7AA', 'Synthetic rehearsal fixture only')
       RETURNING id::text`,
      [member.tenant_id, clientName, clientEmail],
    )).rows[0].id;

    const quoteRows = await connection.query<{ id: string; client_id: string }>(
      `SELECT id::text, client_id::text FROM public.quotes WHERE tenant_id = $1 AND title = $2 ORDER BY created_at`,
      [member.tenant_id, quoteTitle],
    );
    if (quoteRows.rows.length > 1 || (quoteRows.rows[0] && quoteRows.rows[0].client_id !== clientId)) fail(`tenant ${alias} synthetic quote fixture is invalid or duplicated`);
    const quoteId = quoteRows.rows[0]?.id ?? (await connection.query<{ id: string }>(
      `INSERT INTO public.quotes (tenant_id, quote_number, client_id, title, description, valid_until, notes, terms, created_by)
       VALUES ($1, $2, $3, $4, 'Synthetic rehearsal fixture only', CURRENT_DATE + 30, 'Synthetic rehearsal fixture only', 'Synthetic rehearsal fixture only', $5)
       RETURNING id::text`,
      [member.tenant_id, quoteNumber, clientId, quoteTitle, member.user_id],
    )).rows[0].id;

    const invoiceRows = await connection.query<{ id: string; client_id: string; quote_id: string | null }>(
      `SELECT id::text, client_id::text, quote_id::text FROM public.invoices WHERE tenant_id = $1 AND invoice_number = $2 ORDER BY created_at`,
      [member.tenant_id, invoiceNumber],
    );
    if (invoiceRows.rows.length > 1 || (invoiceRows.rows[0] && (invoiceRows.rows[0].client_id !== clientId || invoiceRows.rows[0].quote_id !== quoteId))) fail(`tenant ${alias} synthetic invoice fixture is invalid or duplicated`);
    const invoiceId = invoiceRows.rows[0]?.id ?? (await connection.query<{ id: string }>(
      `INSERT INTO public.invoices (tenant_id, invoice_number, client_id, quote_id, status, due_date, notes, payment_terms, created_by)
       VALUES ($1, $2, $3, $4, 'draft', CURRENT_DATE + 30, 'Synthetic rehearsal fixture only', 'Synthetic rehearsal fixture only', $5)
       RETURNING id::text`,
      [member.tenant_id, invoiceNumber, clientId, quoteId, member.user_id],
    )).rows[0].id;

    await connection.query('COMMIT');
    return { tenant_id: member.tenant_id, user_id: member.user_id, client_id: clientId, quote_id: quoteId, invoice_id: invoiceId, email: member.email };
  } catch (error) {
    await connection.query('ROLLBACK');
    throw error;
  } finally {
    connection.release();
  }
}

async function fixtureCounts(pool: pg.Pool): Promise<FixtureCounts> {
  const result = await pool.query<FixtureCounts>(`
    SELECT
      (SELECT count(*)::int FROM public.clients WHERE name IN ('Synthetic Rehearsal A Client', 'Synthetic Rehearsal B Client')) AS clients,
      (SELECT count(*)::int FROM public.quotes WHERE title IN ('Synthetic Rehearsal A Quote', 'Synthetic Rehearsal B Quote')) AS quotes,
      (SELECT count(*)::int FROM public.invoices WHERE invoice_number IN ('SYN-A-INVOICE-0001', 'SYN-B-INVOICE-0001')) AS invoices
  `);
  return result.rows[0];
}

async function fixtureSnapshot(pool: pg.Pool, fixture: Fixture): Promise<string> {
  const result = await pool.query<FixtureSnapshot>(`
    SELECT jsonb_build_object(
      'client', to_jsonb(c),
      'quote', to_jsonb(q),
      'invoice', to_jsonb(i)
    ) AS snapshot
    FROM public.clients c
    JOIN public.quotes q ON q.id = $2 AND q.tenant_id = c.tenant_id AND q.client_id = c.id
    JOIN public.invoices i ON i.id = $3 AND i.tenant_id = c.tenant_id AND i.client_id = c.id AND i.quote_id = q.id
    WHERE c.id = $1 AND c.tenant_id = $4
  `, [fixture.client_id, fixture.quote_id, fixture.invoice_id, fixture.tenant_id]);
  if (result.rows.length !== 1) fail('permanent fixture snapshot was not uniquely readable');
  return JSON.stringify(result.rows[0].snapshot);
}

async function temporaryWriteCounts(pool: pg.Pool, label: string): Promise<{ clients: number; sites: number }> {
  const result = await pool.query<{ clients: number; sites: number }>(`
    SELECT
      (SELECT count(*)::int FROM public.clients WHERE name = $1) AS clients,
      (SELECT count(*)::int FROM public.sites WHERE name = $2) AS sites
  `, [`${label} Client`, `${label} Site`]);
  return result.rows[0];
}

function createMcpClients(natsUrl: string, entrypoints: McpEntrypoints): Record<McpServiceName, MCPClient> {
  const connection = (service: McpServiceName) => ({
    command: 'node',
    args: [entrypoints[service]],
    env: { DATABASE_URL: process.env.DATABASE_URL!, NODE_ENV: 'test', NATS_URL: natsUrl },
  });
  return {
    identity: new MCPClient('identity-mcp', connection('identity')),
    clients: new MCPClient('clients-mcp', connection('clients')),
    quoting: new MCPClient('quoting-mcp', connection('quoting')),
    invoicing: new MCPClient('invoicing-mcp', connection('invoicing')),
  };
}

async function probeNats(natsUrl: string): Promise<void> {
  const url = new URL(natsUrl);
  await new Promise<void>((resolve, reject) => {
    const socket = createConnection({ host: url.hostname, port: Number(url.port) });
    let receivedInfo = false;
    let buffer = '';
    socket.once('error', reject);
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      if (!receivedInfo && buffer.includes('INFO ')) {
        receivedInfo = true;
        socket.write('CONNECT {"verbose":false,"pedantic":false}\r\nPING\r\n');
      }
      if (buffer.includes('PONG\r\n')) {
        socket.end();
        resolve();
      }
    });
  });
}

async function preflight(pool: pg.Pool, natsUrl: string, entrypoints: McpEntrypoints): Promise<{ a: Membership; b: Membership; aFixture: Fixture; bFixture: Fixture; clients: Record<McpServiceName, MCPClient> }> {
  await bounded('database-ping', DATABASE_TIMEOUT_MS, async () => { await pool.query('SELECT 1'); });
  await bounded('nats-connect-and-ping', STARTUP_TIMEOUT_MS, () => probeNats(natsUrl));

  const memberships = await bounded('database-membership-lookup', DATABASE_TIMEOUT_MS, () => pool.query<Membership>(`
    SELECT m.auth_user_id::text, m.tenant_id::text, m.user_id::text, au.email, u.role
    FROM public.auth_tenant_memberships m
    JOIN auth.users au ON au.id = m.auth_user_id
    JOIN public.users u ON u.id=m.user_id AND u.tenant_id=m.tenant_id AND u.role='admin'
    WHERE m.status = 'active' AND m.revoked_at IS NULL ORDER BY m.created_at`));
  const revoked = await bounded('database-revoked-membership-lookup', DATABASE_TIMEOUT_MS, () => pool.query<Membership>(`
    SELECT m.auth_user_id::text, m.tenant_id::text, m.user_id::text, u.email
    FROM public.auth_tenant_memberships m JOIN auth.users u ON u.id = m.auth_user_id
    WHERE m.status = 'revoked' AND m.revoked_at IS NOT NULL AND u.email NOT LIKE 'jobbuilda-rehearsal-b2-%'
    ORDER BY m.created_at`));
  if (memberships.rows.length !== 1 || revoked.rows.length !== 1) fail('expected exactly one active A mapping and one retained revoked B mapping');
  const [a, b] = [memberships.rows[0], revoked.rows[0]];
  const [aFixture, bFixture, counts] = await Promise.all([
    bounded('fixture-readback-A', DATABASE_TIMEOUT_MS, () => readSyntheticFixture(pool, a, 'A')),
    bounded('fixture-readback-B', DATABASE_TIMEOUT_MS, () => readSyntheticFixture(pool, b, 'B')),
    bounded('fixture-aggregate-readback', DATABASE_TIMEOUT_MS, () => fixtureCounts(pool)),
  ]);
  if (counts.clients !== 2 || counts.quotes !== 2 || counts.invoices !== 2) fail('synthetic fixture aggregate readback was not exactly two per resource type');

  const clients = createMcpClients(natsUrl, entrypoints);
  try {
    for (const service of ['identity', 'clients', 'quoting', 'invoicing'] as const) {
      await bounded(`mcp-${service}-connect`, STARTUP_TIMEOUT_MS, () => clients[service].connect());
      await bounded(`mcp-${service}-resources`, STARTUP_TIMEOUT_MS, () => clients[service].listResources());
      await bounded(`mcp-${service}-tools`, STARTUP_TIMEOUT_MS, () => clients[service].listTools());
    }
    return { a, b, aFixture, bFixture, clients };
  } catch (error) {
    await Promise.all(Object.values(clients).map(async (client) => {
      try { await client.disconnect(); } catch { /* best-effort process cleanup after a failed preflight */ }
    }));
    throw error;
  }
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV !== 'test') fail('NODE_ENV must be test');
  if (process.env.JOBBUILDA_REHEARSAL_MODE !== 'true') fail('JOBBUILDA_REHEARSAL_MODE must be true');
  if (process.env.JOBBUILDA_REHEARSAL_SUPABASE_REF === PRODUCTION_REF) fail('production ref rejected');
  if (process.env.JOBBUILDA_REHEARSAL_SUPABASE_REF !== REHEARSAL_REF) fail('approved branch ref is required');
  if (process.env.SUPABASE_URL !== SUPABASE_URL) fail('SUPABASE_URL must exactly identify the approved branch');
  if (process.env.JOBBUILDA_REHEARSAL_DATABASE_URL?.includes(PRODUCTION_REF)) fail('production database ref rejected');

  // Keep child-process resolution independent of the shell that launches this
  // harness, and fail before starting NATS, MCP services, or Auth fixtures.
  const entrypoints = assertRequiredRehearsalMcpArtifacts();
  safeResult('artifact-preflight', 200, 'identity, clients, quoting, and invoicing MCP dist entrypoints exist');
  process.env.DATABASE_URL = required('JOBBUILDA_REHEARSAL_DATABASE_URL');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const natsCapture = await startNatsCapture();
  let b2AuthUserId: string | undefined;
  let mcp: Record<McpServiceName, MCPClient> | undefined;
  let app: ReturnType<typeof Fastify> | undefined;
  let temporaryLabel: string | undefined;
  let temporaryClientDeletedByHandler = false;
  let natsCaptureClosed = false;
  return runWithPreservedFailure(async () => {
    const readiness = await preflight(pool, natsCapture.url, entrypoints);
    const { a, b, aFixture, bFixture } = readiness;
    mcp = readiness.clients;

    // This is the only phase permitted to mutate Auth. It starts only after all
    // database, NATS, and MCP readiness probes have completed successfully.
    process.env.SUPABASE_SERVICE_ROLE_KEY = required('JOBBUILDA_REHEARSAL_SUPABASE_SERVICE_ROLE_KEY');
    const aPassword = required('JOBBUILDA_REHEARSAL_A_PASSWORD');

    const b2Password = randomBytes(32).toString('base64url');
    // The branch has already accepted rehearsal fixtures on the JobBuilda
    // domain. Do not use reserved .test/.invalid domains here: GoTrue may
    // reject them before the Admin fixture lifecycle can be exercised.
    const b2Email = `jobbuilda-rehearsal-b2-${randomUUID()}@jobbuilda.co.uk`;
    b2AuthUserId = await createB2(b2Email, b2Password);
    await pool.query(
      `INSERT INTO public.auth_tenant_memberships (auth_user_id, tenant_id, user_id, status)
       VALUES ($1, $2, $3, 'active')`,
      [b2AuthUserId, b.tenant_id, b.user_id],
    );
    const activeB2 = await pool.query(`SELECT count(*)::int AS count FROM public.auth_tenant_memberships WHERE auth_user_id=$1 AND status='active' AND revoked_at IS NULL`, [b2AuthUserId]);
    if (activeB2.rows[0].count !== 1) fail('B2 membership activation readback did not return exactly one active mapping');

    const aBearer = await passwordGrant(a.email, aPassword);
    const { identity, clients, quoting, invoicing } = mcp;

    app = Fastify();
    app.decorate('mcp', { identity, clients, quoting, invoicing } as any);
    registerAccountIsolationContainment(app);
    registerServerAuth(app);
    await identityRoutes(app);
    await clientsRoutes(app);
    await quotingRoutes(app);
    await invoicingRoutes(app);
    await app.ready();
    const headers = (token: string) => ({ authorization: `Bearer ${token}` });
    // This acceptance exercises only client create/update/delete. Site CRUD and
    // portal-token lifecycle are intentionally excluded and remain unverified.
    const [beforeA, beforeB] = await Promise.all([
      fixtureSnapshot(pool, aFixture),
      fixtureSnapshot(pool, bFixture),
    ]);
    temporaryLabel = `Synthetic Write Rehearsal ${randomUUID()}`;
    const temporaryClientName = `${temporaryLabel} Client`;
    const temporarySiteName = `${temporaryLabel} Site`;
    const beforeTemporary = await temporaryWriteCounts(pool, temporaryLabel);
    if (beforeTemporary.clients !== 0 || beforeTemporary.sites !== 0) fail('temporary write label unexpectedly already exists');

    const created = await app.inject({ method: 'POST', url: '/api/clients/clients', headers: headers(aBearer), payload: { name: temporaryClientName, notes: 'synthetic tenant-write rehearsal only', gdpr_consent: false } });
    assertStatus('A-own-client-create', created.statusCode, 200, 'real coordinator route and clients MCP create succeeded');
    const createdBody = JSON.parse(created.body) as { id?: string };
    if (!createdBody.id) fail('own client create returned no client id');
    const temporaryClientId = createdBody.id;
    const createdReadback = await pool.query<{ name: string; tenant_id: string }>('SELECT name, tenant_id::text FROM public.clients WHERE id=$1', [temporaryClientId]);
    if (createdReadback.rows.length !== 1 || createdReadback.rows[0].name !== temporaryClientName || createdReadback.rows[0].tenant_id !== a.tenant_id) fail('own client create database readback mismatch');
    safeResult('A-own-client-create-readback', 200, 'temporary client exists only in A tenant');

    const updatedName = `${temporaryLabel} Client Updated`;
    const updated = await app.inject({ method: 'PATCH', url: `/api/clients/clients/${temporaryClientId}`, headers: headers(aBearer), payload: { name: updatedName } });
    assertStatus('A-own-client-update', updated.statusCode, 200, 'real coordinator route and clients MCP update succeeded');
    const updatedReadback = await pool.query<{ name: string; tenant_id: string }>('SELECT name, tenant_id::text FROM public.clients WHERE id=$1', [temporaryClientId]);
    if (updatedReadback.rows.length !== 1 || updatedReadback.rows[0].name !== updatedName || updatedReadback.rows[0].tenant_id !== a.tenant_id) fail('own client update database readback mismatch');
    safeResult('A-own-client-update-readback', 200, 'temporary client update persisted only in A tenant');

    const denyAndVerifyB = async (operation: string, response: { statusCode: number }, expectedSnapshot: string) => {
      const currentB = await fixtureSnapshot(pool, bFixture);
      safeResult(operation, response.statusCode, 'cross-tenant mutation denied and B fixture readback unchanged');
      assert.equal(currentB, expectedSnapshot, `${operation}: foreign B fixture changed`);
      assert.notEqual(response.statusCode, 200, `${operation}: cross-tenant write unexpectedly succeeded`);
    };
    const foreignSite = await app.inject({ method: 'POST', url: '/api/clients/sites', headers: headers(aBearer), payload: { client_id: bFixture.client_id, name: temporarySiteName, address_line1: '1 Synthetic Write Way', city: 'Testville', postcode: 'TE5 7AA' } });
    await denyAndVerifyB('A-foreign-client-site-create', foreignSite, beforeB);
    const foreignUpdate = await app.inject({ method: 'PATCH', url: `/api/clients/clients/${bFixture.client_id}`, headers: headers(aBearer), payload: { notes: 'synthetic foreign mutation must not persist' } });
    await denyAndVerifyB('A-foreign-client-update', foreignUpdate, beforeB);
    const foreignDelete = await app.inject({ method: 'DELETE', url: `/api/clients/gdpr/${bFixture.client_id}?confirm=true`, headers: headers(aBearer) });
    await denyAndVerifyB('A-foreign-client-delete', foreignDelete, beforeB);

    const deleted = await app.inject({ method: 'DELETE', url: `/api/clients/gdpr/${temporaryClientId}?confirm=true`, headers: headers(aBearer) });
    assertStatus('A-own-client-delete', deleted.statusCode, 200, 'real coordinator route and clients MCP delete succeeded');
    temporaryClientDeletedByHandler = true;
    const deletedReadback = await pool.query('SELECT 1 FROM public.clients WHERE id=$1', [temporaryClientId]);
    if (deletedReadback.rows.length !== 0) fail('own client delete database readback found temporary client');
    safeResult('A-own-client-delete-readback', 200, 'temporary client is absent after handler delete');

    const [afterA, afterB, afterTemporary, permanentCounts] = await Promise.all([fixtureSnapshot(pool, aFixture), fixtureSnapshot(pool, bFixture), temporaryWriteCounts(pool, temporaryLabel), fixtureCounts(pool)]);
    assert.equal(afterA, beforeA, 'A permanent fixture values or relationships changed');
    assert.equal(afterB, beforeB, 'B permanent fixture values or relationships changed');
    if (afterTemporary.clients !== 0 || afterTemporary.sites !== 0) fail('temporary write entities remain after handler cleanup');
    if (permanentCounts.clients !== 2 || permanentCounts.quotes !== 2 || permanentCounts.invoices !== 2) fail('permanent fixture aggregate changed');
    safeResult('write-cleanup-readback', 200, 'temporary clients=0 sites=0; A/B permanent fixtures and aggregate relationships unchanged');

    await app.close();
    app = undefined;
    await mcp.clients.disconnect();
    const captured = natsCapture.captures().sort((left, right) => left.subject.localeCompare(right.subject));
    const expectedCaptures = [
      { subject: 'events.clients.client_created', count: 1 },
      { subject: 'events.clients.client_updated', count: 1 },
      { subject: 'events.clients.gdpr_delete_completed', count: 1 },
    ];
    assert.deepEqual(captured, expectedCaptures, 'local no-consumer NATS capture did not record the expected service publishes');
    safeResult('event-publisher-write-capture', 200, JSON.stringify(captured));
    // Close the local capture before MCP process teardown, so any reset caused
    // by the capture's own socket shutdown is the narrowly expected case.
    await natsCapture.close();
    natsCaptureClosed = true;
  }, async () => {
    if (app) await app.close();
    if (temporaryLabel) {
      if (!temporaryClientDeletedByHandler) {
        const removed = await pool.query('DELETE FROM public.clients WHERE name LIKE $1 RETURNING id', [`${temporaryLabel}%`]);
        safeResult('temporary-failure-cleanup', 200, `removed=${removed.rowCount}`);
      }
      const remaining = await temporaryWriteCounts(pool, temporaryLabel);
      if (remaining.clients !== 0 || remaining.sites !== 0) fail('temporary write cleanup final readback was nonzero');
      safeResult('temporary-final-cleanup-readback', 200, `clients=${remaining.clients} sites=${remaining.sites}`);
    }
    if (b2AuthUserId) {
      await pool.query(
        `UPDATE public.auth_tenant_memberships
            SET status='revoked', revoked_at=COALESCE(revoked_at, now()),
                revoked_reason=COALESCE(revoked_reason, 'two-tenant-isolation-rehearsal')
          WHERE auth_user_id=$1 AND status='active'`,
        [b2AuthUserId],
      );
      const finalB2Mapping = await pool.query<{ active: number; revoked: number }>(`
        SELECT
          count(*) FILTER (WHERE status='active' AND revoked_at IS NULL)::int AS active,
          count(*) FILTER (WHERE status='revoked' AND revoked_at IS NOT NULL)::int AS revoked
        FROM public.auth_tenant_memberships WHERE auth_user_id=$1
      `, [b2AuthUserId]);
      if (finalB2Mapping.rows[0].active !== 0 || finalB2Mapping.rows[0].revoked !== 1) fail('B2 final mapping readback did not retain exactly one revoked history and zero active mappings');
      safeResult('B2-final-mapping-readback', 200, 'active=0 revoked-history=1');

      // Preserve the revoked membership audit record, including on failures.
      // Retaining the linked Auth fixture is required to retain this history.
    }
    const counts = await pool.query<{ active: number; revoked: number; b2_active: number; b2_revoked: number }>(`
      SELECT
        count(*) FILTER (WHERE m.status='active' AND m.revoked_at IS NULL)::int AS active,
        count(*) FILTER (WHERE m.status='revoked' AND m.revoked_at IS NOT NULL AND u.email NOT LIKE 'jobbuilda-rehearsal-b2-%')::int AS revoked,
        count(*) FILTER (WHERE m.status='active' AND m.revoked_at IS NULL AND u.email LIKE 'jobbuilda-rehearsal-b2-%')::int AS b2_active,
        count(*) FILTER (WHERE m.status='revoked' AND m.revoked_at IS NOT NULL AND u.email LIKE 'jobbuilda-rehearsal-b2-%')::int AS b2_revoked
      FROM public.auth_tenant_memberships m
      JOIN auth.users u ON u.id=m.auth_user_id
    `);
    if (counts.rows[0].active !== 1 || counts.rows[0].revoked !== 1 || counts.rows[0].b2_active !== 0) fail('final membership counts did not retain one active A, one original revoked B, and zero active B2 mappings');
    safeResult('final-membership-counts', 200, `active=1 original-revoked=1 B2-active=0 B2-revoked=${counts.rows[0].b2_revoked}`);
    if (mcp) await Promise.all(Object.values(mcp).map((client) => client.disconnect()));
    await pool.end();
    if (!natsCaptureClosed) await natsCapture.close();
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'REHEARSAL_BLOCKED: unknown failure');
  process.exitCode = 1;
});
