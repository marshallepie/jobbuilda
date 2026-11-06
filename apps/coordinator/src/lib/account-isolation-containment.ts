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

/**
 * Emergency containment for the header-based tenancy incident.
 *
 * Do not restore tenant routes until they derive both identity and tenant
 * membership from a server-verified authentication mechanism.
 */
export function registerAccountIsolationContainment(fastify: FastifyInstance): void {
  fastify.addHook('onRequest', async (request, reply) => {
    const path = request.url.split('?')[0];
    if (allowedPaths.has(path) || isVerificationAccessCandidate(request.method, request.url)) return;

    return reply.status(503).send(ACCOUNT_ACCESS_PAUSED_RESPONSE);
  });
}
