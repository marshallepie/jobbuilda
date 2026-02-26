import { FastifyInstance, FastifyRequest } from 'fastify';
import { extractAuthContext } from '../lib/auth.js';

export async function quotingRoutes(fastify: FastifyInstance) {
  // ===== LEADS =====

  // GET /api/leads - List all leads
  fastify.get('/api/leads', async (request: FastifyRequest, reply) => {
    const context = extractAuthContext(request);
    const uri = 'res://quoting/leads';
    try {
      const result = await fastify.mcp.quoting.readResource(uri, context);
      return result.data;
    } catch (error: any) {
      reply.status(500).send({ error: 'Failed to list leads', message: error.message });
    }
  });

  // GET /api/leads/:id - Get lead by ID
  fastify.get<{ Params: { id: string } }>(
    '/api/leads/:id',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      const uri = `res://quoting/leads/${id}`;
      try {
        const result = await fastify.mcp.quoting.readResource(uri, context);
        return result.data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to fetch lead', message: error.message });
      }
    }
  );

  // POST /api/leads - Create lead
  fastify.post<{ Body: Record<string, unknown> }>(
    '/api/leads',
    async (request, reply) => {
      const context = extractAuthContext(request);
      try {
        const result = await fastify.mcp.quoting.callTool(
          'create_lead',
          request.body,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to create lead', message: error.message });
      }
    }
  );

  // ===== QUOTES =====

  // GET /api/quotes - List all quotes
  fastify.get('/api/quotes', async (request: FastifyRequest, reply) => {
    const context = extractAuthContext(request);
    const uri = 'res://quoting/quotes';
    try {
      const result = await fastify.mcp.quoting.readResource(uri, context);
      return result.data;
    } catch (error: any) {
      reply.status(500).send({ error: 'Failed to list quotes', message: error.message });
    }
  });

  // GET /api/quotes/:id - Get quote by ID with line items
  fastify.get<{ Params: { id: string } }>(
    '/api/quotes/:id',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      const uri = `res://quoting/quotes/${id}`;
      try {
        const result = await fastify.mcp.quoting.readResource(uri, context);
        return result.data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to fetch quote', message: error.message });
      }
    }
  );

  // GET /api/quotes/by-client/:clientId - List quotes by client
  fastify.get<{ Params: { clientId: string } }>(
    '/api/quotes/by-client/:clientId',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { clientId } = request.params;
      const uri = `res://quoting/quotes/by-client/${clientId}`;
      try {
        const result = await fastify.mcp.quoting.readResource(uri, context);
        return result.data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to list quotes by client', message: error.message });
      }
    }
  );

  // POST /api/quotes - Create quote
  fastify.post<{ Body: Record<string, unknown> }>(
    '/api/quotes',
    async (request, reply) => {
      const context = extractAuthContext(request);
      try {
        const result = await fastify.mcp.quoting.callTool(
          'create_quote',
          request.body,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to create quote', message: error.message });
      }
    }
  );

  // POST /api/quotes/:id/send - Send quote to client
  fastify.post<{ Params: { id: string } }>(
    '/api/quotes/:id/send',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      try {
        const result = await fastify.mcp.quoting.callTool(
          'send_quote',
          { quote_id: id },
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to send quote', message: error.message });
      }
    }
  );

  // POST /api/quotes/:id/approve - Approve quote
  fastify.post<{ Params: { id: string } }>(
    '/api/quotes/:id/approve',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      try {
        const result = await fastify.mcp.quoting.callTool(
          'approve_quote',
          { quote_id: id },
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to approve quote', message: error.message });
      }
    }
  );

  // POST /api/quotes/:id/reject - Reject quote
  fastify.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/quotes/:id/reject',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      try {
        const args: Record<string, unknown> = { quote_id: id, ...request.body };
        const result = await fastify.mcp.quoting.callTool(
          'reject_quote',
          args,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to reject quote', message: error.message });
      }
    }
  );

  // PUT /api/quotes/:id - Update quote header fields
  fastify.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/quotes/:id',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      try {
        const result = await fastify.mcp.quoting.callTool(
          'update_quote',
          { quote_id: id, ...request.body },
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to update quote', message: error.message });
      }
    }
  );

  // POST /api/quotes/:id/items - Add item to quote
  fastify.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/quotes/:id/items',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      try {
        const result = await fastify.mcp.quoting.callTool(
          'add_quote_item',
          { quote_id: id, ...request.body },
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to add quote item', message: error.message });
      }
    }
  );

  // DELETE /api/quotes/:id/items/:itemId - Remove item from quote
  fastify.delete<{ Params: { id: string; itemId: string } }>(
    '/api/quotes/:id/items/:itemId',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id, itemId } = request.params;
      try {
        const result = await fastify.mcp.quoting.callTool(
          'remove_quote_item',
          { quote_id: id, item_id: itemId },
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to remove quote item', message: error.message });
      }
    }
  );

  // DELETE /api/quotes/:id - Delete quote
  fastify.delete<{ Params: { id: string } }>(
    '/api/quotes/:id',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      try {
        const result = await fastify.mcp.quoting.callTool(
          'delete_quote',
          { quote_id: id },
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to delete quote', message: error.message });
      }
    }
  );
}
