import assert from 'node:assert/strict';
import test from 'node:test';
import cors from '@fastify/cors';
import Fastify from 'fastify';
import { coordinatorCorsOptions, LEGACY_BROWSER_ALLOWED_HEADERS } from '../src/cors.js';

const origins = {
  admin: 'https://admin.example.test',
  portal: 'https://portal.example.test',
};

async function createApp() {
  const app = Fastify();
  await app.register(cors, coordinatorCorsOptions({
    ADMIN_URL: origins.admin,
    PORTAL_URL: origins.portal,
  }));
  app.post('/api/dashboard', async () => ({ ok: true }));
  app.post('/api/payments/checkout-session', async () => ({ payment: 'unchanged' }));
  app.post('/api/payments/webhook', async () => ({ webhook: 'unchanged' }));
  await app.ready();
  return app;
}

async function preflight(app: Awaited<ReturnType<typeof createApp>>, origin: string) {
  return app.inject({
    method: 'OPTIONS',
    url: '/api/dashboard',
    headers: {
      origin,
      'access-control-request-method': 'POST',
      'access-control-request-headers': LEGACY_BROWSER_ALLOWED_HEADERS.join(', '),
    },
  });
}

test('configured Admin origin permits authenticated dashboard preflight headers and credentials', async () => {
  const app = await createApp();
  const response = await preflight(app, origins.admin);

  assert.equal(response.statusCode, 204);
  assert.equal(response.headers['access-control-allow-origin'], origins.admin);
  assert.equal(response.headers['access-control-allow-credentials'], 'true');
  for (const header of LEGACY_BROWSER_ALLOWED_HEADERS) {
    assert.match(response.headers['access-control-allow-headers'] || '', new RegExp(header, 'i'));
  }
  assert.doesNotMatch(response.headers['access-control-allow-headers'] || '', /x-tenant-id|x-user-id/i);
  await app.close();
});

test('configured Portal origin permits preflight and credentials', async () => {
  const app = await createApp();
  const response = await preflight(app, origins.portal);

  assert.equal(response.statusCode, 204);
  assert.equal(response.headers['access-control-allow-origin'], origins.portal);
  assert.equal(response.headers['access-control-allow-credentials'], 'true');
  await app.close();
});

test('unconfigured origins receive no CORS approval', async () => {
  const app = await createApp();
  const response = await preflight(app, 'https://untrusted.example.test');

  assert.equal(response.headers['access-control-allow-origin'], undefined);
  assert.equal(response.headers['access-control-allow-credentials'], undefined);
  await app.close();
});

test('payment and webhook routes remain available without an Origin header', async () => {
  const app = await createApp();

  const payment = await app.inject({ method: 'POST', url: '/api/payments/checkout-session' });
  const webhook = await app.inject({ method: 'POST', url: '/api/payments/webhook' });

  assert.equal(payment.statusCode, 200);
  assert.deepEqual(payment.json(), { payment: 'unchanged' });
  assert.equal(webhook.statusCode, 200);
  assert.deepEqual(webhook.json(), { webhook: 'unchanged' });
  await app.close();
});
