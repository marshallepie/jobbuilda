import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  BROWSER_REHEARSAL_PROFILE_ENV,
  browserRehearsalServices,
  preflightBrowserRehearsal,
  rejectBrowserRehearsalProfileFromNormalStart,
  REHEARSAL_SUPABASE_REF,
} from '../src/lib/browser-rehearsal-profile.js';

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');

function environment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    [BROWSER_REHEARSAL_PROFILE_ENV]: 'true',
    JOBBUILDA_REHEARSAL_SUPABASE_REF: REHEARSAL_SUPABASE_REF,
    SUPABASE_URL: `https://${REHEARSAL_SUPABASE_REF}.supabase.co`,
    SUPABASE_SERVICE_ROLE_KEY: 'protected-test-placeholder',
    DATABASE_URL: `postgresql://protected-test-placeholder@db.${REHEARSAL_SUPABASE_REF}.supabase.co:5432/postgres`,
    ...overrides,
  };
}

test('browser rehearsal preflight accepts no legacy portal JWT secret and selects only the reviewed MCP children and local coordinator binding', () => {
  const configuration = preflightBrowserRehearsal(environment({ PORT: '3000' }), repositoryRoot);
  assert.equal(configuration.host, '127.0.0.1');
  assert.equal(configuration.port, 3000);
  assert.deepEqual(configuration.services, browserRehearsalServices);
});

test('browser rehearsal preflight accepts only the approved session-pooler target', () => {
  assert.doesNotThrow(() => preflightBrowserRehearsal(environment({
    DATABASE_URL: `postgresql://postgres.${REHEARSAL_SUPABASE_REF}:protected-test-placeholder@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`,
  }), repositoryRoot));
});

test('browser rehearsal preflight rejects production, malformed, bypass, remote NATS, telemetry, and provider configuration', () => {
  const rejected = [
    environment({ JOBBUILDA_REHEARSAL_SUPABASE_REF: 'jnwxueomquywrqcgbgfd' }),
    environment({ SUPABASE_URL: 'https://jnwxueomquywrqcgbgfd.supabase.co' }),
    environment({ SUPABASE_URL: 'https://jwnfweldmfdeapfzfunq.supabase.co/' }),
    environment({ DATABASE_URL: 'not-a-database-url' }),
    environment({ DATABASE_URL: 'postgresql://protected-test-placeholder@db.jnwxueomquywrqcgbgfd.supabase.co:5432/postgres' }),
    environment({ DATABASE_URL: 'postgresql://protected-test-placeholder@foreign.example.test:5432/postgres' }),
    environment({ DATABASE_URL: `postgresql://protected-test-placeholder@db.${REHEARSAL_SUPABASE_REF}.supabase.co:5432/foreign` }),
    environment({ DATABASE_URL: `postgresql://postgres.${REHEARSAL_SUPABASE_REF}:protected-test-placeholder@aws-0-eu-west-1.pooler.supabase.com/postgres` }),
    environment({ DATABASE_URL: 'postgresql://postgres.foreignproject:protected-test-placeholder@aws-0-eu-west-1.pooler.supabase.com:5432/postgres' }),
    environment({ DATABASE_URL: `postgresql://postgres.${REHEARSAL_SUPABASE_REF}:protected-test-placeholder@aws-0-eu-west-1.pooler.supabase.com:6543/postgres` }),
    environment({ DATABASE_URL: `postgresql://postgres.${REHEARSAL_SUPABASE_REF}:protected-test-placeholder@aws-0-us-east-1.pooler.supabase.com:5432/postgres` }),
    environment({ DATABASE_URL: `postgresql://postgres.${REHEARSAL_SUPABASE_REF}:protected-test-placeholder@aws-0-eu-west-1.pooler.supabase.com:5432/foreign` }),
    environment({ DATABASE_URL: `postgresql://postgres.${REHEARSAL_SUPABASE_REF}:protected-test-placeholder@127.0.0.1:5432/postgres` }),
    environment({ JOBBUILDA_REHEARSAL_MODE: 'true' }),
    environment({ NATS_URL: 'nats://remote.example.test:4222' }),
    environment({ STRIPE_SECRET_KEY: 'not-used' }),
    environment({ HOST: '0.0.0.0' }),
    environment({ OTEL_EXPORTER_OTLP_ENDPOINT: 'https://telemetry.example.test/v1/traces' }),
    environment({ OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'https://telemetry.example.test/v1/traces' }),
  ];
  for (const candidate of rejected) {
    assert.throws(() => preflightBrowserRehearsal(candidate, repositoryRoot));
  }
});

test('browser rehearsal permits only loopback telemetry and normal coordinator start rejects the profile marker', () => {
  assert.doesNotThrow(() => preflightBrowserRehearsal(environment({
    OTEL_EXPORTER_OTLP_ENDPOINT: 'http://127.0.0.1:4318/v1/traces',
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'http://localhost:4318/v1/traces',
  }), repositoryRoot));
  assert.throws(() => rejectBrowserRehearsalProfileFromNormalStart(environment()));
  assert.doesNotThrow(() => rejectBrowserRehearsalProfileFromNormalStart({}));
});

test('browser rehearsal preflight fails closed when artifacts or protected authentication configuration are absent', () => {
  assert.throws(() => preflightBrowserRehearsal(environment({ SUPABASE_SERVICE_ROLE_KEY: '' }), repositoryRoot));
  assert.throws(() => preflightBrowserRehearsal(environment(), path.join(repositoryRoot, 'does-not-exist')));
});
