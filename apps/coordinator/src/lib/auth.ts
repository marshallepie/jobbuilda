import { FastifyRequest } from 'fastify';
import { AuthContext } from '@jobbuilda/contracts';

/**
 * Emergency fail-closed guard for the account-isolation incident.
 *
 * This coordinator previously accepted tenant identity and scopes from caller
 * headers. Do not restore this helper until a server-verified identity and
 * durable tenant membership lookup replace those headers.
 */
export function extractAuthContext(_request: FastifyRequest): AuthContext {
  throw new Error('Account data access is temporarily unavailable');
}
