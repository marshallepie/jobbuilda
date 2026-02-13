import { FastifyInstance, FastifyRequest } from 'fastify';
import { extractAuthContext } from '../lib/auth.js';

export async function variationsRoutes(fastify: FastifyInstance) {
  // GET /api/variations - List all variations
  fastify.get('/api/variations', async (request: FastifyRequest, reply) => {
    const context = extractAuthContext(request);
    const uri = 'res://variations/variations';
    try {
      const result = await fastify.mcp.variations.readResource(uri, context);
      return result.data;
    } catch (error: any) {
      reply.status(500).send({ error: 'Failed to list variations', message: error.message });
    }
  });

  // GET /api/variations/:id - Get variation by ID
  fastify.get<{ Params: { id: string } }>(
    '/api/variations/:id',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      const uri = `res://variations/variations/${id}`;
      try {
        const result = await fastify.mcp.variations.readResource(uri, context);
        return result.data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to fetch variation', message: error.message });
      }
    }
  );

  // GET /api/variations/job/:jobId - Get variations for a job
  fastify.get<{ Params: { jobId: string } }>(
    '/api/variations/job/:jobId',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { jobId } = request.params;
      const uri = `res://variations/job-variations/${jobId}`;
      try {
        const result = await fastify.mcp.variations.readResource(uri, context);
        return result.data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to fetch job variations', message: error.message });
      }
    }
  );

  // POST /api/variations - Create new variation
  fastify.post<{ Body: Record<string, unknown> }>(
    '/api/variations',
    async (request, reply) => {
      const context = extractAuthContext(request);
      try {
        const result = await fastify.mcp.variations.callTool(
          'create_variation',
          request.body,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to create variation', message: error.message });
      }
    }
  );

  // POST /api/variations/:id/approve - Approve variation
  fastify.post<{ Params: { id: string } }>(
    '/api/variations/:id/approve',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      try {
        const result = await fastify.mcp.variations.callTool(
          'approve_variation',
          { variation_id: id },
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to approve variation', message: error.message });
      }
    }
  );

  // POST /api/variations/:id/reject - Reject variation
  fastify.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/variations/:id/reject',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      try {
        const args: Record<string, unknown> = { variation_id: id, ...request.body };
        const result = await fastify.mcp.variations.callTool(
          'reject_variation',
          args,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to reject variation', message: error.message });
      }
    }
  );

  // POST /api/variations/:id/complete - Complete variation
  fastify.post<{ Params: { id: string } }>(
    '/api/variations/:id/complete',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      try {
        const result = await fastify.mcp.variations.callTool(
          'complete_variation',
          { variation_id: id },
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to complete variation', message: error.message });
      }
    }
  );
}
