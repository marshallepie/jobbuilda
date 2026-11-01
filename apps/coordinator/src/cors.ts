import type { FastifyCorsOptions } from '@fastify/cors';

export const LEGACY_BROWSER_ALLOWED_HEADERS = [
  'Authorization',
  'x-tenant-id',
  'x-user-id',
  'Content-Type',
  'X-CSRF-Token',
];

export function coordinatorCorsOptions(env: NodeJS.ProcessEnv = process.env): FastifyCorsOptions {
  const allowedOrigins = new Set([
    env.ADMIN_URL || 'http://localhost:3002',
    env.PORTAL_URL || 'http://localhost:3001',
    env.APP_URL || 'https://jobbuilda.co.uk',
  ]);

  return {
    // Browser credentials are accepted only from explicitly configured dashboard origins.
    // Non-browser requests retain the existing no-Origin behavior.
    origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
    credentials: true,
    allowedHeaders: LEGACY_BROWSER_ALLOWED_HEADERS,
  };
}
