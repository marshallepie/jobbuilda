import { FastifyInstance, FastifyRequest } from 'fastify';
import { extractAuthContext } from '../lib/auth.js';

export async function paymentsRoutes(fastify: FastifyInstance) {
  // GET /api/payments/intents - List all payment intents
  fastify.get('/api/payments/intents', async (request: FastifyRequest, reply) => {
    const context = extractAuthContext(request);
    const uri = 'res://payments/payment-intents';
    try {
      const result = await fastify.mcp.payments.readResource(uri, context);
      return result.data;
    } catch (error: any) {
      reply.status(500).send({ error: 'Failed to list payment intents', message: error.message });
    }
  });

  // GET /api/payments/intents/:id - Get payment intent by ID
  fastify.get<{ Params: { id: string } }>('/api/payments/intents/:id', async (request, reply) => {
    const context = extractAuthContext(request);
    const { id } = request.params;
    const uri = `res://payments/payment-intents/${id}`;
    try {
      const result = await fastify.mcp.payments.readResource(uri, context);
      return result.data;
    } catch (error: any) {
      reply.status(500).send({ error: 'Failed to fetch payment intent', message: error.message });
    }
  });

  // GET /api/payments/transactions - List all payment transactions
  fastify.get('/api/payments/transactions', async (request: FastifyRequest, reply) => {
    const context = extractAuthContext(request);
    const uri = 'res://payments/transactions';
    try {
      const result = await fastify.mcp.payments.readResource(uri, context);
      return result.data;
    } catch (error: any) {
      reply.status(500).send({ error: 'Failed to list payment transactions', message: error.message });
    }
  });

  // GET /api/payments/transactions/:id - Get payment transaction by ID
  fastify.get<{ Params: { id: string } }>('/api/payments/transactions/:id', async (request, reply) => {
    const context = extractAuthContext(request);
    const { id } = request.params;
    const uri = `res://payments/transactions/${id}`;
    try {
      const result = await fastify.mcp.payments.readResource(uri, context);
      return result.data;
    } catch (error: any) {
      reply.status(500).send({ error: 'Failed to fetch payment transaction', message: error.message });
    }
  });

  // GET /api/payments/invoices/:invoiceId/transactions - Get transactions for invoice
  fastify.get<{ Params: { invoiceId: string } }>(
    '/api/payments/invoices/:invoiceId/transactions',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { invoiceId } = request.params;
      const uri = `res://payments/invoice-transactions/${invoiceId}`;
      try {
        const result = await fastify.mcp.payments.readResource(uri, context);
        return result.data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to fetch invoice transactions', message: error.message });
      }
    }
  );

  // POST /api/payments/checkout-session - Create Stripe checkout session
  fastify.post<{ Body: Record<string, unknown> }>(
    '/api/payments/checkout-session',
    async (request, reply) => {
      const context = extractAuthContext(request);
      try {
        const result = await fastify.mcp.payments.callTool(
          'create_checkout_session',
          request.body,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to create checkout session', message: error.message });
      }
    }
  );

  // POST /api/payments/webhook - Process Stripe webhook
  fastify.post<{ Body: Record<string, unknown> }>(
    '/api/payments/webhook',
    async (request, reply) => {
      const context = extractAuthContext(request);
      try {
        const result = await fastify.mcp.payments.callTool(
          'process_webhook',
          request.body,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to process webhook', message: error.message });
      }
    }
  );

  // POST /api/payments/transactions/:id/reconcile - Reconcile payment
  fastify.post<{ Params: { id: string } }>(
    '/api/payments/transactions/:id/reconcile',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      try {
        const result = await fastify.mcp.payments.callTool(
          'reconcile_payment',
          { transaction_id: id },
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to reconcile payment', message: error.message });
      }
    }
  );

  // POST /api/payments/transactions/:id/refund - Create refund
  fastify.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/payments/transactions/:id/refund',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      try {
        const args: Record<string, unknown> = { transaction_id: id, ...request.body };
        const result = await fastify.mcp.payments.callTool(
          'create_refund',
          args,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to create refund', message: error.message });
      }
    }
  );
}
