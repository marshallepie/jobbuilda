import { FastifyInstance, FastifyRequest } from 'fastify';
import { extractAuthContext } from '../lib/auth.js';

export async function reportingRoutes(fastify: FastifyInstance) {
  // GET /api/reporting/profit-loss - Get P&L report
  fastify.get<{ Querystring: { start: string; end: string } }>(
    '/api/reporting/profit-loss',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { start, end } = request.query;

      if (!start || !end) {
        return reply.status(400).send({ error: 'start and end query parameters required' });
      }

      const uri = `res://reporting/profit-loss?start=${start}&end=${end}`;
      try {
        const result = await fastify.mcp.reporting.readResource(uri, context);
        return result.data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to fetch profit & loss report', message: error.message });
      }
    }
  );

  // GET /api/reporting/vat-returns - List VAT returns
  fastify.get('/api/reporting/vat-returns', async (request: FastifyRequest, reply) => {
    const context = extractAuthContext(request);
    const uri = 'res://reporting/vat-returns';
    try {
      const result = await fastify.mcp.reporting.readResource(uri, context);
      return result.data;
    } catch (error: any) {
      reply.status(500).send({ error: 'Failed to list VAT returns', message: error.message });
    }
  });

  // GET /api/reporting/vat-returns/:id - Get VAT return by ID
  fastify.get<{ Params: { id: string } }>(
    '/api/reporting/vat-returns/:id',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      const uri = `res://reporting/vat-returns/${id}`;
      try {
        const result = await fastify.mcp.reporting.readResource(uri, context);
        return result.data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to fetch VAT return', message: error.message });
      }
    }
  );

  // POST /api/reporting/generate - Generate report
  fastify.post<{ Body: Record<string, unknown> }>(
    '/api/reporting/generate',
    async (request, reply) => {
      const context = extractAuthContext(request);
      try {
        const result = await fastify.mcp.reporting.callTool(
          'generate_report',
          request.body,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to generate report', message: error.message });
      }
    }
  );

  // POST /api/reporting/vat-returns - Create VAT return
  fastify.post<{ Body: Record<string, unknown> }>(
    '/api/reporting/vat-returns',
    async (request, reply) => {
      const context = extractAuthContext(request);
      try {
        const result = await fastify.mcp.reporting.callTool(
          'create_vat_return',
          request.body,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to create VAT return', message: error.message });
      }
    }
  );

  // POST /api/reporting/export - Request export
  fastify.post<{ Body: Record<string, unknown> }>(
    '/api/reporting/export',
    async (request, reply) => {
      const context = extractAuthContext(request);
      try {
        const result = await fastify.mcp.reporting.callTool(
          'request_export',
          request.body,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to request export', message: error.message });
      }
    }
  );
}
