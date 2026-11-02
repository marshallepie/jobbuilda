import { FastifyInstance } from 'fastify';
import { isVerificationAccessCandidate } from './verification-owner-access.js';

export const ACCOUNT_ACCESS_PAUSED_RESPONSE = {
  error: 'Account access temporarily unavailable',
  code: 'ACCOUNT_ACCESS_PAUSED',
  message: 'Account data access is temporarily unavailable while we complete maintenance.',
};

/** Handles router-level malformed URLs, which occur before Fastify hooks. */
export function sendContainmentBadUrlResponse(response: {
  statusCode: number;
  setHeader(name: string, value: string): unknown;
  end(payload: string): unknown;
}): void {
  response.statusCode = 503;
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify(ACCOUNT_ACCESS_PAUSED_RESPONSE));
}

const allowedPaths = new Set([
  '/health',
  '/api/auth/register',
  '/api/subscription/webhook',
  '/api/payments/quote-deposit/webhook',
]);

const REHEARSAL_SUPABASE_REF = 'jwnfweldmfdeapfzfunq';
const PRODUCTION_SUPABASE_REF = 'jnwxueomquywrqcgbgfd';

function normaliseSupabaseUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash) return null;
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

/**
 * This bypass exists only for the synthetic two-tenant acceptance rehearsal.
 * It must never turn a malformed local configuration into a route re-open.
 */
export function shouldBypassContainmentForRehearsal(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  if (environment.JOBBUILDA_REHEARSAL_MODE !== 'true') return false;

  const configuredRef = environment.JOBBUILDA_REHEARSAL_SUPABASE_REF;
  if (configuredRef === PRODUCTION_SUPABASE_REF) {
    throw new Error('The production Supabase ref is never valid for a rehearsal startup');
  }

  const expectedUrl = `https://${REHEARSAL_SUPABASE_REF}.supabase.co`;
  const checks = [
    environment.NODE_ENV === 'test',
    configuredRef === REHEARSAL_SUPABASE_REF,
    normaliseSupabaseUrl(environment.SUPABASE_URL) === expectedUrl,
  ];
  if (!checks.every(Boolean)) {
    throw new Error('Rehearsal mode requires NODE_ENV=test, the approved branch ref, and its exact SUPABASE_URL');
  }

  return true;
}

/**
 * Emergency containment for the header-based tenancy incident.
 *
 * Do not restore tenant routes until they derive both identity and tenant
 * membership from a server-verified authentication mechanism.
 */
export function registerAccountIsolationContainment(fastify: FastifyInstance): void {
  if (shouldBypassContainmentForRehearsal()) return;

  fastify.addHook('onRequest', async (request, reply) => {
    const path = request.url.split('?')[0];
    if (allowedPaths.has(path) || isVerificationAccessCandidate(request.method, path)) return;

    return reply.status(503).send(ACCOUNT_ACCESS_PAUSED_RESPONSE);
  });
}
