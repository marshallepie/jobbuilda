import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import { registerAccountIsolationContainment } from '../src/lib/account-isolation-containment.js';
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
  const app = Fastify();
  registerAccountIsolationContainment(app);
  registerServerAuth(app, authDependencies());
  registerVerificationOwnerAccess(app, { environment: env, now: () => now });
  app.get('/api/identity/profile', async (request) => ({
    tenant_id: request.authContext!.tenant_id,
    verified_auth_user_id: request.verifiedAuthUserId,
  }));
  await app.ready();
  return app;
}

test('verification access is default-off and candidate routes still require a bearer token', async () => {
  const app = await verificationBoundary({});

  const contained = await app.inject({ method: 'GET', url: '/api/jobs' });
  assert.equal(contained.statusCode, 503);

  for (const candidate of [
    { method: 'GET' as const, url: '/api/identity/profile' },
    { method: 'GET' as const, url: '/api/clients/clients' },
    { method: 'GET' as const, url: '/api/clients/clients/client-id' },
    { method: 'POST' as const, url: '/api/clients/clients' },
    { method: 'PATCH' as const, url: '/api/clients/clients/client-id' },
    { method: 'DELETE' as const, url: '/api/clients/clients/client-id' },
    { method: 'GET' as const, url: '/api/quotes' },
    { method: 'GET' as const, url: '/api/quotes/quote-id' },
    { method: 'GET' as const, url: '/api/invoices' },
    { method: 'GET' as const, url: '/api/invoices/invoice-id' },
  ]) {
    const response = await app.inject(candidate);
    assert.equal(response.statusCode, 401, `${candidate.method} ${candidate.url}`);
  }
  await app.close();
});

test('verification access rejects malformed configuration, expiry, other owners, and forged headers', async () => {
  const malformed = await verificationBoundary(environment({ [VERIFICATION_OWNER_AUTH_USER_ID_ENV]: 'not-a-uuid' }));
  assert.equal((await malformed.inject({ method: 'GET', url: '/api/identity/profile', headers: { authorization: 'Bearer configured-owner-token' } })).statusCode, 503);
  await malformed.close();

  const expired = await verificationBoundary(environment({ [VERIFICATION_ACCESS_EXPIRES_AT_ENV]: '2029-12-31T23:59:59.999Z' }));
  assert.equal((await expired.inject({ method: 'GET', url: '/api/identity/profile', headers: { authorization: 'Bearer configured-owner-token' } })).statusCode, 403);
  await expired.close();

  const app = await verificationBoundary();
  assert.equal((await app.inject({ method: 'GET', url: '/api/identity/profile', headers: { authorization: 'Bearer other-owner-token' } })).statusCode, 403);
  assert.equal((await app.inject({
    method: 'GET',
    url: '/api/identity/profile',
    headers: { authorization: 'Bearer configured-owner-token', 'x-tenant-id': 'forged' },
  })).statusCode, 401);
  await app.close();
});

test('only the exact configured verified owner reaches an allowlisted route', async () => {
  const app = await verificationBoundary();
  const response = await app.inject({
    method: 'GET',
    url: '/api/identity/profile',
    headers: { authorization: 'Bearer configured-owner-token' },
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { tenant_id: tenantId, verified_auth_user_id: configuredOwnerId });
  await app.close();
});

test('containment denies unnamed routes and every method not explicitly allowlisted', async () => {
  const app = await verificationBoundary();
  for (const request of [
    { method: 'GET' as const, url: '/api/clients/sites/site-id' },
    { method: 'POST' as const, url: '/api/identity/profile' },
    { method: 'PUT' as const, url: '/api/clients/clients/client-id' },
    { method: 'DELETE' as const, url: '/api/quotes/quote-id' },
    { method: 'POST' as const, url: '/api/invoices' },
    { method: 'GET' as const, url: '/api/quotes/quote-id/items' },
  ]) {
    const response = await app.inject({ ...request, headers: { authorization: 'Bearer configured-owner-token' } });
    assert.equal(response.statusCode, 503, `${request.method} ${request.url}`);
  }
  await app.close();
});

test('the allowlist is limited to the reviewed route and method shapes', () => {
  assert.deepEqual(verificationAccessAllowlist, [
    { method: 'GET', path: '/api/identity/profile' },
    { method: 'GET', path: '/api/clients/clients' },
    { method: 'GET', path: '/api/clients/clients/:clientId' },
    { method: 'POST', path: '/api/clients/clients' },
    { method: 'PATCH', path: '/api/clients/clients/:clientId' },
    { method: 'DELETE', path: '/api/clients/clients/:clientId' },
    { method: 'GET', path: '/api/quotes' },
    { method: 'GET', path: '/api/quotes/:id' },
    { method: 'GET', path: '/api/invoices' },
    { method: 'GET', path: '/api/invoices/:id' },
  ]);
  assert.equal(isVerificationAccessCandidate('GET', '/api/clients/clients/client-id'), true);
  assert.equal(isVerificationAccessCandidate('GET', '/api/clients/clients/client-id/sites'), false);
  assert.equal(isVerificationAccessCandidate('POST', '/api/invoices'), false);
  assert.equal(isVerificationAccessCandidate('GET', '/api/subscription/webhook'), false);
});
