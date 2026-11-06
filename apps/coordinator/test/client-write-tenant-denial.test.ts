import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import { clientsRoutes } from '../src/routes/clients.js';
import { registerServerAuth, ServerAuthDependencies } from '../src/lib/auth.js';

const tenantA = '11111111-1111-4111-8111-111111111111';
const foreignClient = '22222222-2222-4222-8222-222222222222';

const dependencies: ServerAuthDependencies = {
  async verifyAccessToken(token) { return token === 'token-a' ? { id: 'auth-a' } : null; },
  async findActiveMembership(authUserId) {
    return authUserId === 'auth-a'
      ? { tenant_id: tenantA, user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', scopes: [], role: 'admin' }
      : null;
  },
};

test('foreign client write failures are sanitized to not-found with only server-derived tenant context', async () => {
  const calls: Array<{ tool: string; args: any; context: any }> = [];
  const app = Fastify();
  app.decorate('mcp', {
    clients: {
      async callTool(tool: string, args: any, context: any) {
        calls.push({ tool, args, context });
        throw new Error('Client not found or access denied');
      },
    },
  } as any);
  registerServerAuth(app, dependencies);
  await clientsRoutes(app);
  await app.ready();

  for (const request of [
    { method: 'POST' as const, url: '/api/clients/sites', payload: { client_id: foreignClient, name: 'Denied site', address_line1: '1 Test Way', city: 'Testville', postcode: 'TE5 7AA' } },
    { method: 'PATCH' as const, url: `/api/clients/clients/${foreignClient}`, payload: { notes: 'must not persist' } },
    { method: 'DELETE' as const, url: `/api/clients/gdpr/${foreignClient}?confirm=true` },
  ]) {
    const response = await app.inject({ ...request, headers: { authorization: 'Bearer token-a' } });
    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.json(), { error: 'Client not found' });
  }
  assert.deepEqual(calls.map(({ tool }) => tool), ['create_site', 'update_client', 'gdpr_delete']);
  for (const call of calls) {
    assert.equal(call.context.tenant_id, tenantA);
    assert.equal(call.context.user_id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  }
  await app.close();
});
