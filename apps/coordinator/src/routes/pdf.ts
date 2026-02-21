import { FastifyInstance } from 'fastify';
import { generatePDFFromHTML } from '../lib/pdf.js';

export async function pdfRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/pdf/quote/:quoteId
   * Generate and download quote PDF
   */
  fastify.get('/api/pdf/quote/:quoteId', async (request, reply) => {
    const { quoteId } = request.params as { quoteId: string };

    try {
      // Get tenant_id from headers or use default for dev
      const tenantId = (request.headers['x-tenant-id'] as string) ||
                       '550e8400-e29b-41d4-a716-446655440000';
      const userId = (request.headers['x-user-id'] as string) || 'preview-user';

      const context = {
        tenant_id: tenantId,
        user_id: userId,
        scopes: [],
        x_request_id: request.id,
      };

      // Fetch quote data from quoting-mcp
      const quoteResource = await fastify.mcp.quoting.readResource(
        `res://quoting/quotes/${quoteId}`,
        context
      );

      const quote = quoteResource.data as any;

      // Fetch business profile for template settings
      const profileResource = await fastify.mcp.identity.readResource(
        `res://identity/tenants/${context.tenant_id}`,
        context
      );

      const profile = profileResource.data as any;

      // Generate HTML for the quote
      const html = generateQuoteHTML(quote, profile);

      // Generate PDF from HTML
      const pdfBuffer = await generatePDFFromHTML(html, {
        format: 'A4',
        margin: {
          top: '0.4in',
          right: '0.4in',
          bottom: '0.4in',
          left: '0.4in',
        },
        printBackground: true,
      });

      // Set headers for PDF download
      const fileName = `Quote_${quote.quote_number}_${quote.client_name?.replace(/\s+/g, '_') || 'Client'}.pdf`;
      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
      reply.header('Content-Length', pdfBuffer.length);

      return reply.send(pdfBuffer);
    } catch (error: any) {
      fastify.log.error({ error, quoteId }, 'Failed to generate quote PDF');
      return reply.status(500).send({
        error: 'Failed to generate PDF',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/pdf/invoice/:invoiceId
   * Generate and download invoice PDF
   */
  fastify.get('/api/pdf/invoice/:invoiceId', async (request, reply) => {
    const { invoiceId } = request.params as { invoiceId: string };

    try {
      // Get tenant_id from headers or use default for dev
      const tenantId = (request.headers['x-tenant-id'] as string) ||
                       '550e8400-e29b-41d4-a716-446655440000';
      const userId = (request.headers['x-user-id'] as string) || 'preview-user';

      const context = {
        tenant_id: tenantId,
        user_id: userId,
        scopes: [],
        x_request_id: request.id,
      };

      // Fetch invoice data from invoicing-mcp
      const invoiceResource = await fastify.mcp.invoicing.readResource(
        `res://invoicing/invoices/${invoiceId}`,
        context
      );

      const invoice = invoiceResource.data as any;

      // Fetch business profile for template settings
      const profileResource = await fastify.mcp.identity.readResource(
        `res://identity/tenants/${context.tenant_id}`,
        context
      );

      const profile = profileResource.data as any;

      // Generate HTML for the invoice
      const html = generateInvoiceHTML(invoice, profile);

      // Generate PDF from HTML
      const pdfBuffer = await generatePDFFromHTML(html, {
        format: 'A4',
        margin: {
          top: '0.4in',
          right: '0.4in',
          bottom: '0.4in',
          left: '0.4in',
        },
        printBackground: true,
      });

      // Set headers for PDF download
      const fileName = `Invoice_${invoice.invoice_number}_${invoice.client_name?.replace(/\s+/g, '_') || 'Client'}.pdf`;
      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
      reply.header('Content-Length', pdfBuffer.length);

      return reply.send(pdfBuffer);
    } catch (error: any) {
      fastify.log.error({ error, invoiceId }, 'Failed to generate invoice PDF');
      return reply.status(500).send({
        error: 'Failed to generate PDF',
        message: error.message,
      });
    }
  });
}

/**
 * Generate HTML for quote PDF (reusing template from preview)
 * This is a simplified version - you can import the actual template function
 */
function generateQuoteHTML(quote: any, profile: any): string {
  const templateFont = profile.template_font || 'Inter';
  const primaryColor = profile.primary_color || '#3B82F6';
  const showItemCodes = profile.show_item_codes !== false;
  const showItemDescriptions = profile.show_item_descriptions !== false;

  const quoteDate = new Date(quote.created_at).toLocaleDateString('en-GB');
  const validUntil = new Date(quote.valid_until).toLocaleDateString('en-GB');

  // Generate line items HTML
  const lineItemsHTML = (quote.items || []).map((item: any) => {
    const qty = item.quantity || 1;
    const rate = item.unit_price_ex_vat || 0;
    const markup = item.markup_percent || 0;
    const subtotal = qty * rate * (1 + markup / 100);

    return `
      <tr>
        <td>
          <div><strong>${item.description}</strong></div>
          ${showItemCodes && item.sku ? `<div class="item-code">SKU: ${item.sku}</div>` : ''}
          ${showItemDescriptions && item.notes ? `<div class="item-description">${item.notes}</div>` : ''}
        </td>
        <td class="text-right">${qty}</td>
        <td class="text-right">£${rate.toFixed(2)}</td>
        <td class="text-right">£${subtotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  const subtotal = quote.subtotal_ex_vat || 0;
  const vatAmount = quote.vat_amount || 0;
  const total = quote.total_inc_vat || 0;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Quote ${quote.quote_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ${templateFont}, -apple-system, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      padding: 20px;
    }
    .container {
      max-width: 850px;
      margin: 0 auto;
    }
    ${profile.header_image_url ? `.header-banner { width: 100%; max-height: 120px; object-fit: cover; margin-bottom: 20px; }` : ''}
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
      padding-bottom: 15px;
      border-bottom: 2px solid ${primaryColor};
    }
    .logo { max-height: 60px; }
    .company-info { text-align: right; font-size: 12px; }
    .company-name { font-size: 20px; font-weight: bold; color: ${primaryColor}; margin-bottom: 5px; }
    .document-title { font-size: 28px; font-weight: bold; color: ${primaryColor}; margin-bottom: 20px; }
    .details-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
    .detail-block h3 { font-size: 11px; text-transform: uppercase; color: #6b7280; margin-bottom: 5px; }
    .detail-block p { font-size: 13px; margin-bottom: 3px; }
    .validity-notice { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 10px 12px; margin-bottom: 20px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead { background: ${primaryColor}; color: white; }
    th { padding: 10px; text-align: left; font-size: 12px; font-weight: 600; }
    td { padding: 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
    .item-code { color: #6b7280; font-size: 11px; }
    .item-description { color: #6b7280; font-size: 12px; margin-top: 3px; }
    .text-right { text-align: right; }
    .totals { margin-left: auto; width: 300px; }
    .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
    .total-row.subtotal { border-top: 1px solid #e5e7eb; }
    .total-row.grand-total { border-top: 2px solid ${primaryColor}; font-size: 16px; font-weight: bold; color: ${primaryColor}; padding-top: 10px; margin-top: 6px; }
    .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #6b7280; white-space: pre-line; }
  </style>
</head>
<body>
  <div class="container">
    ${profile.header_image_url ? `<img src="${profile.header_image_url}" alt="Header" class="header-banner">` : ''}

    <div class="header">
      <div>
        ${profile.logo_url ? `<img src="${profile.logo_url}" alt="Logo" class="logo">` : `<div class="company-name">${profile.name || 'Your Company'}</div>`}
      </div>
      <div class="company-info">
        <div style="font-weight: 600; margin-bottom: 5px;">${profile.trading_name || profile.name || 'Your Company'}</div>
        ${profile.address_line1 ? `<div>${profile.address_line1}</div>` : ''}
        ${profile.city || profile.postcode ? `<div>${profile.city || ''}${profile.city && profile.postcode ? ', ' : ''}${profile.postcode || ''}</div>` : ''}
        ${profile.phone ? `<div>Tel: ${profile.phone}</div>` : ''}
        ${profile.email ? `<div>${profile.email}</div>` : ''}
        ${profile.vat_number ? `<div>VAT: ${profile.vat_number}</div>` : ''}
      </div>
    </div>

    <h1 class="document-title">QUOTATION</h1>

    <div class="details-section">
      <div class="detail-block">
        <h3>Prepared For</h3>
        <p><strong>${quote.client_name || 'Client Name'}</strong></p>
        ${quote.site_name ? `<p>${quote.site_name}</p>` : ''}
        ${quote.site_address ? `<p>${quote.site_address}</p>` : ''}
      </div>
      <div class="detail-block">
        <h3>Quote Details</h3>
        <p><strong>Quote #:</strong> ${quote.quote_number}</p>
        <p><strong>Date:</strong> ${quoteDate}</p>
        <p><strong>Valid Until:</strong> ${validUntil}</p>
      </div>
    </div>

    <div class="validity-notice">
      <strong>⏱ Valid for 30 days</strong> - This quotation is valid until ${validUntil}
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="text-right">Qty</th>
          <th class="text-right">Rate</th>
          <th class="text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemsHTML}
      </tbody>
    </table>

    <div class="totals">
      <div class="total-row subtotal">
        <span>Subtotal:</span>
        <span>£${subtotal.toFixed(2)}</span>
      </div>
      <div class="total-row">
        <span>VAT (${profile.default_vat_rate || 20}%):</span>
        <span>£${vatAmount.toFixed(2)}</span>
      </div>
      <div class="total-row grand-total">
        <span>Total:</span>
        <span>£${total.toFixed(2)}</span>
      </div>
    </div>

    ${profile.footer_text ? `<div class="footer">${profile.footer_text}</div>` : ''}
  </div>
</body>
</html>`;
}

/**
 * Generate HTML for invoice PDF
 * Similar structure to quote, adapted for invoices
 */
function generateInvoiceHTML(invoice: any, profile: any): string {
  // Implementation similar to generateQuoteHTML but for invoices
  // This would be similar logic, just adapted for invoice data structure
  return generateQuoteHTML(invoice, profile).replace('QUOTATION', 'INVOICE');
}
