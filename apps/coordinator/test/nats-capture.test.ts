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

test('local capture records only publish metadata and has no consumers', async () => {
  const capture = await startNatsCapture();
  const url = new URL(capture.url);
  const socket = createConnection({ host: url.hostname, port: Number(url.port) });
  await once(socket, 'connect');
  await once(socket, 'data'); // INFO
  socket.write('CONNECT {"verbose":false}\r\nPUB events.clients.created 24\r\nprotected-payload-data!!\r\n');
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.deepEqual(capture.captures(), [{ subject: 'events.clients.created', count: 1 }]);
  socket.end();
  await once(socket, 'close');
  await capture.close();
});

test('local capture rejects subscriptions so it cannot become a consumer', async () => {
  const capture = await startNatsCapture();
  const url = new URL(capture.url);
  const socket = createConnection({ host: url.hostname, port: Number(url.port) });
  await once(socket, 'connect');
  socket.write('SUB events.> 1\r\n');
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.throws(() => capture.assertHealthy(), /unsupported command SUB/);
  socket.destroy();
  await assert.rejects(capture.close(), /unsupported command SUB/);
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
