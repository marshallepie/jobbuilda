import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createConnection } from 'node:net';
import test from 'node:test';
import { isExpectedTeardownSocketError, startNatsCapture } from '../src/lib/nats-capture.js';

test('only reset or aborted socket errors after capture teardown are ignored', () => {
  assert.equal(isExpectedTeardownSocketError(Object.assign(new Error('reset'), { code: 'ECONNRESET' }), true), true);
  assert.equal(isExpectedTeardownSocketError(Object.assign(new Error('aborted'), { code: 'ECONNABORTED' }), true), true);
  assert.equal(isExpectedTeardownSocketError(Object.assign(new Error('reset'), { code: 'ECONNRESET' }), false), false);
  assert.equal(isExpectedTeardownSocketError(Object.assign(new Error('other'), { code: 'EPIPE' }), true), false);
});

test('local capture rejects malformed protocol instead of treating it as a teardown reset', async () => {
  const capture = await startNatsCapture();
  const url = new URL(capture.url);
  const socket = createConnection({ host: url.hostname, port: Number(url.port) });
  await once(socket, 'connect');
  socket.write('PUB events.clients.bad nope\r\n');
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.throws(() => capture.assertHealthy(), /invalid publish payload length/);
  socket.destroy();
  await assert.rejects(capture.close(), /invalid publish payload length/);
});
