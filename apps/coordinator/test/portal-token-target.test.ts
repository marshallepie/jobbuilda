import assert from 'node:assert/strict';
import test from 'node:test';
import { assertPortalTokenTarget } from '../src/lib/portal-token-target.js';

const context = { tenant_id: '11111111-1111-4111-8111-111111111111', user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', scopes: [], x_request_id: 'test' };
const input = { client_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', user_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', purpose: 'quote_view' as const, resource_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' };

test('portal target binding permits exactly one owner-tenant client/document relationship', async () => {
  const calls: unknown[][] = [];
  await assertPortalTokenTarget({
    async query(_sql, values) { calls.push(values); return { rows: [{ ok: true }] }; },
  }, input, context);
  assert.deepEqual(calls, [[input.client_id, context.tenant_id, input.resource_id]]);
});

test('portal target binding rejects cross-tenant and arbitrary targets before issuance', async () => {
  const db = { async query() { return { rows: [] as Record<string, unknown>[] }; } };
  await assert.rejects(() => assertPortalTokenTarget(db, input, context), /Portal target is unavailable/);
});
