import assert from 'node:assert/strict';
import test from 'node:test';
import { runWithPreservedFailure } from '../src/lib/rehearsal-runner.js';

test('rehearsal assertion failure remains the process-visible failure after teardown', async () => {
  let teardownCalls = 0;
  const original = new Error('intentional assertion failure');

  await assert.rejects(
    runWithPreservedFailure(
      async () => { throw original; },
      async () => { teardownCalls += 1; },
    ),
    (error: unknown) => error === original,
  );
  assert.equal(teardownCalls, 1);
});

test('teardown failure cannot mask the original rehearsal assertion failure', async () => {
  const original = new Error('intentional assertion failure');

  await assert.rejects(
    runWithPreservedFailure(
      async () => { throw original; },
      async () => { throw new Error('intentional teardown failure'); },
    ),
    (error: unknown) => error === original,
  );
});
