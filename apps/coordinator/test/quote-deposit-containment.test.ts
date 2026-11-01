import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import { paymentsRoutes } from '../src/routes/payments.js';
import { quoteDepositWebhookRoutes } from '../src/routes/quote-deposit-webhook.js';

const disabledResponse = {
  error: 'Quote deposit checkout unavailable',
  code: 'QUOTE_DEPOSIT_CHECKOUT_DISABLED',
  message: 'Quote deposit payments are temporarily unavailable for maintenance. Please contact the business directly.',
};

test('quote deposit checkout is contained before every MCP or payment effect', async () => {
  const calls = { identityReads: 0, quoteReads: 0, paymentCalls: 0 };
  const app = Fastify();
  (app as any).mcp = {
    identity: { readResource: async () => { calls.identityReads += 1; throw new Error('must not run'); } },
    quoting: { readResource: async () => { calls.quoteReads += 1; throw new Error('must not run'); } },
    payments: { callTool: async () => { calls.paymentCalls += 1; throw new Error('must not run'); } },
  };
  await paymentsRoutes(app);
  await app.ready();

  for (const request of [
    { quoteId: 'quote-1', headers: {}, payload: undefined },
    {
      quoteId: 'quote-2',
      headers: { 'x-tenant-id': 'forged-tenant', 'x-user-id': 'forged-user', authorization: 'Bearer forged' },
      payload: { tenant_id: 'forged-tenant', amount: 1, bypass: true },
    },
  ]) {
    const response = await app.inject({
      method: 'POST',
      url: `/api/payments/quote/${request.quoteId}/deposit-checkout`,
      headers: request.headers,
      payload: request.payload,
    });
    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.json(), disabledResponse);
  }

  assert.deepEqual(calls, { identityReads: 0, quoteReads: 0, paymentCalls: 0 });
  await app.close();
});

test('quote deposit webhook remains registered while quote deposit checkout is contained', async () => {
  const app = Fastify();
  (app as any).mcp = {
    identity: {},
    quoting: {},
    payments: {},
    jobs: {},
    clients: {},
  };
  await paymentsRoutes(app);
  await quoteDepositWebhookRoutes(app);
  await app.ready();

  assert.equal(app.hasRoute({ method: 'POST', url: '/api/payments/checkout-session' }), true);
  assert.equal(app.hasRoute({ method: 'POST', url: '/api/payments/quote-deposit/webhook' }), true);
  await app.close();
});
