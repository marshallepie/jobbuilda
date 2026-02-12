import { FastifyRequest } from 'fastify';
import { AuthContext } from '@jobbuilda/contracts';
import { randomUUID } from 'crypto';

/**
 * Extract AuthContext from request headers (development mode)
 * In production, this would validate JWT tokens from Supabase Auth
 */
export function extractAuthContext(request: FastifyRequest): AuthContext {
  const tenantId = request.headers['x-tenant-id'] as string;
  const userId = request.headers['x-user-id'] as string;
  const scopes = (request.headers['x-scopes'] as string)?.split(',') || [];
  const requestId = (request.headers['x-request-id'] as string) || randomUUID();

  if (!tenantId || !userId) {
    throw new Error('Missing required auth headers: x-tenant-id, x-user-id');
  }

  return {
    tenant_id: tenantId,
    user_id: userId,
    scopes,
    x_request_id: requestId
  };
}
