import { FastifyInstance } from 'fastify';

export const ACCOUNT_ACCESS_PAUSED_RESPONSE = {
  error: 'Account access temporarily unavailable',
  code: 'ACCOUNT_ACCESS_PAUSED',
  message: 'Account data access is temporarily unavailable while we complete maintenance.',
};

const allowedPaths = new Set([
  '/health',
  '/api/auth/register',
  '/api/subscription/webhook',
  '/api/payments/quote-deposit/webhook',
]);

/**
 * Emergency containment for the header-based tenancy incident.
 *
 * Do not restore tenant routes until they derive both identity and tenant
 * membership from a server-verified authentication mechanism.
 */
export function registerAccountIsolationContainment(fastify: FastifyInstance): void {
  fastify.addHook('onRequest', async (request, reply) => {
    const path = request.url.split('?')[0];
    if (allowedPaths.has(path)) return;

    return reply.status(503).send(ACCOUNT_ACCESS_PAUSED_RESPONSE);
  });
}
