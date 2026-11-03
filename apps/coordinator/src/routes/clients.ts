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
      } catch {
        // A tenant-filtered resource miss deliberately has the same public
        // representation whether the ID is foreign or does not exist.
        return reply.status(404).send({ error: 'Client not found' });
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
      } catch {
        // Foreign and absent site IDs deliberately share one public response.
        return reply.status(404).send({ error: 'Site not found' });
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
      contact_name?: string;
      contact_phone?: string;
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
      } catch {
        // Client validation in clients MCP is tenant-scoped. Keep a foreign
        // client indistinguishable from an absent client before site mutation.
        return reply.status(404).send({ error: 'Client not found' });
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
   * PATCH /api/clients/clients/:clientId
   * Update client information
   */
  fastify.patch<{
    Params: { clientId: string };
    Body: {
      name?: string;
      email?: string;
      phone?: string;
      mobile?: string;
      company?: string;
      address_line1?: string;
      address_line2?: string;
      city?: string;
      county?: string;
      postcode?: string;
      notes?: string;
      gdpr_consent?: boolean;
    };
  }>(
    '/api/clients/clients/:clientId',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { clientId } = request.params;

      try {
        const result = await fastify.mcp.clients.callTool(
          'update_client',
          { client_id: clientId, ...request.body },
          context
        );

        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch {
        // The MCP update filters by tenant before publishing. Do not disclose
        // whether a tenant-external client ID exists.
        return reply.status(404).send({ error: 'Client not found' });
      }
    }
  );

  /**
   * PATCH /api/clients/sites/:siteId
   * Update site information
   */
  fastify.patch<{
    Params: { siteId: string };
    Body: {
      name?: string;
      address_line1?: string;
      address_line2?: string;
      city?: string;
      county?: string;
      postcode?: string;
      country?: string;
      contact_name?: string;
      contact_phone?: string;
      access_notes?: string;
    };
  }>(
    '/api/clients/sites/:siteId',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { siteId } = request.params;

      try {
        const result = await fastify.mcp.clients.callTool(
          'update_site',
          { site_id: siteId, ...request.body },
          context
        );

        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({
          error: 'Failed to update site',
          message: error.message
        });
      }
    }
  );

  /**
   * DELETE /api/clients/sites/:siteId
   * Delete a site
   */
  fastify.delete<{
    Params: { siteId: string };
  }>(
    '/api/clients/sites/:siteId',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { siteId } = request.params;

      try {
        const result = await fastify.mcp.clients.callTool(
          'delete_site',
          { site_id: siteId },
          context
        );

        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({
          error: 'Failed to delete site',
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
      if (request.query.confirm !== 'true') {
        // Match foreign/absent clients and do not invoke the destructive tool
        // unless the caller supplied the sole accepted confirmation form.
        return reply.status(404).send({ error: 'Client not found' });
      }

      try {
        const result = await fastify.mcp.clients.callTool(
          'gdpr_delete',
          { client_id: clientId, confirm: true },
          context
        );

        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch {
        // The MCP delete filters by tenant before publishing. Do not disclose
        // whether a tenant-external client ID exists.
        return reply.status(404).send({ error: 'Client not found' });
      }
    }
  );
}
