import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import { registerAccountIsolationContainment } from '../src/lib/account-isolation-containment.js';
import { subscriptionRoutes } from '../src/routes/subscription.js';
import { clientsRoutes } from '../src/routes/clients.js';
import { jobsRoutes } from '../src/routes/jobs.js';
import { stripe } from '../src/lib/stripe.js';
import { registerServerAuth, ServerAuthDependencies } from '../src/lib/auth.js';

const serverTenantId = '11111111-1111-4111-8111-111111111111';
const serverUserId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const serverAuthDependencies: ServerAuthDependencies = {
  async verifyAccessToken(token) { return token === 'valid' ? { id: 'auth-a' } : null; },
  async findActiveMembership(authUserId) {
    return authUserId === 'auth-a'
      ? { tenant_id: serverTenantId, user_id: serverUserId, scopes: ['jobs:read'] }
      : null;
  },
};

test('forged tenant headers cannot reach real tenant read or write handlers', async () => {
  const calls = { reads: 0, writes: 0 };
  const contexts: Array<{ tenant_id: string; user_id: string; scopes: string[] }> = [];
  const app = Fastify();
  (app as any).mcp = {
    clients: {
      readResource: async (_uri: string, context: typeof contexts[number]) => {
        calls.reads += 1;
        contexts.push(context);
        return { data: { clients: [] } };
      },
    },
    jobs: {
      callTool: async (_name: string, _input: unknown, context: typeof contexts[number]) => {
        calls.writes += 1;
        contexts.push(context);
        return { content: [{ text: JSON.stringify({ id: 'job-1' }) }] };
      },
    },
  };
  registerServerAuth(app, serverAuthDependencies);
  registerAccountIsolationContainment(app);
  await clientsRoutes(app);
  await jobsRoutes(app);
  await app.ready();

  const forgedHeaders = {
    authorization: 'Bearer valid',
    'x-tenant-id': 'other-tenant',
    'x-user-id': 'other-user',
    'x-scopes': 'admin',
  };
  for (const request of [
    { method: 'GET' as const, url: '/api/clients/clients' },
    { method: 'POST' as const, url: '/api/jobs', payload: { tenant_id: 'other-tenant' } },
  ]) {
    const response = await app.inject({ ...request, headers: forgedHeaders });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error, 'Caller-selected tenant, user, and scope headers are not accepted');
  }
  assert.deepEqual(calls, { reads: 0, writes: 0 });

  const read = await app.inject({ method: 'GET', url: '/api/clients/clients', headers: { authorization: 'Bearer valid' } });
  const write = await app.inject({ method: 'POST', url: '/api/jobs', headers: { authorization: 'Bearer valid' }, payload: {} });
  assert.equal(read.statusCode, 200);
  assert.equal(write.statusCode, 200);
  assert.deepEqual(calls, { reads: 1, writes: 1 });
  assert.deepEqual(contexts.map(({ tenant_id, user_id, scopes }) => ({ tenant_id, user_id, scopes })), [
    { tenant_id: serverTenantId, user_id: serverUserId, scopes: ['jobs:read'] },
    { tenant_id: serverTenantId, user_id: serverUserId, scopes: ['jobs:read'] },
  ]);
  await app.close();
});

test('health and Stripe webhook paths remain reachable by containment', async () => {
  let webhookCalls = 0;
  const app = Fastify();
  registerAccountIsolationContainment(app);
  app.get('/health', async () => ({ status: 'ok' }));
  app.post('/api/subscription/webhook', async (request, reply) => {
    webhookCalls += 1;
    if (!request.headers['stripe-signature']) {
      return reply.status(400).send({ error: 'Missing stripe-signature header' });
    }
    return { received: true };
  });
  await app.ready();

  const health = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(health.statusCode, 200);
  assert.deepEqual(health.json(), { status: 'ok' });

  const webhook = await app.inject({ method: 'POST', url: '/api/subscription/webhook' });
  assert.equal(webhook.statusCode, 400);
  assert.deepEqual(webhook.json(), { error: 'Missing stripe-signature header' });
  assert.equal(webhookCalls, 1);
  await app.close();
});

test('registration pause creates no Supabase user, Stripe customer, or checkout', async () => {
  let customerCalls = 0;
  let checkoutCalls = 0;
  const originalCustomerCreate = stripe.customers.create;
  const originalCheckoutCreate = stripe.checkout.sessions.create;
  (stripe.customers as any).create = async () => {
    customerCalls += 1;
    throw new Error('must not run');
  };
  (stripe.checkout.sessions as any).create = async () => {
    checkoutCalls += 1;
    throw new Error('must not run');
  };

  const app = Fastify();
  await subscriptionRoutes(app);
  await app.ready();
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'synthetic@example.test', password: 'not-used', company_name: 'Synthetic' },
  });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), {
    error: 'Registration temporarily unavailable',
    code: 'REGISTRATION_PAUSED',
    message: 'New trials and subscription checkout are temporarily unavailable while we complete maintenance.',
  });
  assert.equal(customerCalls, 0);
  assert.equal(checkoutCalls, 0);

  await app.close();
  (stripe.customers as any).create = originalCustomerCreate;
  (stripe.checkout.sessions as any).create = originalCheckoutCreate;
});
