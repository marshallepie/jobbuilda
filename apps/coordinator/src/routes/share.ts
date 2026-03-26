import { FastifyInstance } from 'fastify';
import { extractAuthContext } from '../lib/auth.js';

const PORTAL_URL = process.env.PORTAL_URL || 'http://localhost:3001';

export async function shareRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/share/quote/:quoteId
   * Generate a 7-day shareable link for a quote (for WhatsApp or copy-paste)
   */
  fastify.post('/api/share/quote/:quoteId', async (request, reply) => {
    const { quoteId } = request.params as { quoteId: string };
    const context = extractAuthContext(request);

    try {
      // Fetch quote to build the message preview
      const quoteResource = await fastify.mcp.quoting.readResource(
        `res://quoting/quotes/${quoteId}`,
        context
      );
      const quoteWrapper = quoteResource.data as any;
      const quote = quoteWrapper.data || quoteWrapper;

      // Issue a share token with 7-day TTL
      const tokenResult = await fastify.mcp.identity.callTool(
        'issue_portal_token',
        {
          user_id: context.user_id,
          purpose: 'quote_view',
          resource_id: quoteId,
          ttl_minutes: 10080, // 7 days
        },
        context
      );
      const tokenData = JSON.parse(tokenResult.content[0]?.text || '{}');

      if (!tokenData.token) {
        throw new Error('Failed to generate share token');
      }

      const shareUrl = `${PORTAL_URL}/view?token=${tokenData.token}`;

      const amount = quote.total_inc_vat
        ? `£${parseFloat(quote.total_inc_vat).toFixed(2)}`
        : '';
      const ref = quote.quote_number ? ` (${quote.quote_number})` : '';
      const amountPart = amount ? ` for ${amount}` : '';
      const message = `Hi, please find your quote${ref}${amountPart} here: ${shareUrl}`;
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

      return reply.send({
        shareUrl,
        whatsappUrl,
        message,
        expiresAt: tokenData.expires_at,
        quoteNumber: quote.quote_number,
      });
    } catch (error: any) {
      fastify.log.error(error, 'Failed to generate quote share link');
      return reply.status(500).send({
        error: 'Failed to generate share link',
        message: error.message,
      });
    }
  });

  /**
   * POST /api/share/invoice/:invoiceId
   * Generate a 7-day shareable link for an invoice (for WhatsApp or copy-paste)
   */
  fastify.post('/api/share/invoice/:invoiceId', async (request, reply) => {
    const { invoiceId } = request.params as { invoiceId: string };
    const context = extractAuthContext(request);

    try {
      // Fetch invoice to build the message preview
      const invoiceResource = await fastify.mcp.invoicing.readResource(
        `res://invoicing/invoices/${invoiceId}`,
        context
      );
      const invoiceWrapper = invoiceResource.data as any;
      const invoice = invoiceWrapper.data || invoiceWrapper;

      // Issue a share token with 7-day TTL
      const tokenResult = await fastify.mcp.identity.callTool(
        'issue_portal_token',
        {
          user_id: context.user_id,
          purpose: 'invoice_payment',
          resource_id: invoiceId,
          ttl_minutes: 10080, // 7 days
        },
        context
      );
      const tokenData = JSON.parse(tokenResult.content[0]?.text || '{}');

      if (!tokenData.token) {
        throw new Error('Failed to generate share token');
      }

      const shareUrl = `${PORTAL_URL}/view?token=${tokenData.token}`;

      const amountDue = invoice.amount_due
        ? `£${parseFloat(invoice.amount_due).toFixed(2)}`
        : '';
      const ref = invoice.invoice_number ? ` (${invoice.invoice_number})` : '';
      const amountPart = amountDue ? ` for ${amountDue}` : '';
      const message = `Hi, please find your invoice${ref}${amountPart} here: ${shareUrl}`;
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

      return reply.send({
        shareUrl,
        whatsappUrl,
        message,
        expiresAt: tokenData.expires_at,
        invoiceNumber: invoice.invoice_number,
      });
    } catch (error: any) {
      fastify.log.error(error, 'Failed to generate invoice share link');
      return reply.status(500).send({
        error: 'Failed to generate share link',
        message: error.message,
      });
    }
  });
}
