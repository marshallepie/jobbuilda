import { FastifyInstance, FastifyRequest } from 'fastify';
import { extractAuthContext } from '../lib/auth.js';

export async function invoicingRoutes(fastify: FastifyInstance) {
  // GET /api/invoices - List all invoices
  fastify.get('/api/invoices', async (request: FastifyRequest, reply) => {
    const context = extractAuthContext(request);
    const uri = 'res://invoicing/invoices';
    try {
      const result = await fastify.mcp.invoicing.readResource(uri, context);
      return result.data;
    } catch (error: any) {
      reply.status(500).send({ error: 'Failed to list invoices', message: error.message });
    }
  });

  // GET /api/invoices/:id - Get invoice by ID
  fastify.get<{ Params: { id: string } }>(
    '/api/invoices/:id',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      const uri = `res://invoicing/invoices/${id}`;
      try {
        const result = await fastify.mcp.invoicing.readResource(uri, context);
        return result.data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to fetch invoice', message: error.message });
      }
    }
  );

  // GET /api/invoices/job/:jobId - Get invoices for a job
  fastify.get<{ Params: { jobId: string } }>(
    '/api/invoices/job/:jobId',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { jobId } = request.params;
      const uri = `res://invoicing/job-invoices/${jobId}`;
      try {
        const result = await fastify.mcp.invoicing.readResource(uri, context);
        return result.data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to fetch job invoices', message: error.message });
      }
    }
  );

  // POST /api/invoices - Create new invoice
  fastify.post<{ Body: Record<string, unknown> }>(
    '/api/invoices',
    async (request, reply) => {
      const context = extractAuthContext(request);
      try {
        const result = await fastify.mcp.invoicing.callTool(
          'create_invoice',
          request.body,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to create invoice', message: error.message });
      }
    }
  );

  // POST /api/invoices/:id/send - Send invoice
  fastify.post<{ Params: { id: string } }>(
    '/api/invoices/:id/send',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      try {
        const result = await fastify.mcp.invoicing.callTool(
          'send_invoice',
          { invoice_id: id },
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to send invoice', message: error.message });
      }
    }
  );

  // POST /api/invoices/:id/payment - Record payment
  fastify.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/invoices/:id/payment',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      try {
        const args: Record<string, unknown> = { invoice_id: id, ...request.body };
        const result = await fastify.mcp.invoicing.callTool(
          'record_payment',
          args,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to record payment', message: error.message });
      }
    }
  );

  // PUT /api/invoices/:id - Update draft invoice
  fastify.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/invoices/:id',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      try {
        const result = await fastify.mcp.invoicing.callTool(
          'update_invoice',
          { invoice_id: id, ...request.body },
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to update invoice', message: error.message });
      }
    }
  );

  // DELETE /api/invoices/:id - Delete invoice
  fastify.delete<{ Params: { id: string } }>(
    '/api/invoices/:id',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      try {
        const result = await fastify.mcp.invoicing.callTool(
          'delete_invoice',
          { invoice_id: id },
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to delete invoice', message: error.message });
      }
    }
  );

  // POST /api/invoices/:id/cancel - Cancel invoice
  fastify.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/invoices/:id/cancel',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      try {
        const args: Record<string, unknown> = { invoice_id: id, ...request.body };
        const result = await fastify.mcp.invoicing.callTool(
          'cancel_invoice',
          args,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to cancel invoice', message: error.message });
      }
    }
  );
}
