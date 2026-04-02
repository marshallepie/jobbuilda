import { FastifyInstance } from 'fastify';
import { extractAuthContext } from '../lib/auth.js';
import { createShortLink, resolveShortLink } from '../lib/shortLinks.js';

const PORTAL_URL = process.env.PORTAL_URL || 'http://localhost:3001';
const API_URL = process.env.API_URL || 'http://localhost:3000';
const TTL_7_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

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
      const shortKey = createShortLink(shareUrl, TTL_7_DAYS_MS);
      const shortUrl = `${API_URL}/s/${shortKey}`;

      const amount = quote.total_inc_vat
        ? `£${parseFloat(quote.total_inc_vat).toFixed(2)}`
        : '';
      const ref = quote.quote_number ? ` (${quote.quote_number})` : '';
      const amountPart = amount ? ` for ${amount}` : '';
      const message = `Hi, please find your quote${ref}${amountPart} here: ${shortUrl}`;
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
   * Generate a 7-day shareable link for an invoice.
   * The WhatsApp message leads with bank details and amount due;
   * the portal view link appears as small print at the end.
   */
  fastify.post('/api/share/invoice/:invoiceId', async (request, reply) => {
    const { invoiceId } = request.params as { invoiceId: string };
    const context = extractAuthContext(request);

    try {
      // Fetch invoice and business profile in parallel
      const [invoiceResource, profileResource] = await Promise.all([
        fastify.mcp.invoicing.readResource(
          `res://invoicing/invoices/${invoiceId}`,
          context
        ),
        fastify.mcp.identity.readResource(
          `res://identity/tenants/${context.tenant_id}`,
          context
        ),
      ]);

      const invoice = (invoiceResource.data as any).data || invoiceResource.data;
      const profile = (profileResource.data as any).data || profileResource.data;

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
      const shortKey = createShortLink(shareUrl, TTL_7_DAYS_MS);
      const shortUrl = `${API_URL}/s/${shortKey}`;

      // Format amounts
      const amountDue = invoice.amount_due
        ? `£${parseFloat(invoice.amount_due).toFixed(2)}`
        : '';
      // Format due date
      const dueDate = invoice.due_date
        ? new Date(invoice.due_date).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
        : '';

      // Format sort code with dashes if stored without them (e.g. "123456" → "12-34-56")
      const rawSortCode: string = profile?.sort_code || '';
      const sortCode = rawSortCode.includes('-')
        ? rawSortCode
        : rawSortCode.replace(/(\d{2})(\d{2})(\d{2})/, '$1-$2-$3');

      const companyName = profile?.trading_name || profile?.name || '';
      const hasBankDetails =
        profile?.account_number && profile?.sort_code && profile?.account_name;

      // Build the message — bank details prominent, portal link at the bottom
      const lines: string[] = [];

      lines.push(`Hi, please find your invoice below from ${companyName}.`);
      lines.push('');

      if (invoice.invoice_number) lines.push(`*Invoice:* ${invoice.invoice_number}`);
      if (amountDue) lines.push(`*Amount due:* ${amountDue}`);
      if (dueDate) lines.push(`*Due by:* ${dueDate}`);

      if (hasBankDetails) {
        lines.push('');
        lines.push('─────────────────────');
        lines.push('*Pay by bank transfer:*');
        lines.push('');
        if (profile.account_name) lines.push(`Account name:  ${profile.account_name}`);
        if (sortCode)             lines.push(`Sort code:     ${sortCode}`);
        if (profile.account_number) lines.push(`Account no:    ${profile.account_number}`);
        if (invoice.invoice_number) lines.push(`Reference:     ${invoice.invoice_number}`);
        lines.push('─────────────────────');
      }

      if (profile?.phone || profile?.email) {
        lines.push('');
        const contact: string[] = [];
        if (profile.phone) contact.push(profile.phone);
        if (profile.email) contact.push(profile.email);
        lines.push(`Questions? ${contact.join(' · ')}`);
      }

      // Portal link as small print
      lines.push('');
      lines.push(`_View invoice online: ${shortUrl}_`);

      const message = lines.join('\n');
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

      return reply.send({
        shareUrl,
        whatsappUrl,
        message,
        expiresAt: tokenData.expires_at,
        invoiceNumber: invoice.invoice_number,
        bankDetails: hasBankDetails
          ? {
              accountName: profile.account_name,
              sortCode,
              accountNumber: profile.account_number,
            }
          : null,
      });
    } catch (error: any) {
      fastify.log.error(error, 'Failed to generate invoice share link');
      return reply.status(500).send({
        error: 'Failed to generate share link',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/share/invoice/:invoiceId/details
   * Returns invoice data + bank details for the portal view page.
   * Called by the portal after decoding the share token client-side.
   */
  fastify.get('/api/share/invoice/:invoiceId/details', async (request, reply) => {
    const { invoiceId } = request.params as { invoiceId: string };
    const context = extractAuthContext(request);

    try {
      const [invoiceResource, profileResource] = await Promise.all([
        fastify.mcp.invoicing.readResource(
          `res://invoicing/invoices/${invoiceId}`,
          context
        ),
        fastify.mcp.identity.readResource(
          `res://identity/tenants/${context.tenant_id}`,
          context
        ),
      ]);

      const invoice = (invoiceResource.data as any).data || invoiceResource.data;
      const profile = (profileResource.data as any).data || profileResource.data;

      // Fetch client details if we have a client_id
      let client: Record<string, any> | null = null;
      if (invoice?.client_id) {
        try {
          const clientResource = await fastify.mcp.clients.readResource(
            `res://clients/clients/${invoice.client_id}`,
            context
          );
          client = (clientResource.data as any).data || clientResource.data || null;
        } catch {
          // Non-fatal — invoice renders without client block
        }
      }

      // Format sort code with dashes if stored without them
      const rawSortCode: string = profile?.sort_code || '';
      const sortCode = rawSortCode.includes('-')
        ? rawSortCode
        : rawSortCode.replace(/(\d{2})(\d{2})(\d{2})/, '$1-$2-$3');

      const bankDetails =
        profile?.account_number && profile?.sort_code && profile?.account_name
          ? {
              accountName: profile.account_name as string,
              sortCode,
              accountNumber: profile.account_number as string,
              bankName: profile.bank_name as string | undefined,
            }
          : null;

      const company = {
        name: (profile?.trading_name || profile?.name) as string | undefined,
        companyNumber: profile?.company_number as string | undefined,
        vatNumber: profile?.vat_number as string | undefined,
        addressLine1: profile?.address_line1 as string | undefined,
        addressLine2: profile?.address_line2 as string | undefined,
        city: profile?.city as string | undefined,
        county: profile?.county as string | undefined,
        postcode: profile?.postcode as string | undefined,
        phone: profile?.phone as string | undefined,
        email: profile?.email as string | undefined,
        logoUrl: profile?.logo_url as string | undefined,
      };

      return reply.send({ invoice, bankDetails, company, client });
    } catch (error: any) {
      fastify.log.error(error, 'Failed to load invoice details for portal view');
      return reply.status(500).send({
        error: 'Failed to load invoice',
        message: error.message,
      });
    }
  });

  /**
   * GET /s/:key
   * Redirect a short share link to its full portal URL.
   */
  fastify.get('/s/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    const target = resolveShortLink(key);
    if (!target) {
      return reply.status(410).send({ error: 'Link expired or not found' });
    }
    return reply.redirect(target, 302);
  });
}
