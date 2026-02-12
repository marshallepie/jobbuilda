import { FastifyInstance } from 'fastify';
import { extractAuthContext } from '../lib/auth.js';

export async function identityRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/identity/users/:userId
   * Get user by ID (calls identity-mcp resource)
   */
  fastify.get<{ Params: { userId: string } }>(
    '/api/identity/users/:userId',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { userId } = request.params;

      try {
        const user = await fastify.mcp.identity.readResource(
          `res://identity/users/${userId}`,
          context
        );

        return user.data;
      } catch (error: any) {
        reply.status(500).send({
          error: 'Failed to fetch user',
          message: error.message
        });
      }
    }
  );

  /**
   * GET /api/identity/tenants/:tenantId
   * Get tenant by ID (calls identity-mcp resource)
   */
  fastify.get<{ Params: { tenantId: string } }>(
    '/api/identity/tenants/:tenantId',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { tenantId } = request.params;

      try {
        const tenant = await fastify.mcp.identity.readResource(
          `res://identity/tenants/${tenantId}`,
          context
        );

        return tenant.data;
      } catch (error: any) {
        reply.status(500).send({
          error: 'Failed to fetch tenant',
          message: error.message
        });
      }
    }
  );

  /**
   * POST /api/identity/portal-tokens
   * Issue portal token (calls identity-mcp tool)
   */
  fastify.post<{
    Body: {
      user_id: string;
      purpose: 'quote_view' | 'invoice_payment' | 'job_status';
      resource_id: string;
      ttl_minutes?: number;
    };
  }>(
    '/api/identity/portal-tokens',
    async (request, reply) => {
      const context = extractAuthContext(request);

      try {
        const result = await fastify.mcp.identity.callTool(
          'issue_portal_token',
          request.body,
          context
        );

        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({
          error: 'Failed to issue portal token',
          message: error.message
        });
      }
    }
  );

  /**
   * POST /api/identity/check-permission
   * Check user permission (calls identity-mcp tool)
   */
  fastify.post<{
    Body: {
      user_id: string;
      scope: string;
    };
  }>(
    '/api/identity/check-permission',
    async (request, reply) => {
      const context = extractAuthContext(request);

      try {
        const result = await fastify.mcp.identity.callTool(
          'check_permission',
          request.body,
          context
        );

        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({
          error: 'Failed to check permission',
          message: error.message
        });
      }
    }
  );
}
