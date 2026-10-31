import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import Fastify from 'fastify';
import { clientPortalRoutes } from '../src/routes/client-portal.js';

const invoiceId = '11111111-1111-4111-8111-111111111111';
const paidInvoiceId = '22222222-2222-4222-8222-222222222222';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

test('returning portal sessions bootstrap CSRF and authorize checkout', async () => {
  let csrfHash = 'stale-csrf-hash';
  let paymentCalls = 0;
  const queries: Array<{ text: string; values?: unknown[] }> = [];
  const db = {
    query: async (text: string, values?: unknown[]) => {
      queries.push({ text, values });
      if (text.startsWith('SELECT s.id')) {
        return { rows: [{ id: 'session-id', principal_id: 'principal-id', selected_membership_id: 'membership-id', csrf_hash: csrfHash, tenant_id: 'tenant-id', client_id: 'client-id' }] };
      }
      if (text.startsWith('UPDATE portal_sessions s SET csrf_hash')) {
        csrfHash = String(values?.[0]);
        return { rows: [{ id: 'session-id' }] };
      }
      if (text.startsWith('SELECT i.id')) {
        const id = String(values?.[0]);
        return { rows: [{ id, invoice_number: 'INV-1', status: id === paidInvoiceId ? 'paid' : 'overdue', amount_due: id === paidInvoiceId ? '0' : '12.50' }] };
      }
      throw new Error(`Unexpected query: ${text}`);
    },
  };
  const app = Fastify();
  (app as any).mcp = {
    payments: {
      callTool: async (_name: string, _input: unknown, context: any) => {
        paymentCalls += 1;
        assert.equal(context.tenant_id, 'tenant-id');
        assert.equal(context.user_id, 'portal:principal-id');
        return { content: [{ text: JSON.stringify({ checkout_url: 'https://checkout.example.test/session' }) }] };
      },
    },
  };
  await clientPortalRoutes(app, db);
  await app.ready();

  const session = await app.inject({ method: 'GET', url: '/api/client-portal/session', headers: { cookie: 'jobbuilda_portal=returning-session' } });
  assert.equal(session.statusCode, 200);
  assert.equal(session.headers['set-cookie'], undefined);
  const { csrfToken } = session.json();
  assert.equal(typeof csrfToken, 'string');
  assert.notEqual(csrfToken, '');
  assert.equal(csrfHash, hash(csrfToken));
  assert.ok(queries.some(({ text }) => text.includes('m.revoked_at IS NULL AND p.revoked_at IS NULL')));

  const unauthenticated = await app.inject({ method: 'POST', url: `/api/client-portal/invoices/${invoiceId}/checkout` });
  assert.equal(unauthenticated.statusCode, 403);
  assert.equal(paymentCalls, 0);

  const checkout = await app.inject({ method: 'POST', url: `/api/client-portal/invoices/${invoiceId}/checkout`, headers: { cookie: 'jobbuilda_portal=returning-session', 'x-csrf-token': csrfToken } });
  assert.equal(checkout.statusCode, 200);
  assert.deepEqual(checkout.json(), { checkout_url: 'https://checkout.example.test/session' });
  assert.equal(paymentCalls, 1);

  const paid = await app.inject({ method: 'POST', url: `/api/client-portal/invoices/${paidInvoiceId}/checkout`, headers: { cookie: 'jobbuilda_portal=returning-session', 'x-csrf-token': csrfToken } });
  assert.equal(paid.statusCode, 400);
  assert.equal(paymentCalls, 1);
  await app.close();
});
