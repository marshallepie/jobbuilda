import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMcpChildEnvironment } from '../src/client';

test('browser rehearsal MCP children receive only their explicit allowlist and PATH', () => {
  const childEnvironment = buildMcpChildEnvironment({
    command: 'node',
    args: ['dist/index.js'],
    browserRehearsal: true,
    env: {
      DATABASE_URL: 'postgresql://rehearsal.example.test/postgres',
      NATS_URL: 'nats://127.0.0.1:4222',
      JWT_SECRET: 'rehearsal-jwt',
      NODE_ENV: 'test',
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://127.0.0.1:4318/v1/traces',
      OTEL_SERVICE_NAME: 'identity-mcp',
    },
  }, {
    PATH: '/usr/local/bin:/usr/bin',
    SENTRY_DSN: 'https://public@example.ingest.sentry.io/1',
    AN_UNLISTED_PROVIDER_TOKEN: 'must-not-reach-child',
    OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: 'https://telemetry.example.test/v1/logs',
    OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: 'https://telemetry.example.test/v1/metrics',
  });

  assert.deepEqual(childEnvironment, {
    PATH: '/usr/local/bin:/usr/bin',
    DATABASE_URL: 'postgresql://rehearsal.example.test/postgres',
    NATS_URL: 'nats://127.0.0.1:4222',
    JWT_SECRET: 'rehearsal-jwt',
    NODE_ENV: 'test',
    OTEL_EXPORTER_OTLP_ENDPOINT: 'http://127.0.0.1:4318/v1/traces',
    OTEL_SERVICE_NAME: 'identity-mcp',
  });
});