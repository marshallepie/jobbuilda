import { FastifyInstance } from 'fastify';
import { sendEmail, generateQuoteEmail, generateQuoteEmailText, generateInvoiceEmail } from '../lib/email.js';
import { generatePDFFromHTML } from '../lib/pdf.js';

export async function emailRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/email/quote/:quoteId/send
   * Send quote to client via email with PDF attachment
   */
  fastify.post('/api/email/quote/:quoteId/send', async (request, reply) => {
    const { quoteId } = request.params as { quoteId: string };

    try {
      // Get auth context
      const tenantId = (request.headers['x-tenant-id'] as string) ||
                       '550e8400-e29b-41d4-a716-446655440000';
      const userId = (request.headers['x-user-id'] as string) || 'user';

      const context = {
        tenant_id: tenantId,
        user_id: userId,
        scopes: [],
        x_request_id: request.id,
      };

      // Fetch quote data
      const quoteResource = await fastify.mcp.quoting.readResource(
        `res://quoting/quotes/${quoteId}`,
        context
      );
      const quote = quoteResource.data;

      // Fetch client data to get email
      const clientResource = await fastify.mcp.clients.readResource(
        `res://clients/clients/${quote.client_id}`,
        context
      );
      const client = clientResource.data;

      if (!client.email) {
        return reply.status(400).send({
          error: 'Client has no email address',
          message: 'Please add an email address to the client before sending the quote.',
        });
      }

      // Fetch business profile
      const profileResource = await fastify.mcp.identity.readResource(
        `res://identity/tenants/${context.tenant_id}`,
        context
      );
      const profile = profileResource.data;

      // Generate quote PDF
      const quoteHTML = generateQuoteHTMLForPDF(quote, profile);
      const pdfBuffer = await generatePDFFromHTML(quoteHTML, {
        format: 'A4',
        margin: {
          top: '0.4in',
          right: '0.4in',
          bottom: '0.4in',
          left: '0.4in',
        },
        printBackground: true,
      });

      // Format data for email
      const validUntil = new Date(quote.valid_until).toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const total = new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
      }).format(quote.total_inc_vat);

      // Generate email content
      const emailHTML = generateQuoteEmail({
        clientName: client.name,
        quoteNumber: quote.quote_number,
        companyName: profile.name || 'Your Company',
        total,
        validUntil,
        viewUrl: undefined, // TODO: Add client portal URL when available
      });

      const emailText = generateQuoteEmailText({
        clientName: client.name,
        quoteNumber: quote.quote_number,
        companyName: profile.name || 'Your Company',
        total,
        validUntil,
      });

      // Send email with PDF attachment
      const emailResult = await sendEmail({
        to: client.email,
        from: profile.email || undefined,
        subject: `Quote ${quote.quote_number} from ${profile.name || 'Your Company'}`,
        html: emailHTML,
        text: emailText,
        replyTo: profile.email || undefined,
        attachments: [
          {
            filename: `Quote_${quote.quote_number}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });

      // Update quote status to "sent"
      await fastify.mcp.quoting.callTool(
        'update_quote',
        {
          quote_id: quoteId,
          status: 'sent',
        },
        context
      );

      fastify.log.info({ quoteId, emailId: emailResult.id, clientEmail: client.email }, 'Quote sent via email');

      return reply.send({
        success: true,
        message: 'Quote sent successfully',
        emailId: emailResult.id,
        sentTo: client.email,
      });
    } catch (error: any) {
      fastify.log.error({ error, quoteId }, 'Failed to send quote email');
      return reply.status(500).send({
        error: 'Failed to send quote',
        message: error.message,
      });
    }
  });

  /**
   * POST /api/email/invoice/:invoiceId/send
   * Send invoice to client via email with PDF attachment
   */
  fastify.post('/api/email/invoice/:invoiceId/send', async (request, reply) => {
    const { invoiceId } = request.params as { invoiceId: string };

    try {
      // Get auth context
      const tenantId = (request.headers['x-tenant-id'] as string) ||
                       '550e8400-e29b-41d4-a716-446655440000';
      const userId = (request.headers['x-user-id'] as string) || 'user';

      const context = {
        tenant_id: tenantId,
        user_id: userId,
        scopes: [],
        x_request_id: request.id,
      };

      // Fetch invoice data
      const invoiceResource = await fastify.mcp.invoicing.readResource(
        `res://invoicing/invoices/${invoiceId}`,
        context
      );
      const invoice = invoiceResource.data;

      // Fetch client data
      const clientResource = await fastify.mcp.clients.readResource(
        `res://clients/clients/${invoice.client_id}`,
        context
      );
      const client = clientResource.data;

      if (!client.email) {
        return reply.status(400).send({
          error: 'Client has no email address',
          message: 'Please add an email address to the client before sending the invoice.',
        });
      }

      // Fetch business profile
      const profileResource = await fastify.mcp.identity.readResource(
        `res://identity/tenants/${context.tenant_id}`,
        context
      );
      const profile = profileResource.data;

      // Generate invoice PDF
      const invoiceHTML = generateInvoiceHTMLForPDF(invoice, profile);
      const pdfBuffer = await generatePDFFromHTML(invoiceHTML, {
        format: 'A4',
        margin: {
          top: '0.4in',
          right: '0.4in',
          bottom: '0.4in',
          left: '0.4in',
        },
        printBackground: true,
      });

      // Format data for email
      const dueDate = new Date(invoice.due_date).toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const total = new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
      }).format(invoice.total_inc_vat);

      // Generate email content
      const emailHTML = generateInvoiceEmail({
        clientName: client.name,
        invoiceNumber: invoice.invoice_number,
        companyName: profile.name || 'Your Company',
        total,
        dueDate,
        paymentUrl: undefined, // TODO: Add Stripe payment link when available
      });

      // Send email with PDF attachment
      const emailResult = await sendEmail({
        to: client.email,
        from: profile.email || undefined,
        subject: `Invoice ${invoice.invoice_number} from ${profile.name || 'Your Company'}`,
        html: emailHTML,
        replyTo: profile.email || undefined,
        attachments: [
          {
            filename: `Invoice_${invoice.invoice_number}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });

      // Update invoice status to "sent"
      await fastify.mcp.invoicing.callTool(
        'update_invoice',
        {
          invoice_id: invoiceId,
          status: 'sent',
        },
        context
      );

      fastify.log.info({ invoiceId, emailId: emailResult.id, clientEmail: client.email }, 'Invoice sent via email');

      return reply.send({
        success: true,
        message: 'Invoice sent successfully',
        emailId: emailResult.id,
        sentTo: client.email,
      });
    } catch (error: any) {
      fastify.log.error({ error, invoiceId }, 'Failed to send invoice email');
      return reply.status(500).send({
        error: 'Failed to send invoice',
        message: error.message,
      });
    }
  });
}

/**
 * Generate HTML for quote PDF (simplified version)
 * In production, this should reuse the same function from pdf.ts
 */
function generateQuoteHTMLForPDF(quote: any, profile: any): string {
  // For now, generate a simple HTML
  // TODO: Import and reuse the function from pdf.ts to avoid duplication
  const lineItems = (quote.items || []).map((item: any) => `
    <tr>
      <td>${item.description}</td>
      <td>${item.quantity}</td>
      <td>£${(item.unit_price_ex_vat || 0).toFixed(2)}</td>
      <td>£${(item.line_total_inc_vat || 0).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Quote ${quote.quote_number}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; }
    h1 { color: ${profile.primary_color || '#3B82F6'}; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: ${profile.primary_color || '#3B82F6'}; color: white; }
    .total { font-size: 18px; font-weight: bold; text-align: right; margin-top: 20px; }
  </style>
</head>
<body>
  <h1>QUOTATION</h1>
  <p><strong>Quote Number:</strong> ${quote.quote_number}</p>
  <p><strong>Client:</strong> ${quote.client_name || 'N/A'}</p>
  <p><strong>Valid Until:</strong> ${new Date(quote.valid_until).toLocaleDateString('en-GB')}</p>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Qty</th>
        <th>Rate</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${lineItems}
    </tbody>
  </table>

  <div class="total">
    <p>Subtotal: £${(quote.subtotal_ex_vat || 0).toFixed(2)}</p>
    <p>VAT: £${(quote.vat_amount || 0).toFixed(2)}</p>
    <p>Total: £${(quote.total_inc_vat || 0).toFixed(2)}</p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate HTML for invoice PDF (simplified version)
 */
function generateInvoiceHTMLForPDF(invoice: any, profile: any): string {
  // Similar to quote, but for invoices
  return generateQuoteHTMLForPDF(invoice, profile).replace('QUOTATION', 'INVOICE');
}
