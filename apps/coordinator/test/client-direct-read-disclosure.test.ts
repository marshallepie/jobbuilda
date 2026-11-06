import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import { registerServerAuth, ServerAuthDependencies } from '../src/lib/auth.js';
import { identityRoutes } from '../src/routes/identity.js';
import { clientsRoutes } from '../src/routes/clients.js';
import { quotingRoutes } from '../src/routes/quoting.js';
import { invoicingRoutes } from '../src/routes/invoicing.js';

const tenantA = '11111111-1111-4111-8111-111111111111';
const foreignId = '22222222-2222-4222-8222-222222222222';
const missingId = '33333333-3333-4333-8333-333333333333';

const dependencies: ServerAuthDependencies = {
  async verifyAccessToken(token) { return token === 'token-a' ? { id: 'auth-a' } : null; },
  async findActiveMembership(authUserId) {
    return authUserId === 'auth-a'
      ? { tenant_id: tenantA, user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', scopes: [], role: 'admin' }
      : null;
  },
};

test('profile, client, site, lead, quote, and invoice direct reads hide foreign and absent IDs and pass server-derived tenancy downstream', async () => {
  const reads: Array<{ service: string; uri: string; context: any }> = [];
  const app = Fastify();
  const reject = (service: string) => async (uri: string, context: any) => {
    reads.push({ service, uri, context });
    throw new Error(`database resource failure for ${uri}; tenant_id=${context.tenant_id}`);
  };
  app.decorate('mcp', {
    identity: { readResource: reject('identity') },
    clients: { readResource: reject('clients') },
    quoting: { readResource: reject('quoting') },
    invoicing: { readResource: reject('invoicing') },
  } as any);
  registerServerAuth(app, dependencies);
  await identityRoutes(app);
  await clientsRoutes(app);
  await quotingRoutes(app);
  await invoicingRoutes(app);
  await app.ready();

  const headers = { authorization: 'Bearer token-a' };
  const cases = [
    { name: 'profile', path: '/api/identity/tenants/:id', expected: { error: 'Profile not found' } },
    { name: 'client', path: '/api/clients/clients/:id', expected: { error: 'Client not found' } },
    { name: 'site', path: '/api/clients/sites/:id', expected: { error: 'Site not found' } },
    { name: 'lead', path: '/api/leads/:id', expected: { error: 'Lead not found' } },
    { name: 'quote', path: '/api/quotes/:id', expected: { error: 'Quote not found' } },
    { name: 'invoice', path: '/api/invoices/:id', expected: { error: 'Invoice not found' } },
  ] as const;

  for (const directRead of cases) {
    const foreign = await app.inject({ method: 'GET', url: directRead.path.replace(':id', foreignId), headers });
    const absent = await app.inject({ method: 'GET', url: directRead.path.replace(':id', missingId), headers });
    assert.equal(foreign.statusCode, 404, `${directRead.name} foreign status`);
    assert.equal(absent.statusCode, 404, `${directRead.name} absent status`);
    assert.deepEqual(foreign.json(), directRead.expected, `${directRead.name} foreign body`);
    assert.deepEqual(absent.json(), directRead.expected, `${directRead.name} absent body`);
    assert.equal(foreign.body, absent.body, `${directRead.name} foreign and absent bodies differ`);
    for (const response of [foreign, absent]) {
      assert.equal(response.body.includes(foreignId), false, `${directRead.name} echoed foreign ID`);
      assert.equal(response.body.includes(missingId), false, `${directRead.name} echoed absent ID`);
      assert.equal(response.body.includes('database resource failure'), false, `${directRead.name} exposed downstream failure`);
      assert.equal(response.body.includes('tenant_id'), false, `${directRead.name} exposed tenant fields`);
    }
  }

  assert.equal(reads.length, 12);
  for (const read of reads) {
    assert.equal(read.context.tenant_id, tenantA, `${read.service} did not receive the server-derived tenant`);
    assert.equal(read.context.user_id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  }
  await app.close();
});
