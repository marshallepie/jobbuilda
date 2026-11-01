import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import { MAINTENANCE_MESSAGE, subscriptionRoutes } from '../src/routes/subscription.js';

test('registration fails closed during maintenance before any account setup', async () => {
  const app = Fastify();
  await subscriptionRoutes(app);
  await app.ready();

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'new-user@example.test', password: 'not-used', company_name: 'Test Trade' },
  });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), { error: MAINTENANCE_MESSAGE });
  await app.close();
});
