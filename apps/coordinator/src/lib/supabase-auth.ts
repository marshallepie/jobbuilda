/**
 * Supabase JWT Token Validation Middleware
 * Validates JWT tokens from Supabase Auth and extracts tenant_id
 */

import { FastifyRequest } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { AuthContext } from '@jobbuilda/contracts';
import { randomUUID } from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || '';

/**
 * Extract and validate AuthContext from Supabase JWT token
 * Use this in production instead of extractAuthContext
 */
export async function validateSupabaseToken(request: FastifyRequest): Promise<AuthContext> {
  const authHeader = request.headers.authorization as string;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }

  const token = authHeader.replace('Bearer ', '');

  // In development mode, allow mock tokens
  if (process.env.NODE_ENV === 'development' && token === 'mock-jwt-token') {
    return {
      tenant_id: request.headers['x-tenant-id'] as string,
      user_id: request.headers['x-user-id'] as string,
      scopes: (request.headers['x-scopes'] as string)?.split(',') || [],
      x_request_id: (request.headers['x-request-id'] as string) || randomUUID()
    };
  }

  // Production: Validate JWT with Supabase
  if (!SUPABASE_URL || !SUPABASE_JWT_SECRET) {
    throw new Error('Supabase configuration missing for JWT validation');
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_JWT_SECRET);

    // Verify the JWT token
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      throw new Error('Invalid or expired token');
    }

    // Extract tenant_id from user metadata
    const tenantId = user.user_metadata?.tenant_id;
    if (!tenantId) {
      throw new Error('User missing tenant_id in metadata');
    }

    return {
      tenant_id: tenantId,
      user_id: user.id,
      scopes: user.user_metadata?.scopes || ['user'],
      x_request_id: (request.headers['x-request-id'] as string) || randomUUID()
    };
  } catch (error: any) {
    throw new Error(`JWT validation failed: ${error.message}`);
  }
}

/**
 * Fastify middleware hook for authentication
 */
export async function authenticateRequest(request: FastifyRequest) {
  try {
    const authContext = await validateSupabaseToken(request);

    // Attach to request for use in route handlers
    (request as any).authContext = authContext;
  } catch (error: any) {
    throw new Error(`Authentication failed: ${error.message}`);
  }
}
