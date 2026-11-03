import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  BROWSER_REHEARSAL_PROFILE_ENV,
  browserRehearsalServices,
  preflightBrowserRehearsal,
  REHEARSAL_SUPABASE_REF,
} from '../src/lib/browser-rehearsal-profile.js';

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');

function environment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    [BROWSER_REHEARSAL_PROFILE_ENV]: 'true',
    JOBBUILDA_REHEARSAL_SUPABASE_REF: REHEARSAL_SUPABASE_REF,
    SUPABASE_URL: `https://${REHEARSAL_SUPABASE_REF}.supabase.co`,
    SUPABASE_SERVICE_ROLE_KEY: 'protected-test-placeholder',
    DATABASE_URL: 'postgresql://protected-test-placeholder',
    JWT_SECRET: 'protected-test-placeholder',
    ...overrides,
  };
}

test('browser rehearsal preflight selects only the four reviewed MCP children and local coordinator binding', () => {
  const configuration = preflightBrowserRehearsal(environment({ PORT: '3000' }));
  assert.equal(configuration.host, '127.0.0.1');
  assert.equal(configuration.port, 3000);
  assert.deepEqual(configuration.services, browserRehearsalServices);
});

test('browser rehearsal preflight rejects production, malformed, bypass, remote NATS, and provider configuration', () => {
  const rejected = [
    environment({ JOBBUILDA_REHEARSAL_SUPABASE_REF: 'jnwxueomquywrqcgbgfd' }),
    environment({ SUPABASE_URL: 'https://jnwxueomquywrqcgbgfd.supabase.co' }),
    environment({ SUPABASE_URL: 'https://jwnfweldmfdeapfzfunq.supabase.co/' }),
    environment({ JOBBUILDA_REHEARSAL_MODE: 'true' }),
    environment({ NATS_URL: 'nats://remote.example.test:4222' }),
    environment({ STRIPE_SECRET_KEY: 'not-used' }),
    environment({ HOST: '0.0.0.0' }),
  ];
  for (const candidate of rejected) {
    assert.throws(() => preflightBrowserRehearsal(candidate, repositoryRoot));
  }
});

test('browser rehearsal preflight fails closed when artifacts or protected authentication configuration are absent', () => {
  assert.throws(() => preflightBrowserRehearsal(environment({ SUPABASE_SERVICE_ROLE_KEY: '' }), repositoryRoot));
  assert.throws(() => preflightBrowserRehearsal(environment(), path.join(repositoryRoot, 'does-not-exist')));
});
