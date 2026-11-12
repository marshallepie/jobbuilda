import { FastifyInstance } from 'fastify';

export const ACCOUNT_ACCESS_PAUSED_RESPONSE = {
  error: 'Account access temporarily unavailable',
  code: 'ACCOUNT_ACCESS_PAUSED',
  message: 'Account data access is temporarily unavailable while we complete maintenance.',
};

/**
 * Legacy containment is intentionally narrow after server authentication is
 * installed: staff routes are gated by registerServerAuth, registration stays
 * paused in subscriptionRoutes, and webhooks/client portal/share redirects use
 * their own server-side mechanisms. Keeping this hook no-op prevents a future
 * broad 503 gate from silently bypassing the verified auth boundary.
 */
export function registerAccountIsolationContainment(_fastify: FastifyInstance): void {}
