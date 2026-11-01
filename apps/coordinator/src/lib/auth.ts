import { FastifyInstance, FastifyRequest } from 'fastify';
import { AuthContext } from '@jobbuilda/contracts';
import { getPool } from './db.js';

export class RequestAuthenticationError extends Error {
  constructor(
    public readonly statusCode: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = 'RequestAuthenticationError';
  }
}

interface VerifiedSupabaseUser {
  id: string;
}

interface MembershipRow {
  tenant_id: string;
  user_id: string;
  scopes: string[] | null;
}

export interface ServerAuthDependencies {
  verifyAccessToken(accessToken: string): Promise<VerifiedSupabaseUser | null>;
  findActiveMembership(authUserId: string): Promise<MembershipRow | null>;
}

declare module 'fastify' {
  interface FastifyRequest {
    authContext: AuthContext | null;
  }
}

const unauthenticatedPaths = new Set([
  '/health',
  '/api/auth/register',
  '/api/subscription/webhook',
  '/api/payments/quote-deposit/webhook',
]);

const callerSelectedIdentityHeaders = ['x-tenant-id', 'x-user-id', 'x-scopes'];

function authorizationToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

function hasCallerSelectedIdentity(request: FastifyRequest): boolean {
  return callerSelectedIdentityHeaders.some((header) => request.headers[header] !== undefined);
}

export function configuredDependencies(): ServerAuthDependencies {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for server authentication');
  }

  return {
    async verifyAccessToken(accessToken) {
      const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
        headers: {
          // This server-only project key selects the Supabase project. The
          // caller's token remains the Authorization bearer credential being
          // verified; do not replace it with the service-role key.
          apikey: supabaseServiceRoleKey,
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!response.ok) return null;
      const user = await response.json() as Partial<VerifiedSupabaseUser>;
      return typeof user.id === 'string' ? { id: user.id } : null;
    },
    async findActiveMembership(authUserId) {
      const result = await getPool().query<MembershipRow>(
        `SELECT m.tenant_id, m.user_id, COALESCE(array_agg(DISTINCT p.scope) FILTER (WHERE p.scope IS NOT NULL), '{}') AS scopes
           FROM public.auth_tenant_memberships m
           JOIN public.users u ON u.id = m.user_id AND u.tenant_id = m.tenant_id
           LEFT JOIN public.permissions p ON p.user_id = m.user_id
          WHERE m.auth_user_id = $1
            AND m.status = 'active'
            AND m.revoked_at IS NULL
          GROUP BY m.tenant_id, m.user_id`,
        [authUserId],
      );
      // The migration permits history but only one active identity mapping. Fail
      // closed if corruption or an incomplete backfill returns anything else.
      return result.rows.length === 1 ? result.rows[0] : null;
    },
  };
}

export async function resolveServerAuthContext(
  request: FastifyRequest,
  dependencies?: ServerAuthDependencies,
): Promise<AuthContext> {
  if (hasCallerSelectedIdentity(request)) {
    throw new RequestAuthenticationError(401, 'Caller-selected tenant, user, and scope headers are not accepted');
  }

  const token = authorizationToken(request);
  if (!token) throw new RequestAuthenticationError(401, 'A Supabase access token is required');

  // Resolve configuration only for a request that actually needs authentication.
  // This lets containment and its unauthenticated health/webhook paths start
  // safely when a legacy deployment has no browser-facing anon key.
  const authDependencies = dependencies ?? configuredDependencies();
  const verifiedUser = await authDependencies.verifyAccessToken(token);
  if (!verifiedUser) throw new RequestAuthenticationError(401, 'Invalid or expired Supabase access token');

  const membership = await authDependencies.findActiveMembership(verifiedUser.id);
  if (!membership) throw new RequestAuthenticationError(403, 'No active tenant membership is available for this account');

  return {
    tenant_id: membership.tenant_id,
    user_id: membership.user_id,
    scopes: membership.scopes ?? [],
    x_request_id: request.id,
  };
}

/**
 * Establishes a request-scoped context from a Supabase-verified identity and a
 * server-owned active membership. It deliberately never reads tenant/user/scope
 * headers or auth metadata. The global incident containment still runs first,
 * so registering this hook does not unpause any account-data route.
 */
export function registerServerAuth(
  fastify: FastifyInstance,
  dependencies?: ServerAuthDependencies,
): void {
  fastify.decorateRequest('authContext', null);
  fastify.addHook('preHandler', async (request, reply) => {
    const path = request.url.split('?')[0];
    if (unauthenticatedPaths.has(path)) return;
    try {
      request.authContext = await resolveServerAuthContext(request, dependencies);
    } catch (error) {
      if (error instanceof RequestAuthenticationError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      request.log.error(error, 'Server authentication unavailable');
      return reply.status(503).send({ error: 'Authentication is temporarily unavailable' });
    }
  });
}

export function extractAuthContext(request: FastifyRequest): AuthContext {
  if (!request.authContext) {
    throw new Error('Server authentication context was not established');
  }
  return request.authContext;
}
