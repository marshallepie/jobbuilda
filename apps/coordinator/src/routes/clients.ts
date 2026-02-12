import { FastifyInstance } from 'fastify';
import { extractAuthContext } from '../lib/auth.js';

export async function clientsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/clients/clients/:clientId
   * Get client by ID
   */
  fastify.get<{ Params: { clientId: string } }>(
    '/api/clients/clients/:clientId',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { clientId } = request.params;

      try {
        const client = await fastify.mcp.clients.readResource(
          `res://clients/clients/${clientId}`,
          context
        );

        return client.data;
      } catch (error: any) {
        reply.status(500).send({
          error: 'Failed to fetch client',
          message: error.message
        });
      }
    }
  );

  /**
   * GET /api/clients/clients
   * List all clients
   */
  fastify.get(
    '/api/clients/clients',
    async (request, reply) => {
      const context = extractAuthContext(request);

      try {
        const clients = await fastify.mcp.clients.readResource(
          'res://clients/clients',
          context
        );

        return clients.data;
      } catch (error: any) {
        reply.status(500).send({
          error: 'Failed to list clients',
          message: error.message
        });
      }
    }
  );

  /**
   * GET /api/clients/sites/:siteId
   * Get site by ID
   */
  fastify.get<{ Params: { siteId: string } }>(
    '/api/clients/sites/:siteId',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { siteId } = request.params;

      try {
        const site = await fastify.mcp.clients.readResource(
          `res://clients/sites/${siteId}`,
          context
        );

        return site.data;
      } catch (error: any) {
        reply.status(500).send({
          error: 'Failed to fetch site',
          message: error.message
        });
      }
    }
  );

  /**
   * GET /api/clients/clients/:clientId/sites
   * List all sites for a client
   */
  fastify.get<{ Params: { clientId: string } }>(
    '/api/clients/clients/:clientId/sites',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { clientId } = request.params;

      try {
        const sites = await fastify.mcp.clients.readResource(
          `res://clients/sites/by-client/${clientId}`,
          context
        );

        return sites.data;
      } catch (error: any) {
        reply.status(500).send({
          error: 'Failed to list sites',
          message: error.message
        });
      }
    }
  );

  /**
   * POST /api/clients/clients
   * Create a new client
   */
  fastify.post<{
    Body: {
      name: string;
      email?: string;
      phone?: string;
      company?: string;
      notes?: string;
      gdpr_consent?: boolean;
    };
  }>(
    '/api/clients/clients',
    async (request, reply) => {
      const context = extractAuthContext(request);

      try {
        const result = await fastify.mcp.clients.callTool(
          'create_client',
          request.body,
          context
        );

        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({
          error: 'Failed to create client',
          message: error.message
        });
      }
    }
  );

  /**
   * POST /api/clients/sites
   * Create a new site
   */
  fastify.post<{
    Body: {
      client_id: string;
      name: string;
      address_line1: string;
      address_line2?: string;
      city: string;
      county?: string;
      postcode: string;
      country?: string;
      access_notes?: string;
    };
  }>(
    '/api/clients/sites',
    async (request, reply) => {
      const context = extractAuthContext(request);

      try {
        const result = await fastify.mcp.clients.callTool(
          'create_site',
          request.body,
          context
        );

        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({
          error: 'Failed to create site',
          message: error.message
        });
      }
    }
  );

  /**
   * POST /api/clients/gdpr/export
   * Export client data for GDPR compliance
   */
  fastify.post<{
    Body: {
      client_id: string;
    };
  }>(
    '/api/clients/gdpr/export',
    async (request, reply) => {
      const context = extractAuthContext(request);

      try {
        const result = await fastify.mcp.clients.callTool(
          'gdpr_export',
          request.body,
          context
        );

        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({
          error: 'Failed to export client data',
          message: error.message
        });
      }
    }
  );

  /**
   * DELETE /api/clients/gdpr/:clientId
   * Delete client data for GDPR compliance
   */
  fastify.delete<{
    Params: { clientId: string };
    Querystring: { confirm?: string };
  }>(
    '/api/clients/gdpr/:clientId',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { clientId } = request.params;
      const confirm = request.query.confirm === 'true';

      try {
        const result = await fastify.mcp.clients.callTool(
          'gdpr_delete',
          { client_id: clientId, confirm },
          context
        );

        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({
          error: 'Failed to delete client data',
          message: error.message
        });
      }
    }
  );
}
