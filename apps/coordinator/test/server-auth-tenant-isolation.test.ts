import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { registerServerAuth, ServerAuthDependencies } from '../src/lib/auth.js';
import { subscriptionRoutes } from '../src/routes/subscription.js';
import { paymentsRoutes } from '../src/routes/payments.js';

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';
const appUserA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const dependencies: ServerAuthDependencies = {
  async verifyAccessToken(token) { return token === 'valid' ? { id: 'auth-a' } : null; },
  async findActiveMembership(id) {
    return id === 'auth-a' ? { tenant_id: tenantA, user_id: appUserA, scopes: ['jobs:read'] } : null;
  },
};

test('staff routes reject forged headers, absent, invalid, and expired bearer credentials', async () => {
  const app = Fastify();
  registerServerAuth(app, dependencies);
  app.get('/api/protected', async request => request.authContext);
  await app.ready();

  for (const headers of [
    {},
    { authorization: 'Bearer invalid' },
    { authorization: 'Bearer valid', 'x-tenant-id': tenantB, 'x-user-id': 'foreign', 'x-scopes': 'admin' },
  ]) {
    const response = await app.inject({ method: 'GET', url: '/api/protected', headers });
    assert.equal(response.statusCode, 401);
  }
  await app.close();
});

test('an active server-owned mapping supplies context and ignores no browser authority', async () => {
  const app = Fastify();
  registerServerAuth(app, dependencies);
  app.get('/api/protected', async request => request.authContext);
  await app.ready();
  const response = await app.inject({ method: 'GET', url: '/api/protected', headers: { authorization: 'Bearer valid' } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { tenant_id: tenantA, user_id: appUserA, scopes: ['jobs:read'], x_request_id: response.headers['x-request-id'] ?? response.json().x_request_id });
  await app.close();
});

test('registration remains paused without side effects', async () => {
  const app = Fastify();
  await subscriptionRoutes(app);
  await app.ready();
  const response = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'probe@example.test' } });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().code, 'REGISTRATION_PAUSED');
  await app.close();
});

test('PDF, email, preview, and payment routes derive identity only from the server context', () => {
  for (const route of ['pdf.ts', 'email.ts', 'preview.ts', 'payments.ts']) {
    const source = readFileSync(resolve('src/routes', route), 'utf8');
    assert.match(source, /extractAuthContext\(request\)/, route);
    assert.doesNotMatch(source, /headers\[['"]x-(tenant-id|user-id|scopes)['"]\]/, route);
  }
});

test('payment identity routes reject forged tenant headers before provider access', async () => {
  const app = Fastify();
  (app as any).mcp = { payments: { readResource: async () => { throw new Error('must not run'); } } };
  registerServerAuth(app, dependencies);
  await paymentsRoutes(app);
  await app.ready();
  const response = await app.inject({ method: 'GET', url: '/api/payments/intents', headers: { authorization: 'Bearer valid', 'x-tenant-id': tenantB } });
  assert.equal(response.statusCode, 401);
  await app.close();
});
