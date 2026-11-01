import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import { paymentsRoutes } from '../src/routes/payments.js';
import { quoteDepositWebhookRoutes } from '../src/routes/quote-deposit-webhook.js';
import { stripe } from '../src/lib/stripe.js';

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

test('invoice checkout remains separately registered and quote deposit webhook remains registered', async () => {
  let invoiceCheckoutCalls = 0;
  const originalCreate = stripe.checkout.sessions.create;
  (stripe.checkout.sessions as any).create = async () => {
    invoiceCheckoutCalls += 1;
    return { url: 'https://checkout.example.test/invoice-session' };
  };

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

  const invoiceCheckout = await app.inject({
    method: 'POST',
    url: '/api/payments/checkout-session',
    headers: { 'x-tenant-id': 'tenant-1', 'x-user-id': 'user-1' },
    payload: {
      invoice_id: 'invoice-1',
      amount: 12.5,
      success_url: 'https://portal.example.test/payment/success',
      cancel_url: 'https://portal.example.test/payment/cancel',
    },
  });
  assert.equal(invoiceCheckout.statusCode, 200, JSON.stringify(invoiceCheckout.json()));
  assert.deepEqual(invoiceCheckout.json(), { checkout_url: 'https://checkout.example.test/invoice-session' });
  assert.equal(invoiceCheckoutCalls, 1);
  await app.close();
  (stripe.checkout.sessions as any).create = originalCreate;
});
