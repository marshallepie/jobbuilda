import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import { stripe } from '../src/lib/stripe.js';
import { subscriptionWebhookRoutes } from '../src/routes/subscription-webhook.js';
import { quoteDepositWebhookRoutes } from '../src/routes/quote-deposit-webhook.js';

async function injectSigned(app: ReturnType<typeof Fastify>, url: string) {
  return app.inject({
    method: 'POST',
    url,
    headers: { 'stripe-signature': 'test-signature' },
    payload: { test: true },
  });
}

test('subscription checkout ignores forged metadata when no durable customer mapping exists', async () => {
  const queries: Array<{ text: string; values?: unknown[] }> = [];
  const originalConstructEvent = stripe.webhooks.constructEvent;
  (stripe.webhooks as any).constructEvent = () => ({
    type: 'checkout.session.completed',
    data: { object: {
      customer: 'cus_trusted_absent',
      subscription: 'sub_trusted_absent',
      client_reference_id: 'victim-tenant',
      metadata: { tenant_id: 'victim-tenant' },
    } },
  });

  const app = Fastify();
  await subscriptionWebhookRoutes(app, {
    getPool: () => ({
      query: async (text, values) => {
        queries.push({ text, values });
        return { rows: [] };
      },
    }),
  });
  await app.ready();
  const response = await injectSigned(app, '/api/subscription/webhook');

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { received: true });
  assert.equal(queries.length, 1);
  assert.match(queries[0].text, /WHERE stripe_customer_id = \$1/);
  assert.deepEqual(queries[0].values, ['cus_trusted_absent']);
  assert.doesNotMatch(queries[0].text, /metadata|client_reference|victim-tenant/i);

  await app.close();
  (stripe.webhooks as any).constructEvent = originalConstructEvent;
});

test('subscription update uses the exact durable subscription and customer mapping', async () => {
  const queries: Array<{ text: string; values?: unknown[] }> = [];
  const originalConstructEvent = stripe.webhooks.constructEvent;
  (stripe.webhooks as any).constructEvent = () => ({
    type: 'customer.subscription.updated',
    data: { object: {
      id: 'sub_server_owned',
      customer: 'cus_server_owned',
      status: 'active',
      metadata: { tenant_id: 'forged-tenant' },
      items: { data: [{ quantity: 3 }] },
    } },
  });

  const app = Fastify();
  await subscriptionWebhookRoutes(app, {
    getPool: () => ({
      query: async (text, values) => {
        queries.push({ text, values });
        if (queries.length === 1) {
          return { rows: [{ id: 'tenant-server', stripe_customer_id: 'cus_server_owned', stripe_subscription_id: 'sub_server_owned' }] };
        }
        return { rows: [], rowCount: 1 };
      },
    }),
  });
  await app.ready();
  const response = await injectSigned(app, '/api/subscription/webhook');

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { received: true });
  assert.equal(queries.length, 2);
  assert.match(queries[0].text, /stripe_subscription_id = \$1 AND stripe_customer_id = \$2/);
  assert.deepEqual(queries[0].values, ['sub_server_owned', 'cus_server_owned']);
  assert.match(queries[1].text, /WHERE id = \$3 AND stripe_subscription_id = \$4 AND stripe_customer_id = \$5/);
  assert.deepEqual(queries[1].values, ['active', 3, 'tenant-server', 'sub_server_owned', 'cus_server_owned']);

  await app.close();
  (stripe.webhooks as any).constructEvent = originalConstructEvent;
});

test('subscription checkout links a compatible durable customer without inventing status', async () => {
  const queries: Array<{ text: string; values?: unknown[] }> = [];
  const originalConstructEvent = stripe.webhooks.constructEvent;
  (stripe.webhooks as any).constructEvent = () => ({
    type: 'checkout.session.completed',
    data: { object: {
      customer: 'cus_checkout_owned',
      subscription: 'sub_checkout_owned',
      metadata: { tenant_id: 'forged-tenant' },
    } },
  });

  const app = Fastify();
  await subscriptionWebhookRoutes(app, {
    getPool: () => ({
      query: async (text, values) => {
        queries.push({ text, values });
        if (queries.length === 1) {
          return { rows: [{ id: 'tenant-checkout', stripe_customer_id: 'cus_checkout_owned', stripe_subscription_id: null }] };
        }
        return { rows: [], rowCount: 1 };
      },
    }),
  });
  await app.ready();
  const response = await injectSigned(app, '/api/subscription/webhook');

  assert.equal(response.statusCode, 200);
  assert.equal(queries.length, 2);
  assert.match(queries[1].text, /SET stripe_subscription_id = \$1, updated_at = NOW\(\)/);
  assert.doesNotMatch(queries[1].text, /subscription_status|trialing/i);
  assert.match(queries[1].text, /stripe_subscription_id IS NULL OR stripe_subscription_id = \$1/);
  assert.deepEqual(queries[1].values, ['sub_checkout_owned', 'tenant-checkout', 'cus_checkout_owned']);

  await app.close();
  (stripe.webhooks as any).constructEvent = originalConstructEvent;
});

