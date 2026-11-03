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
import { clientsRoutes } from '../src/routes/clients.js';

const configuredOwnerId = '11111111-1111-4111-8111-111111111111';
const otherOwnerId = '22222222-2222-4222-8222-222222222222';
const tenantId = '33333333-3333-4333-8333-333333333333';
const appUserId = '44444444-4444-4444-8444-444444444444';
const resourceId = '55555555-5555-4555-8555-555555555555';
const now = Date.parse('2030-01-01T00:00:00.000Z');

interface BoundaryObservability {
  authCalls: number;
  handlerCalls: number;
}

function authDependencies(observability?: BoundaryObservability): ServerAuthDependencies {
  return {
    async verifyAccessToken(token) {
      if (observability) observability.authCalls += 1;
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

async function verificationBoundary(
  env: NodeJS.ProcessEnv = environment(),
  observability?: BoundaryObservability,
) {
  const app = Fastify({
    routerOptions: {
      onBadUrl: (_path, _request, response) => sendContainmentBadUrlResponse(response),
    },
  });
  registerAccountIsolationContainment(app);
  registerServerAuth(app, authDependencies(observability));
  registerVerificationOwnerAccess(app, { environment: env, now: () => now });
  const handler = async (request: { authContext: { tenant_id: string } | null; verifiedAuthUserId: string | null }) => {
    if (observability) observability.handlerCalls += 1;
    return {
      tenant_id: request.authContext!.tenant_id,
      verified_auth_user_id: request.verifiedAuthUserId,
    };
  };
  app.get('/api/identity/profile', handler);
  app.get('/api/clients/clients/:clientId', handler);
  app.patch('/api/clients/clients/:clientId', handler);
  app.delete('/api/clients/gdpr/:clientId', handler);
  app.get('/api/quotes/:id', handler);
  app.get('/api/invoices/:id', handler);
  app.post('/api/subscription/webhook', async (_request, reply) => reply.status(204).send());
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
    { method: 'GET' as const, url: `/api/clients/clients/${resourceId}` },
    { method: 'POST' as const, url: '/api/clients/clients' },
    { method: 'PATCH' as const, url: `/api/clients/clients/${resourceId}` },
    { method: 'DELETE' as const, url: `/api/clients/gdpr/${resourceId}?confirm=true` },
    { method: 'GET' as const, url: '/api/quotes' },
    { method: 'GET' as const, url: `/api/quotes/${resourceId}` },
    { method: 'GET' as const, url: '/api/invoices' },
    { method: 'GET' as const, url: `/api/invoices/${resourceId}` },
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
  const webhook = await app.inject({ method: 'POST', url: '/api/subscription/webhook' });
  assert.equal(webhook.statusCode, 204);

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

test('encoded, double-encoded, malformed, and non-UUID resource IDs stay contained before auth or handlers', async () => {
  const observability = { authCalls: 0, handlerCalls: 0 };
  const app = await verificationBoundary(environment(), observability);
  const malformedOrEncodedPaths = [
    { method: 'GET' as const, url: '/api/clients/clients/%2Fhidden' },
    { method: 'PATCH' as const, url: '/api/clients/clients/%5Chidden' },
    { method: 'DELETE' as const, url: '/api/clients/clients/%3Fhidden' },
    { method: 'GET' as const, url: '/api/quotes/%23hidden' },
    { method: 'GET' as const, url: '/api/invoices/%252Fhidden' },
    { method: 'GET' as const, url: '/api/clients/clients/%' },
    { method: 'GET' as const, url: '/api/quotes/not-a-uuid' },
    { method: 'GET' as const, url: '/api/invoices/11111111-1111-4111-8111-11111111111%31' },
  ];

  for (const request of malformedOrEncodedPaths) {
    const response = await app.inject({
      ...request,
      headers: { authorization: 'Bearer configured-owner-token' },
    });
    assert.equal(response.statusCode, 503, `${request.method} ${request.url}`);
  }
  assert.equal(observability.authCalls, 0);
  assert.equal(observability.handlerCalls, 0);

  for (const request of [
    { method: 'GET' as const, url: `/api/clients/clients/${resourceId}` },
    { method: 'PATCH' as const, url: `/api/clients/clients/${resourceId}` },
    { method: 'DELETE' as const, url: `/api/clients/gdpr/${resourceId}?confirm=true` },
    { method: 'GET' as const, url: `/api/quotes/${resourceId}` },
    { method: 'GET' as const, url: `/api/invoices/${resourceId}` },
  ]) {
    const normal = await app.inject({
      ...request,
      headers: { authorization: 'Bearer configured-owner-token' },
    });
    assert.equal(normal.statusCode, 200, `${request.method} ${request.url}`);
  }
  assert.equal(observability.authCalls, 5);
  assert.equal(observability.handlerCalls, 5);
  await app.close();
});

test('the registered GDPR handler requires confirmation and cannot delete a foreign tenant client', async () => {
  const ownedClientId = '66666666-6666-4666-8666-666666666666';
  const foreignClientId = '77777777-7777-4777-8777-777777777777';
  const clients = new Map([
    [ownedClientId, tenantId],
    [foreignClientId, '88888888-8888-4888-8888-888888888888'],
  ]);
  let gdprDeleteCalls = 0;
  let nextRawUrl: string | undefined;
  const app = Fastify();
  app.decorate('mcp', {
    clients: {
      async callTool(name: string, input: { client_id: string; confirm: boolean }, context: { tenant_id: string }) {
        assert.equal(name, 'gdpr_delete');
        gdprDeleteCalls += 1;
        if (!input.confirm || clients.get(input.client_id) !== context.tenant_id) {
          throw new Error('client is not deletable in this tenant');
        }
        clients.delete(input.client_id);
        return { content: [{ text: JSON.stringify({ deleted: true }) }] };
      },
    },
  } as any);
  // light-my-request normalizes a trailing `?`; preserve the real raw-request
  // form for this containment regression before the production hooks run.
  app.addHook('onRequest', async (request) => {
    if (nextRawUrl) {
      request.raw.url = nextRawUrl;
      nextRawUrl = undefined;
    }
  });
  registerAccountIsolationContainment(app);
  registerServerAuth(app, authDependencies());
  registerVerificationOwnerAccess(app, { environment: environment(), now: () => now });
  await clientsRoutes(app);
  await app.ready();

  const headers = { authorization: 'Bearer configured-owner-token' };
  nextRawUrl = `/api/clients/gdpr/${ownedClientId}?`;
  const emptyQueryIsContained = await app.inject({
    method: 'DELETE', url: `/api/clients/gdpr/${ownedClientId}?`, headers,
  });
  assert.equal(emptyQueryIsContained.statusCode, 503);
  assert.equal(clients.has(ownedClientId), true);
  assert.equal(gdprDeleteCalls, 0);

  const unauthenticatedMissingConfirmation = await app.inject({
    method: 'DELETE', url: `/api/clients/gdpr/${ownedClientId}`,
  });
  assert.equal(unauthenticatedMissingConfirmation.statusCode, 401);
  const otherOwnerMissingConfirmation = await app.inject({
    method: 'DELETE', url: `/api/clients/gdpr/${ownedClientId}`,
    headers: { authorization: 'Bearer other-owner-token' },
  });
  assert.equal(otherOwnerMissingConfirmation.statusCode, 403);
  assert.equal(gdprDeleteCalls, 0);

  const missingConfirmation = await app.inject({
    method: 'DELETE', url: `/api/clients/gdpr/${ownedClientId}`, headers,
  });
  assert.equal(missingConfirmation.statusCode, 404);
  assert.deepEqual(missingConfirmation.json(), { error: 'Client not found' });
  assert.equal(clients.has(ownedClientId), true);
  assert.equal(gdprDeleteCalls, 0);

  const foreignDeletion = await app.inject({
    method: 'DELETE', url: `/api/clients/gdpr/${foreignClientId}?confirm=true`, headers,
  });
  assert.equal(foreignDeletion.statusCode, 404);
  assert.equal(clients.has(foreignClientId), true);
  assert.equal(gdprDeleteCalls, 1);

  const ownedDeletion = await app.inject({
    method: 'DELETE', url: `/api/clients/gdpr/${ownedClientId}?confirm=true`, headers,
  });
  assert.equal(ownedDeletion.statusCode, 200);
  assert.deepEqual(ownedDeletion.json(), { deleted: true });
  assert.equal(clients.has(ownedClientId), false);
  assert.equal(gdprDeleteCalls, 2);
  await app.close();
});

test('the allowlist is limited to the reviewed route and method shapes', () => {
  assert.deepEqual(verificationAccessAllowlist, [
    { method: 'GET', path: '/api/identity/profile' },
    { method: 'GET', path: '/api/clients/clients' },
    { method: 'GET', path: '/api/clients/clients/:clientId' },
    { method: 'POST', path: '/api/clients/clients' },
    { method: 'PATCH', path: '/api/clients/clients/:clientId' },
    { method: 'DELETE', path: '/api/clients/gdpr/:clientId?confirm=true' },
    { method: 'GET', path: '/api/quotes' },
    { method: 'GET', path: '/api/quotes/:id' },
    { method: 'GET', path: '/api/invoices' },
    { method: 'GET', path: '/api/invoices/:id' },
  ]);
  assert.equal(isVerificationAccessCandidate('GET', `/api/clients/clients/${resourceId}`), true);
  assert.equal(isVerificationAccessCandidate('DELETE', `/api/clients/gdpr/${resourceId}`), true);
  assert.equal(isVerificationAccessCandidate('DELETE', `/api/clients/gdpr/${resourceId}?confirm=true`), true);
  assert.equal(isVerificationAccessCandidate('DELETE', `/api/clients/gdpr/${resourceId}?`), false);
  assert.equal(isVerificationAccessCandidate('DELETE', `/api/clients/gdpr/${resourceId}?confirm=false`), false);
  assert.equal(isVerificationAccessCandidate('DELETE', `/api/clients/gdpr/${resourceId}?confirm=true&extra=value`), false);
  assert.equal(isVerificationAccessCandidate('DELETE', `/api/clients/clients/${resourceId}`), false);
  assert.equal(isVerificationAccessCandidate('GET', '/api/clients/clients/client-id'), false);
  assert.equal(isVerificationAccessCandidate('GET', '/api/clients/clients/%2Fhidden'), false);
  assert.equal(isVerificationAccessCandidate('GET', '/api/quotes/%23hidden'), false);
  assert.equal(isVerificationAccessCandidate('GET', '/api/invoices/%252Fhidden'), false);
  assert.equal(isVerificationAccessCandidate('GET', '/api/clients/clients/%'), false);
  assert.equal(isVerificationAccessCandidate('GET', `/api/clients/clients/${resourceId}/sites`), false);
  assert.equal(isVerificationAccessCandidate('POST', '/api/invoices'), false);
  assert.equal(isVerificationAccessCandidate('GET', '/api/subscription/webhook'), false);
});
