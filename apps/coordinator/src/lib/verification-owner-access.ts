import { FastifyInstance, FastifyRequest } from 'fastify';

export const VERIFICATION_OWNER_AUTH_USER_ID_ENV = 'JOBBUILDA_VERIFICATION_OWNER_AUTH_USER_ID';
export const VERIFICATION_ACCESS_EXPIRES_AT_ENV = 'JOBBUILDA_VERIFICATION_ACCESS_EXPIRES_AT';

export const verificationAccessAllowlist = [
  { method: 'GET', path: '/api/identity/profile' },
  { method: 'GET', path: '/api/clients/clients' },
  { method: 'GET', path: '/api/clients/clients/:clientId' },
  { method: 'POST', path: '/api/clients/clients' },
  { method: 'PATCH', path: '/api/clients/clients/:clientId' },
  { method: 'DELETE', path: '/api/clients/clients/:clientId' },
  { method: 'GET', path: '/api/quotes' },
  { method: 'GET', path: '/api/quotes/:id' },
  { method: 'GET', path: '/api/invoices' },
  { method: 'GET', path: '/api/invoices/:id' },
] as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Verification access may only reach direct-resource handlers with a literal,
 * canonical UUID path segment. Decode once before validating so encoded path
 * separators or URI delimiters cannot be interpolated into a downstream URI.
 */
function isVerifiedResourceId(value: string): boolean {
  if (!value || value.includes('/') || value.includes('\\')) return false;

  try {
    const decoded = decodeURIComponent(value);
    return decoded === value && UUID_PATTERN.test(decoded);
  } catch {
    return false;
  }
}

/** Matches only the production-verification methods and route shapes. */
export function isVerificationAccessCandidate(method: string, path: string): boolean {
  if (method === 'GET' && (
    path === '/api/identity/profile'
    || path === '/api/clients/clients'
    || path === '/api/quotes'
    || path === '/api/invoices'
  )) return true;

  const clientPrefix = '/api/clients/clients/';
  if ((method === 'GET' || method === 'PATCH' || method === 'DELETE') && path.startsWith(clientPrefix)) {
    return isVerifiedResourceId(path.slice(clientPrefix.length));
  }

  if (method === 'POST' && path === '/api/clients/clients') return true;

  const quotePrefix = '/api/quotes/';
  if (method === 'GET' && path.startsWith(quotePrefix)) {
    return isVerifiedResourceId(path.slice(quotePrefix.length));
  }

  const invoicePrefix = '/api/invoices/';
  if (method === 'GET' && path.startsWith(invoicePrefix)) {
    return isVerifiedResourceId(path.slice(invoicePrefix.length));
  }

  return false;
}

interface VerificationAccessConfiguration {
  authUserId: string;
  expiresAt: number;
}

export interface VerificationOwnerAccessDependencies {
  environment?: NodeJS.ProcessEnv;
  now?: () => number;
}

function readConfiguration(
  environment: NodeJS.ProcessEnv,
): VerificationAccessConfiguration | null {
  const authUserId = environment[VERIFICATION_OWNER_AUTH_USER_ID_ENV];
  const expiresAtValue = environment[VERIFICATION_ACCESS_EXPIRES_AT_ENV];
  if (!authUserId || !UUID_PATTERN.test(authUserId) || !expiresAtValue) return null;

  const expiresAt = Date.parse(expiresAtValue);
  if (!Number.isFinite(expiresAt) || new Date(expiresAt).toISOString() !== expiresAtValue) return null;

  return { authUserId, expiresAt };
}

/**
 * Applies the second gate after normal server authentication. Candidate routes
 * remain contained unless one configured Supabase identity is a verified active
 * tenant owner and the server-side expiry has not passed.
 */
export function registerVerificationOwnerAccess(
  fastify: FastifyInstance,
  dependencies: VerificationOwnerAccessDependencies = {},
): void {
  const environment = dependencies.environment ?? process.env;
  const now = dependencies.now ?? Date.now;

  fastify.addHook('preHandler', async (request: FastifyRequest, reply) => {
    const path = request.url.split('?')[0];
    if (!isVerificationAccessCandidate(request.method, path)) return;

    const configuration = readConfiguration(environment);
    if (!configuration) {
      return reply.status(503).send({ error: 'Verification access is not configured' });
    }
    if (now() >= configuration.expiresAt) {
      return reply.status(403).send({ error: 'Verification access has expired' });
    }
    if (request.verifiedAuthUserId !== configuration.authUserId) {
      return reply.status(403).send({ error: 'Verification access is not permitted for this account' });
    }
  });
}
