import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import { registerServerAuth, ServerAuthDependencies } from '../src/lib/auth.js';
import { previewRoutes } from '../src/routes/preview.js';
import { pdfRoutes } from '../src/routes/pdf.js';
import { emailRoutes } from '../src/routes/email.js';
import { paymentsRoutes } from '../src/routes/payments.js';

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';
const userA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function dependencies(scopes: string[] = []): ServerAuthDependencies {
  return {
    async verifyAccessToken(token) {
      return token === 'token-a' ? { id: 'auth-a' } : null;
    },
    async findActiveMembership(authUserId) {
      return authUserId === 'auth-a' ? { tenant_id: tenantA, user_id: userA, scopes } : null;
    },
  };
}

async function appWith(routes: (app: any) => Promise<void>, mcp: any, scopes: string[] = []) {
  const app = Fastify();
  app.decorate('mcp', mcp);
  registerServerAuth(app, dependencies(scopes));
  await routes(app);
  await app.ready();
  return app;
}

const forgedIdentity = {
  authorization: 'Bearer token-a',
  'x-tenant-id': tenantB,
  'x-user-id': 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
};

test('preview ignores tenant query values and rejects forged tenant headers', async () => {
  const contexts: any[] = [];
  const app = await appWith(previewRoutes, {
    identity: {
      async readResource(_resource: string, context: any) {
        contexts.push(context);
        return { data: { name: `Tenant ${context.tenant_id}` } };
      },
    },
    quoting: { async readResource() { throw new Error('not used'); } },
  });

  const queryResponse = await app.inject({
    method: 'GET',
    url: `/api/preview/invoice?tenant_id=${tenantB}`,
    headers: { authorization: 'Bearer token-a' },
  });
  assert.equal(queryResponse.statusCode, 200);
  assert.equal(contexts[0].tenant_id, tenantA);

  const forged = await app.inject({ method: 'GET', url: '/api/preview/invoice', headers: forgedIdentity });
  assert.equal(forged.statusCode, 401);
  assert.equal(contexts.length, 1);
  await app.close();
});

test('PDF and email routes pass only the server-derived tenant context downstream', async () => {
  for (const [name, routes, request] of [
    ['pdf', pdfRoutes, { method: 'GET' as const, url: `/api/pdf/quote/quote-a?tenant_id=${tenantB}` }],
    ['email', emailRoutes, { method: 'POST' as const, url: `/api/email/quote/quote-a/send?tenant_id=${tenantB}` }],
  ]) {
    const contexts: any[] = [];
    const app = await appWith(routes, {
      quoting: {
        async readResource(_resource: string, context: any) {
          contexts.push(context);
          throw new Error('stop before PDF/email side effects');
        },
      },
      identity: { async readResource() { throw new Error('must not run'); } },
      clients: { async readResource() { throw new Error('must not run'); } },
      invoicing: { async readResource() { throw new Error('must not run'); } },
    });

    const queryResponse = await app.inject({ ...request, headers: { authorization: 'Bearer token-a' } });
    assert.equal(queryResponse.statusCode, 500, name);
    assert.equal(contexts[0].tenant_id, tenantA, name);

    const forged = await app.inject({ ...request, headers: forgedIdentity });
    assert.equal(forged.statusCode, 401, name);
    assert.equal(contexts.length, 1, name);
    await app.close();
  }
});

test('Stripe Connect uses the server tenant and fails closed without payments management scope', async () => {
  const deniedCalls = { reads: 0, writes: 0 };
  const denied = await appWith(paymentsRoutes, {
    identity: {
      async readResource() { deniedCalls.reads += 1; throw new Error('must not run'); },
      async callTool() { deniedCalls.writes += 1; throw new Error('must not run'); },
    },
  });
  for (const request of [
    { method: 'GET' as const, url: '/api/payments/connect/authorize' },
    { method: 'GET' as const, url: '/api/payments/connect/status' },
    { method: 'POST' as const, url: '/api/payments/connect/disconnect' },
  ]) {
    const response = await denied.inject({ ...request, headers: { authorization: 'Bearer token-a' } });
    assert.equal(response.statusCode, 403);
    assert.deepEqual(response.json(), {
      error: 'Stripe Connect management is not authorized',
      code: 'PAYMENTS_MANAGE_REQUIRED',
    });
  }
  assert.deepEqual(deniedCalls, { reads: 0, writes: 0 });
  await denied.close();

  const contexts: any[] = [];
  const app = await appWith(paymentsRoutes, {
    identity: {
      async readResource(_resource: string, context: any) {
        contexts.push(context);
        return { data: {} };
      },
      async callTool() { throw new Error('must not run'); },
    },
  }, ['payments:manage']);

  const queryResponse = await app.inject({
    method: 'GET',
    url: `/api/payments/connect/status?tenant_id=${tenantB}`,
    headers: { authorization: 'Bearer token-a' },
  });
  assert.equal(queryResponse.statusCode, 200);
  assert.equal(contexts[0].tenant_id, tenantA);

  const forged = await app.inject({
    method: 'GET',
    url: '/api/payments/connect/status',
    headers: forgedIdentity,
  });
  assert.equal(forged.statusCode, 401);
  assert.equal(contexts.length, 1);
  await app.close();
});
