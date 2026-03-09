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

      const quoteWrapper = quoteResource.data as any;
      const quote = quoteWrapper.data || quoteWrapper;

      // Fetch business profile for template settings
      const profileResource = await fastify.mcp.identity.readResource(
        `res://identity/tenants/${context.tenant_id}`,
        context
      );

      const profileWrapperQ = profileResource.data as any;
      const profile = profileWrapperQ.data || profileWrapperQ;

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

      const invoiceWrapper = invoiceResource.data as any;
      const invoice = invoiceWrapper.data || invoiceWrapper;

      // Fetch business profile for template settings
      const profileResource = await fastify.mcp.identity.readResource(
        `res://identity/tenants/${context.tenant_id}`,
        context
      );

      const profileWrapper = profileResource.data as any;
      const profile = profileWrapper.data || profileWrapper;

      // Fetch client details if available
      if (invoice.client_id) {
        try {
          const clientResource = await fastify.mcp.clients.readResource(
            `res://clients/clients/${invoice.client_id}`,
            context
          );
          const clientWrapper = clientResource.data as any;
          const client = clientWrapper.data || clientWrapper;
          invoice.client_name = client.name;
          invoice.client_email = client.email;
          invoice.client_phone = client.phone;
          invoice.client_address = [
            client.address_line1,
            client.address_line2,
            client.city,
            client.postcode,
          ].filter(Boolean).join(', ');
        } catch (e) {
          // Client fetch failed — continue without it
        }
      }

      // Fetch site details if available
      if (invoice.site_id) {
        try {
          const siteResource = await fastify.mcp.clients.readResource(
            `res://clients/sites/${invoice.site_id}`,
            context
          );
          const siteWrapper = siteResource.data as any;
          const site = siteWrapper.data || siteWrapper;
          invoice.site_name = site.name;
          invoice.site_address = [
            site.address_line1,
            site.address_line2,
            site.city,
            site.county,
            site.postcode,
          ].filter(Boolean).join(', ');
        } catch (e) {
          // Site fetch failed — continue without it
        }
      }

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
export function generateQuoteHTML(quote: any, profile: any): string {
  const templateFont = profile.template_font || 'Inter';
  const primaryColor = profile.primary_color || '#3B82F6';
  const showItemCodes = profile.show_item_codes !== false;
  const showItemDescriptions = profile.show_item_descriptions !== false;

  const quoteDate = new Date(quote.created_at).toLocaleDateString('en-GB');
  const validUntil = new Date(quote.valid_until).toLocaleDateString('en-GB');

  // Generate line items HTML
  const lineItemsHTML = (quote.items || []).map((item: any) => {
    const qty = parseFloat(item.quantity) || 1;
    const rate = parseFloat(item.unit_price_ex_vat) || 0;
    const markup = parseFloat(item.markup_percent) || 0;
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

  const subtotal = parseFloat(quote.subtotal_ex_vat) || 0;
  const vatAmount = parseFloat(quote.vat_amount) || 0;
  const total = parseFloat(quote.total_inc_vat) || 0;

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
 */
export function generateInvoiceHTML(invoice: any, profile: any): string {
  const primaryColor = profile.primary_color || '#dc2626'; // red for invoices
  const templateFont = profile.template_font || 'Inter';

  const invoiceDate = invoice.invoice_date
    ? new Date(invoice.invoice_date).toLocaleDateString('en-GB')
    : 'N/A';
  const dueDate = invoice.due_date
    ? new Date(invoice.due_date).toLocaleDateString('en-GB')
    : 'N/A';

  const subtotal = parseFloat(invoice.subtotal_ex_vat) || 0;
  const vatAmount = parseFloat(invoice.vat_amount) || 0;
  const total = parseFloat(invoice.total_inc_vat) || 0;
  const amountPaid = parseFloat(invoice.amount_paid) || 0;
  const amountDue = parseFloat(invoice.amount_due ?? invoice.total_inc_vat) || 0;

  const lineItemsHTML = (invoice.items || []).map((item: any) => {
    const qty = parseFloat(item.quantity) || 0;
    const unitPrice = parseFloat(item.unit_price_ex_vat) || 0;
    const vatRate = parseFloat(item.vat_rate) ?? 0;
    const lineTotal = parseFloat(item.line_total_inc_vat) || 0;
    return `
      <tr>
        <td>
          <div><strong>${item.description || ''}</strong></div>
          ${item.item_type ? `<div class="item-type">${item.item_type}</div>` : ''}
        </td>
        <td class="text-right">${qty} ${item.unit || ''}</td>
        <td class="text-right">£${unitPrice.toFixed(2)}</td>
        <td class="text-right">${vatRate}%</td>
        <td class="text-right">£${lineTotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  const invoiceTypeLabel = (invoice.invoice_type || 'final').replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoice.invoice_number || ''}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ${templateFont}, -apple-system, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      padding: 20px;
    }
    .container { max-width: 850px; margin: 0 auto; }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
      padding-bottom: 15px;
      border-bottom: 2px solid ${primaryColor};
    }
    .company-name { font-size: 20px; font-weight: bold; color: ${primaryColor}; margin-bottom: 5px; }
    .company-info { text-align: right; font-size: 12px; color: #4b5563; }
    .document-title { font-size: 28px; font-weight: bold; color: ${primaryColor}; margin-bottom: 4px; }
    .document-subtitle { font-size: 13px; color: #6b7280; margin-bottom: 20px; }
    .details-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
    .detail-block h3 { font-size: 11px; text-transform: uppercase; color: #6b7280; margin-bottom: 5px; letter-spacing: 0.05em; }
    .detail-block p { font-size: 13px; margin-bottom: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead { background: ${primaryColor}; color: white; }
    th { padding: 10px; text-align: left; font-size: 12px; font-weight: 600; }
    td { padding: 9px 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px; vertical-align: top; }
    .item-type { color: #6b7280; font-size: 11px; text-transform: capitalize; margin-top: 2px; }
    .text-right { text-align: right; }
    .totals { margin-left: auto; width: 300px; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; }
    .totals table { margin-bottom: 0; }
    .totals td { border-bottom: 1px solid #f3f4f6; padding: 8px 12px; }
    .totals tr:last-child td { border-bottom: none; }
    .grand-total td { background: ${primaryColor}; color: white; font-size: 15px; font-weight: bold; }
    .amount-due td { background: #fef2f2; color: #b91c1c; font-weight: bold; font-size: 14px; }
    .payment-info { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; color: #166534; }
    .notes { margin-top: 20px; padding: 12px 16px; background: #f9fafb; border-left: 4px solid ${primaryColor}; font-size: 13px; }
    .notes h3 { font-size: 11px; text-transform: uppercase; color: #6b7280; margin-bottom: 6px; }
    .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #6b7280; white-space: pre-line; }
    .status-badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; background: #fef3c7; color: #92400e; }
    .status-badge.paid { background: #d1fae5; color: #065f46; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        ${profile.logo_url
          ? `<img src="${profile.logo_url}" alt="Logo" style="max-height:60px;">`
          : `<div class="company-name">${profile.trading_name || profile.name || 'Your Company'}</div>`}
      </div>
      <div class="company-info">
        <div style="font-weight:600;font-size:14px;margin-bottom:4px;">${profile.trading_name || profile.name || ''}</div>
        ${profile.address_line1 ? `<div>${profile.address_line1}</div>` : ''}
        ${profile.address_line2 ? `<div>${profile.address_line2}</div>` : ''}
        ${(profile.city || profile.postcode) ? `<div>${[profile.city, profile.postcode].filter(Boolean).join(', ')}</div>` : ''}
        ${profile.phone ? `<div>Tel: ${profile.phone}</div>` : ''}
        ${profile.email ? `<div>${profile.email}</div>` : ''}
        ${profile.vat_number ? `<div>VAT No: ${profile.vat_number}</div>` : ''}
      </div>
    </div>

    <div style="margin-bottom:24px;">
      <div class="document-title">INVOICE</div>
      <div class="document-subtitle">
        ${invoice.invoice_number || ''}
        &nbsp;·&nbsp; ${invoiceTypeLabel}
        &nbsp;·&nbsp; <span class="status-badge ${invoice.status === 'paid' ? 'paid' : ''}">${(invoice.status || '').toUpperCase()}</span>
      </div>
    </div>

    <div class="details-section">
      <div class="detail-block">
        <h3>Billed To</h3>
        <p><strong>${invoice.client_name || 'Client'}</strong></p>
        ${invoice.client_address ? `<p style="color:#6b7280;">${invoice.client_address}</p>` : ''}
        ${invoice.client_email ? `<p style="color:#6b7280;">${invoice.client_email}</p>` : ''}
        ${invoice.site_name ? `
        <div style="margin-top:10px;">
          <span style="font-size:11px;text-transform:uppercase;color:#6b7280;letter-spacing:0.05em;">Site</span>
          <p><strong>${invoice.site_name}</strong></p>
          ${invoice.site_address ? `<p style="color:#6b7280;">${invoice.site_address}</p>` : ''}
        </div>` : ''}
      </div>
      <div class="detail-block" style="text-align:right;">
        <h3>Invoice Details</h3>
        <p><strong>Invoice #:</strong> ${invoice.invoice_number || ''}</p>
        <p><strong>Invoice Date:</strong> ${invoiceDate}</p>
        <p><strong>Due Date:</strong> ${dueDate}</p>
        ${invoice.payment_terms_days ? `<p><strong>Payment Terms:</strong> ${invoice.payment_terms_days} days</p>` : ''}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="text-right">Qty</th>
          <th class="text-right">Unit Price</th>
          <th class="text-right">VAT</th>
          <th class="text-right">Total (inc VAT)</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemsHTML || '<tr><td colspan="5" style="text-align:center;color:#9ca3af;">No items</td></tr>'}
      </tbody>
    </table>

    <div class="totals">
      <table>
        <tr>
          <td>Subtotal (ex VAT)</td>
          <td class="text-right">£${subtotal.toFixed(2)}</td>
        </tr>
        <tr>
          <td>VAT</td>
          <td class="text-right">£${vatAmount.toFixed(2)}</td>
        </tr>
        <tr class="grand-total">
          <td>Total</td>
          <td class="text-right">£${total.toFixed(2)}</td>
        </tr>
        ${amountPaid > 0 ? `
        <tr>
          <td style="color:#166534;">Amount Paid</td>
          <td class="text-right" style="color:#166534;">−£${amountPaid.toFixed(2)}</td>
        </tr>
        <tr class="amount-due">
          <td>Amount Due</td>
          <td class="text-right">£${amountDue.toFixed(2)}</td>
        </tr>
        ` : ''}
      </table>
    </div>

    ${invoice.notes ? `
    <div class="notes">
      <h3>Notes</h3>
      <p>${invoice.notes}</p>
    </div>
    ` : ''}

    ${profile.footer_text ? `<div class="footer">${profile.footer_text}</div>` : ''}
  </div>
</body>
</html>`;
}