test('invoice with trusted customer but mismatched subscription performs no update', async () => {
  const queries: Array<{ text: string; values?: unknown[] }> = [];
  const originalConstructEvent = stripe.webhooks.constructEvent;
  (stripe.webhooks as any).constructEvent = () => ({
    type: 'invoice.payment_failed',
    data: { object: { customer: 'cus_invoice_owned', subscription: 'sub_historical_or_unrelated' } },
  });

  const app = Fastify();
  await subscriptionWebhookRoutes(app, {
    getPool: () => ({
      query: async (text, values) => {
        queries.push({ text, values });
        return { rows: [{ id: 'tenant-invoice', stripe_customer_id: 'cus_invoice_owned', stripe_subscription_id: 'sub_current_owned' }] };
      },
    }),
  });
  await app.ready();
  const response = await injectSigned(app, '/api/subscription/webhook');

  assert.equal(response.statusCode, 200);
  assert.equal(queries.length, 1);
  assert.match(queries[0].text, /WHERE stripe_customer_id = \$1/);
  assert.deepEqual(queries[0].values, ['cus_invoice_owned']);
  assert.equal(queries.filter(({ text }) => /^\s*UPDATE\s+tenants/i.test(text)).length, 0);

  await app.close();
  (stripe.webhooks as any).constructEvent = originalConstructEvent;
});

test('invoice without subscription identifier performs no lookup or update', async () => {
  const queries: Array<{ text: string; values?: unknown[] }> = [];
  const originalConstructEvent = stripe.webhooks.constructEvent;
  (stripe.webhooks as any).constructEvent = () => ({
    type: 'invoice.payment_succeeded',
    data: { object: { customer: 'cus_invoice_owned' } },
  });

  const app = Fastify();
  await subscriptionWebhookRoutes(app, {
    getPool: () => ({
      query: async (text, values) => {
        queries.push({ text, values });
        return { rows: [] };
      },
    }),
  });
  await app.ready();
  const response = await injectSigned(app, '/api/subscription/webhook');

  assert.equal(response.statusCode, 200);
  assert.equal(queries.length, 0);
  assert.equal(queries.filter(({ text }) => /^\s*UPDATE\s+tenants/i.test(text)).length, 0);

  await app.close();
  (stripe.webhooks as any).constructEvent = originalConstructEvent;
});

test('invoice with exact durable customer and subscription mapping updates status', async () => {
  const queries: Array<{ text: string; values?: unknown[] }> = [];
  const originalConstructEvent = stripe.webhooks.constructEvent;
  (stripe.webhooks as any).constructEvent = () => ({
    type: 'invoice.payment_failed',
    data: { object: { customer: 'cus_invoice_owned', subscription: 'sub_current_owned' } },
  });

  const app = Fastify();
  await subscriptionWebhookRoutes(app, {
    getPool: () => ({
      query: async (text, values) => {
        queries.push({ text, values });
        if (queries.length === 1) {
          return { rows: [{ id: 'tenant-invoice', stripe_customer_id: 'cus_invoice_owned', stripe_subscription_id: 'sub_current_owned' }] };
        }
        return { rows: [], rowCount: 1 };
      },
    }),
  });
  await app.ready();
  const response = await injectSigned(app, '/api/subscription/webhook');

  assert.equal(response.statusCode, 200);
  assert.equal(queries.length, 2);
  assert.match(queries[1].text, /SET subscription_status = 'past_due'/);
  assert.match(queries[1].text, /stripe_customer_id = \$2 AND stripe_subscription_id = \$3/);
  assert.deepEqual(queries[1].values, ['tenant-invoice', 'cus_invoice_owned', 'sub_current_owned']);

  await app.close();
  (stripe.webhooks as any).constructEvent = originalConstructEvent;
});

test('quote deposit webhook acknowledges forged metadata without MCP calls or email effects', async () => {
  const calls = { quoteReads: 0, quoteWrites: 0, jobWrites: 0, clientReads: 0, identityReads: 0 };
  const originalConstructEvent = stripe.webhooks.constructEvent;
  (stripe.webhooks as any).constructEvent = () => ({
    type: 'checkout.session.completed',
    data: { object: {
      id: 'cs_forged',
      metadata: { payment_type: 'quote_deposit', quote_id: 'quote-victim', tenant_id: 'tenant-victim' },
    } },
  });

  const app = Fastify();
  (app as any).mcp = {
    quoting: {
      readResource: async () => { calls.quoteReads += 1; throw new Error('must not run'); },
      callTool: async () => { calls.quoteWrites += 1; throw new Error('must not run'); },
    },
    jobs: { callTool: async () => { calls.jobWrites += 1; throw new Error('must not run'); } },
    clients: { readResource: async () => { calls.clientReads += 1; throw new Error('must not run'); } },
    identity: { readResource: async () => { calls.identityReads += 1; throw new Error('must not run'); } },
  };
  await quoteDepositWebhookRoutes(app);
  await app.ready();
  const response = await injectSigned(app, '/api/payments/quote-deposit/webhook');

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { received: true });
  assert.deepEqual(calls, { quoteReads: 0, quoteWrites: 0, jobWrites: 0, clientReads: 0, identityReads: 0 });

  await app.close();
  (stripe.webhooks as any).constructEvent = originalConstructEvent;
});
