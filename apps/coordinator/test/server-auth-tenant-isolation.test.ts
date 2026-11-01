import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import {
  configuredDependencies,
  registerServerAuth,
  ServerAuthDependencies,
} from '../src/lib/auth.js';

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';
const appUserA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const appUserB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function dependencies(): ServerAuthDependencies {
  const identities: Record<string, string> = {
    'token-a': 'auth-a',
    'token-b': 'auth-b',
    'token-revoked': 'auth-revoked',
  };
  const memberships: Record<string, { tenant_id: string; user_id: string; scopes: string[] } | null> = {
    'auth-a': { tenant_id: tenantA, user_id: appUserA, scopes: ['jobs:read', 'jobs:write'] },
    'auth-b': { tenant_id: tenantB, user_id: appUserB, scopes: ['jobs:read', 'jobs:write'] },
    // A revoked (or absent) mapping must not produce a context.
    'auth-revoked': null,
  };
  return {
    async verifyAccessToken(token) {
      return identities[token] ? { id: identities[token] } : null;
    },
    async findActiveMembership(authUserId) {
      return memberships[authUserId] ?? null;
    },
  };
}

async function auditedBoundary() {
  const app = Fastify();
  registerServerAuth(app, dependencies());
  const jobs = new Map([
    ['job-a', { tenant_id: tenantA, title: 'Tenant A job' }],
    ['job-b', { tenant_id: tenantB, title: 'Tenant B job' }],
  ]);

  app.get('/api/audit/jobs/:id', async (request, reply) => {
    const job = jobs.get((request.params as { id: string }).id);
    if (!job || job.tenant_id !== request.authContext!.tenant_id) {
      return reply.status(404).send({ error: 'Job not found' });
    }
    return job;
  });
  app.post('/api/audit/jobs/:id', async (request, reply) => {
    const job = jobs.get((request.params as { id: string }).id);
    if (!job || job.tenant_id !== request.authContext!.tenant_id) {
      return reply.status(404).send({ error: 'Job not found' });
    }
    return { updated: true };
  });
  await app.ready();
  return app;
}

test('server auth derives tenant and scopes only from verified identity plus active membership', async () => {
  const app = await auditedBoundary();
  const response = await app.inject({
    method: 'GET',
    url: '/api/audit/jobs/job-a',
    headers: { authorization: 'Bearer token-a' },
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { tenant_id: tenantA, title: 'Tenant A job' });
  await app.close();
});

test('caller-selected identity headers and invalid or revoked identities fail closed', async () => {
  const app = await auditedBoundary();
  const forgedHeaders = await app.inject({
    method: 'GET',
    url: '/api/audit/jobs/job-b',
    headers: {
      authorization: 'Bearer token-a',
      'x-tenant-id': tenantB,
      'x-user-id': appUserB,
      'x-scopes': 'admin',
    },
  });
  assert.equal(forgedHeaders.statusCode, 401);

  const invalid = await app.inject({ method: 'GET', url: '/api/audit/jobs/job-a', headers: { authorization: 'Bearer nope' } });
  assert.equal(invalid.statusCode, 401);

  const revoked = await app.inject({ method: 'GET', url: '/api/audit/jobs/job-a', headers: { authorization: 'Bearer token-revoked' } });
  assert.equal(revoked.statusCode, 403);
  await app.close();
});

test('tenant A cannot read or write tenant B resource IDs at the coordinator boundary', async () => {
  const app = await auditedBoundary();
  const headers = { authorization: 'Bearer token-a' };
  const read = await app.inject({ method: 'GET', url: '/api/audit/jobs/job-b', headers });
  const write = await app.inject({ method: 'POST', url: '/api/audit/jobs/job-b', headers, payload: { title: 'attempt' } });
  assert.equal(read.statusCode, 404);
  assert.equal(write.statusCode, 404);
  await app.close();
});

test('missing auth configuration does not prevent containment or health startup and fails closed for protected routes', async () => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const previousAnonKey = process.env.SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_ANON_KEY;

  try {
    const app = Fastify();
    registerServerAuth(app);
    app.get('/health', async () => ({ ok: true }));
    app.get('/protected', async () => ({ ok: true }));
    await app.ready();

    assert.equal((await app.inject({ method: 'GET', url: '/health' })).statusCode, 200);
    const protectedResponse = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: 'Bearer user-token' },
    });
    assert.equal(protectedResponse.statusCode, 503);
    assert.deepEqual(protectedResponse.json(), { error: 'Authentication is temporarily unavailable' });
    await app.close();
  } finally {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRoleKey;
    if (previousAnonKey === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = previousAnonKey;
  }
});

test('configured verifier uses the server-only project key and caller bearer token for Supabase Auth', async () => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const previousAnonKey = process.env.SUPABASE_ANON_KEY;
  const previousFetch = globalThis.fetch;
  process.env.SUPABASE_URL = 'https://project.example.co/';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-only-key';
  delete process.env.SUPABASE_ANON_KEY;
  let requestedUrl: string | undefined;
  let requestedHeaders: Headers | undefined;
  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedHeaders = new Headers(init?.headers);
    return new Response(JSON.stringify({ id: 'auth-user-id' }), { status: 200 });
  };

  try {
    const verified = await configuredDependencies().verifyAccessToken('caller-access-token');
    assert.deepEqual(verified, { id: 'auth-user-id' });
    assert.equal(requestedUrl, 'https://project.example.co/auth/v1/user');
    assert.equal(requestedHeaders?.get('apikey'), 'server-only-key');
    assert.equal(requestedHeaders?.get('authorization'), 'Bearer caller-access-token');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRoleKey;
    if (previousAnonKey === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = previousAnonKey;
  }
});

