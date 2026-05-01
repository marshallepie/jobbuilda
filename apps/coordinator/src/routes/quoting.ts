import { FastifyInstance, FastifyRequest } from 'fastify';
import { extractAuthContext } from '../lib/auth.js';
import { sendEmail } from '../lib/email.js';

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

  // POST /api/quotes/:id/engagement — select engagement option (client or admin)
  fastify.post<{ Params: { id: string }; Body: { engagement_type: string; selected_by?: string } }>(
    '/api/quotes/:id/engagement',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      const { engagement_type, selected_by = 'admin' } = request.body;

      try {
        const result = await fastify.mcp.quoting.callTool(
          'select_engagement_option',
          { quote_id: id, engagement_type, selected_by },
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');

        // Send admin notification when the client makes the selection
        if (selected_by === 'client') {
          try {
            const [quoteResource, profileResource] = await Promise.all([
              fastify.mcp.quoting.readResource(`res://quoting/quotes/${id}`, context),
              fastify.mcp.identity.readResource(`res://identity/tenants/${context.tenant_id}`, context),
            ]);
            const quote = (quoteResource.data as any).data || quoteResource.data;
            const profile = (profileResource.data as any).data || profileResource.data;

            if (profile?.email) {
              const labels: Record<string, string> = {
                option_a: 'Option A — Full cash payment',
                option_b: `Option B — Monthly retainer (${quote.option_b_percent}%/month)`,
                option_c: `Option C — Equity deal (${quote.option_c_equity_percent}% equity)`,
              };
              const label = labels[engagement_type] || engagement_type;
              await sendEmail({
                to: profile.email,
                subject: `Client selected engagement option — ${quote.quote_number}`,
                html: `<p>Your client has selected <strong>${label}</strong> for quote <strong>${quote.quote_number}</strong> (${quote.title}).</p><p>Log in to JobBuilda to review and approve the quote.</p>`,
                text: `Your client has selected ${label} for quote ${quote.quote_number} (${quote.title}).\n\nLog in to JobBuilda to review and approve the quote.`,
              });
            }
          } catch (emailErr) {
            fastify.log.warn(emailErr, 'Failed to send engagement notification email');
          }
        }

        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to select engagement option', message: error.message });
      }
    }
  );

  // PUT /api/quotes/:id/project-urls — replace the project URLs list
  fastify.put<{ Params: { id: string }; Body: { urls: Array<{ label: string; url: string }> } }>(
    '/api/quotes/:id/project-urls',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      const { urls } = request.body;

      try {
        const result = await fastify.mcp.quoting.callTool(
          'update_quote',
          { quote_id: id, project_urls: urls },
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to update project URLs', message: error.message });
      }
    }
  );
}
