import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import {
  registerAccountIsolationContainment,
  sendContainmentBadUrlResponse,
} from '../src/lib/account-isolation-containment.js';
import { registerServerAuth, ServerAuthDependencies } from '../src/lib/auth.js';
import {
  VERIFICATION_ACCESS_EXPIRES_AT_ENV,
  VERIFICATION_OWNER_AUTH_USER_ID_ENV,
  isVerificationAccessCandidate,
  registerVerificationOwnerAccess,
  verificationAccessAllowlist,
} from '../src/lib/verification-owner-access.js';

const configuredOwnerId = '11111111-1111-4111-8111-111111111111';
const otherOwnerId = '22222222-2222-4222-8222-222222222222';
const tenantId = '33333333-3333-4333-8333-333333333333';
const appUserId = '44444444-4444-4444-8444-444444444444';
const resourceId = '55555555-5555-4555-8555-555555555555';
const now = Date.parse('2030-01-01T00:00:00.000Z');

function authDependencies(): ServerAuthDependencies {
  return {
    async verifyAccessToken(token) {
      if (token === 'configured-owner-token') return { id: configuredOwnerId };
      if (token === 'other-owner-token') return { id: otherOwnerId };
      return null;
    },
    async findActiveMembership(authUserId) {
      if (authUserId === configuredOwnerId || authUserId === otherOwnerId) {
        return { tenant_id: tenantId, user_id: appUserId, scopes: ['admin'], role: 'admin' };
      }
      return null;
    },
  };
}

function environment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    [VERIFICATION_OWNER_AUTH_USER_ID_ENV]: configuredOwnerId,
    [VERIFICATION_ACCESS_EXPIRES_AT_ENV]: '2030-01-01T01:00:00.000Z',
    ...overrides,
  };
}

async function verificationBoundary(env: NodeJS.ProcessEnv = environment()) {
  const app = Fastify({
    routerOptions: {
      onBadUrl: (_path, _request, response) => sendContainmentBadUrlResponse(response),
    },
  });
  registerAccountIsolationContainment(app);
  registerServerAuth(app, authDependencies());
  registerVerificationOwnerAccess(app, { environment: env, now: () => now });
  const handler = async (request: { authContext: { tenant_id: string } | null; verifiedAuthUserId: string | null }) => ({
    tenant_id: request.authContext!.tenant_id,
    verified_auth_user_id: request.verifiedAuthUserId,
  });
  app.get('/api/identity/profile', handler);
  app.get('/api/clients/clients', handler);
  app.get('/api/clients/clients/:clientId', handler);
  app.get('/api/quotes', handler);
  app.get('/api/quotes/:id', handler);
  app.get('/api/invoices', handler);
  app.get('/api/invoices/:id', handler);
  app.post('/api/subscription/webhook', async (_request, reply) => reply.status(204).send());
  app.post('/api/payments/quote-deposit/webhook', async (_request, reply) => reply.status(204).send());
  await app.ready();
  return app;
}

const readCandidates = [
  '/api/identity/profile',
  '/api/clients/clients',
  `/api/clients/clients/${resourceId}`,
  '/api/quotes',
  `/api/quotes/${resourceId}`,
  '/api/invoices',
  `/api/invoices/${resourceId}`,
];

test('verification access is default-off and candidate reads still require a bearer token', async () => {
  const app = await verificationBoundary({});
  assert.equal((await app.inject({ method: 'GET', url: '/api/jobs' })).statusCode, 503);
  for (const url of readCandidates) {
    assert.equal((await app.inject({ method: 'GET', url })).statusCode, 401, url);
  }
  await app.close();
});

test('configured owner access requires valid configuration, unexpired server time, and exact identity', async () => {
  const missing = await verificationBoundary({});
  assert.equal((await missing.inject({ method: 'GET', url: '/api/identity/profile', headers: { authorization: 'Bearer configured-owner-token' } })).statusCode, 503);
  await missing.close();

  const expired = await verificationBoundary(environment({ [VERIFICATION_ACCESS_EXPIRES_AT_ENV]: '2029-12-31T23:59:59.999Z' }));
  assert.equal((await expired.inject({ method: 'GET', url: '/api/identity/profile', headers: { authorization: 'Bearer configured-owner-token' } })).statusCode, 403);
  await expired.close();

  const app = await verificationBoundary();
  assert.equal((await app.inject({ method: 'GET', url: '/api/identity/profile', headers: { authorization: 'Bearer other-owner-token' } })).statusCode, 403);
  assert.equal((await app.inject({ method: 'GET', url: '/api/identity/profile', headers: { authorization: 'Bearer configured-owner-token', 'x-tenant-id': tenantId } })).statusCode, 401);
  const allowed = await app.inject({ method: 'GET', url: '/api/identity/profile', headers: { authorization: 'Bearer configured-owner-token' } });
  assert.equal(allowed.statusCode, 200);
  assert.deepEqual(allowed.json(), { tenant_id: tenantId, verified_auth_user_id: configuredOwnerId });
  await app.close();
});

test('only reviewed GET collection and canonical UUID direct-read forms pass containment', async () => {
  const app = await verificationBoundary();
  const headers = { authorization: 'Bearer configured-owner-token' };
  for (const url of readCandidates) {
    assert.equal((await app.inject({ method: 'GET', url, headers })).statusCode, 200, url);
  }
  for (const request of [
    { method: 'POST' as const, url: '/api/clients/clients' },
    { method: 'PATCH' as const, url: `/api/clients/clients/${resourceId}` },
    { method: 'DELETE' as const, url: `/api/clients/gdpr/${resourceId}?confirm=true` },
    { method: 'POST' as const, url: '/api/invoices' },
    { method: 'GET' as const, url: '/api/quotes/not-a-uuid' },
    { method: 'GET' as const, url: '/api/invoices/%252Fhidden' },
    { method: 'GET' as const, url: `/api/clients/clients/${resourceId}/sites` },
  ]) {
    assert.equal((await app.inject({ ...request, headers })).statusCode, 503, `${request.method} ${request.url}`);
  }
  await app.close();
});

test('both signed webhook paths remain outside bearer and containment gates', async () => {
  const app = await verificationBoundary();
  assert.equal((await app.inject({ method: 'POST', url: '/api/subscription/webhook' })).statusCode, 204);
  assert.equal((await app.inject({ method: 'POST', url: '/api/payments/quote-deposit/webhook' })).statusCode, 204);
  await app.close();
});

test('allowlist has no writes and rejects encoded or malformed UUID forms', () => {
  assert.deepEqual(verificationAccessAllowlist, [
    { method: 'GET', path: '/api/identity/profile' },
    { method: 'GET', path: '/api/clients/clients' },
    { method: 'GET', path: '/api/clients/clients/:clientId' },
    { method: 'GET', path: '/api/quotes' },
    { method: 'GET', path: '/api/quotes/:id' },
    { method: 'GET', path: '/api/invoices' },
    { method: 'GET', path: '/api/invoices/:id' },
  ]);
  for (const url of ['/api/clients/clients/%2Fhidden', '/api/quotes/%23hidden', '/api/invoices/%252Fhidden', '/api/clients/clients/%']) {
    assert.equal(isVerificationAccessCandidate('GET', url), false, url);
  }
  assert.equal(isVerificationAccessCandidate('POST', '/api/clients/clients'), false);
  assert.equal(isVerificationAccessCandidate('PATCH', `/api/clients/clients/${resourceId}`), false);
});
