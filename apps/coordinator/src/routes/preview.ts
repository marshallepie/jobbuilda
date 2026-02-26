import { FastifyInstance } from 'fastify';

export async function previewRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/preview/invoice
   * Generate a preview of an invoice with current template settings
   * Optional query param: ?tenant_id=xxx (defaults to first tenant if not provided)
   */
  fastify.get('/api/preview/invoice', async (request, reply) => {
    try {
      // Try to get tenant_id from query param, header, or use default
      const queryParams = request.query as { tenant_id?: string };
      const tenantId = queryParams.tenant_id ||
                       (request.headers['x-tenant-id'] as string) ||
                       '550e8400-e29b-41d4-a716-446655440000'; // Default test tenant

      // Create minimal auth context for preview
      const context = {
        tenant_id: tenantId,
        user_id: 'preview-user',
        scopes: [],
        x_request_id: 'preview-request'
      };

      // Fetch business profile with template settings
      const profile = await fastify.mcp.identity.readResource(
        `res://identity/tenants/${context.tenant_id}`,
        context
      );

      const p = profile.data;

      // Generate sample invoice HTML
      const html = generateInvoicePreview(p);

      reply.type('text/html').send(html);
    } catch (error: any) {
      reply.status(500).send({
        error: 'Failed to generate invoice preview',
        message: error.message
      });
    }
  });

  /**
   * GET /api/preview/quote
   * Generate a preview of a quote.
   * If ?quote_id=xxx is provided, renders the actual quote with real data.
   * Otherwise renders a sample template preview.
   */
  fastify.get('/api/preview/quote', async (request, reply) => {
    try {
      const queryParams = request.query as { tenant_id?: string; quote_id?: string };
      const tenantId = queryParams.tenant_id ||
                       (request.headers['x-tenant-id'] as string) ||
                       '550e8400-e29b-41d4-a716-446655440000';

      const context = {
        tenant_id: tenantId,
        user_id: 'preview-user',
        scopes: [],
        x_request_id: 'preview-request'
      };

      const profileResource = await fastify.mcp.identity.readResource(
        `res://identity/tenants/${context.tenant_id}`,
        context
      );
      const profile = profileResource.data;

      if (queryParams.quote_id) {
        // Real quote preview
        const quoteResource = await fastify.mcp.quoting.readResource(
          `res://quoting/quotes/${queryParams.quote_id}`,
          context
        );
        const html = generateRealQuotePreview(quoteResource.data, profile);
        return reply.type('text/html').send(html);
      }

      // Sample template preview (used from Settings page)
      const html = generateQuotePreview(profile);
      reply.type('text/html').send(html);
    } catch (error: any) {
      reply.status(500).send({
        error: 'Failed to generate quote preview',
        message: error.message
      });
    }
  });
}

function generateRealQuotePreview(quote: any, profile: any): string {
  const templateFont = profile.template_font || 'Inter';
  const primaryColor = profile.primary_color || '#3B82F6';
  const showItemDescriptions = profile.show_item_descriptions !== false;

  const quoteDate = quote.created_at ? new Date(quote.created_at).toLocaleDateString('en-GB') : '';
  const validUntil = quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('en-GB') : '';

  const lineItemsHTML = (quote.items || []).map((item: any) => {
    const qty = item.quantity || 1;
    const rate = item.unit_price_ex_vat || 0;
    const markup = item.markup_percent || 0;
    const lineTotal = item.line_total_inc_vat || (qty * rate * (1 + markup / 100));
    return `
      <tr>
        <td>
          <div><strong>${item.description || ''}</strong></div>
          ${showItemDescriptions && item.notes ? `<div style="color:#6b7280;font-size:12px;margin-top:3px;">${item.notes}</div>` : ''}
        </td>
        <td style="text-align:right;">${qty} ${item.unit || ''}</td>
        <td style="text-align:right;">£${Number(rate).toFixed(2)}</td>
        <td style="text-align:right;">£${Number(lineTotal).toFixed(2)}</td>
      </tr>`;
  }).join('');

  const subtotal = Number(quote.subtotal_ex_vat || 0);
  const vatAmount = Number(quote.vat_amount || 0);
  const total = Number(quote.total_inc_vat || 0);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quote ${quote.quote_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: ${templateFont}, -apple-system, sans-serif; line-height: 1.6; color: #1f2937; background: #f3f4f6; padding: 20px; }
    .container { max-width: 850px; margin: 0 auto; background: white; box-shadow: 0 4px 6px rgba(0,0,0,.1); padding: 60px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid ${primaryColor}; }
    .company-name { font-size: 24px; font-weight: bold; color: ${primaryColor}; margin-bottom: 8px; }
    .company-info { text-align: right; font-size: 14px; }
    .document-title { font-size: 32px; font-weight: bold; color: ${primaryColor}; margin-bottom: 30px; }
    .details-section { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
    .detail-block h3 { font-size: 12px; text-transform: uppercase; color: #6b7280; margin-bottom: 8px; }
    .detail-block p { font-size: 14px; margin-bottom: 4px; }
    .validity-notice { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin-bottom: 30px; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    thead { background: ${primaryColor}; color: white; }
    th { padding: 12px; text-align: left; font-size: 13px; font-weight: 600; }
    td { padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
    .totals { margin-left: auto; width: 320px; }
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
    .total-row.subtotal { border-top: 1px solid #e5e7eb; }
    .total-row.grand-total { border-top: 2px solid ${primaryColor}; font-size: 18px; font-weight: bold; color: ${primaryColor}; padding-top: 12px; margin-top: 8px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #6b7280; white-space: pre-line; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        ${profile.logo_url ? `<img src="${profile.logo_url}" alt="Logo" style="max-height:80px;max-width:300px;" onerror="this.style.display='none'">` : `<div class="company-name">${profile.name || 'Your Company'}</div>`}
      </div>
      <div class="company-info">
        <div style="font-weight:600;margin-bottom:8px;">${profile.trading_name || profile.name || 'Your Company'}</div>
        ${profile.address_line1 ? `<div>${profile.address_line1}</div>` : ''}
        ${profile.address_line2 ? `<div>${profile.address_line2}</div>` : ''}
        ${profile.city || profile.postcode ? `<div>${[profile.city, profile.postcode].filter(Boolean).join(', ')}</div>` : ''}
        ${profile.phone ? `<div>Tel: ${profile.phone}</div>` : ''}
        ${profile.email ? `<div>${profile.email}</div>` : ''}
        ${profile.vat_number ? `<div>VAT: ${profile.vat_number}</div>` : ''}
      </div>
    </div>

    <h1 class="document-title">QUOTATION</h1>

    <div class="details-section">
      <div class="detail-block">
        <h3>Prepared For</h3>
        <p><strong>${quote.client_name || ''}</strong></p>
        ${quote.site_name ? `<p>${quote.site_name}</p>` : ''}
        ${quote.site_address ? `<p>${quote.site_address}</p>` : ''}
      </div>
      <div class="detail-block">
        <h3>Quote Details</h3>
        <p><strong>Quote #:</strong> ${quote.quote_number || ''}</p>
        <p><strong>Title:</strong> ${quote.title || ''}</p>
        ${quoteDate ? `<p><strong>Date:</strong> ${quoteDate}</p>` : ''}
        ${validUntil ? `<p><strong>Valid Until:</strong> ${validUntil}</p>` : ''}
      </div>
    </div>

    ${validUntil ? `<div class="validity-notice"><strong>⏱ Valid until ${validUntil}</strong></div>` : ''}

    ${quote.description ? `<p style="margin-bottom:24px;font-size:14px;color:#374151;">${quote.description}</p>` : ''}

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align:right;">Qty</th>
          <th style="text-align:right;">Rate</th>
          <th style="text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>${lineItemsHTML}</tbody>
    </table>

    <div class="totals">
      <div class="total-row subtotal">
        <span>Subtotal (ex VAT):</span>
        <span>£${subtotal.toFixed(2)}</span>
      </div>
      <div class="total-row">
        <span>VAT:</span>
        <span>£${vatAmount.toFixed(2)}</span>
      </div>
      <div class="total-row grand-total">
        <span>Total:</span>
        <span>£${total.toFixed(2)}</span>
      </div>
    </div>

    ${quote.terms ? `<div style="margin-top:30px;padding:16px;background:#f9fafb;border-radius:6px;font-size:13px;"><strong>Terms &amp; Conditions</strong><div style="margin-top:8px;white-space:pre-wrap;">${quote.terms}</div></div>` : ''}

    ${profile.footer_text ? `<div class="footer">${profile.footer_text}</div>` : ''}
  </div>
</body>
</html>`;
}

function generateInvoicePreview(profile: any): string {
  const templateFont = profile.template_font || 'Inter';
  const primaryColor = profile.primary_color || '#3B82F6';
  const showItemCodes = profile.show_item_codes !== false;
  const showItemDescriptions = profile.show_item_descriptions !== false;
  const showPaymentQR = profile.show_payment_qr || false;

  // Sample invoice data
  const invoiceNumber = `${profile.invoice_prefix || 'INV'}1234`;
  const invoiceDate = new Date().toLocaleDateString('en-GB');
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice Preview - ${invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ${templateFont}, -apple-system, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background: #f3f4f6;
      padding: 20px;
    }
    .preview-container {
      max-width: 850px;
      margin: 0 auto;
      background: white;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      padding: 60px;
    }
    ${profile.header_image_url ? `
    .header-banner {
      width: 100%;
      max-height: 150px;
      object-fit: cover;
      margin-bottom: 30px;
    }` : ''}
    .header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid ${primaryColor};
    }
    .logo {
      max-height: 80px;
      max-width: 300px;
    }
    .company-info {
      text-align: right;
      font-size: 14px;
    }
    .company-name {
      font-size: 24px;
      font-weight: bold;
      color: ${primaryColor};
      margin-bottom: 8px;
    }
    .document-title {
      font-size: 32px;
      font-weight: bold;
      color: ${primaryColor};
      margin-bottom: 30px;
    }
    .details-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-bottom: 40px;
    }
    .detail-block h3 {
      font-size: 12px;
      text-transform: uppercase;
      color: #6b7280;
      margin-bottom: 8px;
    }
    .detail-block p {
      font-size: 14px;
      margin-bottom: 4px;
    }
    .invoice-meta {
      background: #f9fafb;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 30px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
    }
    .meta-item {
      font-size: 14px;
    }
    .meta-label {
      color: #6b7280;
      font-size: 12px;
      text-transform: uppercase;
    }
    .meta-value {
      font-weight: 600;
      color: #1f2937;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    thead {
      background: ${primaryColor};
      color: white;
    }
    th {
      padding: 12px;
      text-align: left;
      font-size: 13px;
      font-weight: 600;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 14px;
    }
    .item-code {
      color: #6b7280;
      font-size: 12px;
    }
    .item-description {
      color: #6b7280;
      font-size: 13px;
      margin-top: 4px;
    }
    .text-right { text-align: right; }
    .totals {
      margin-left: auto;
      width: 350px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 14px;
    }
    .total-row.subtotal {
      border-top: 1px solid #e5e7eb;
    }
    .total-row.grand-total {
      border-top: 2px solid ${primaryColor};
      font-size: 18px;
      font-weight: bold;
      color: ${primaryColor};
      padding-top: 12px;
      margin-top: 8px;
    }
    .payment-section {
      margin-top: 40px;
      padding-top: 30px;
      border-top: 1px solid #e5e7eb;
      ${showPaymentQR ? 'display: grid; grid-template-columns: 1fr auto; gap: 30px;' : ''}
    }
    .payment-info h3 {
      font-size: 16px;
      margin-bottom: 12px;
      color: ${primaryColor};
    }
    .payment-info p {
      font-size: 14px;
      margin-bottom: 6px;
    }
    .qr-code {
      text-align: center;
      padding: 15px;
      background: #f9fafb;
      border-radius: 8px;
    }
    .qr-placeholder {
      width: 150px;
      height: 150px;
      background: white;
      border: 2px dashed #d1d5db;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6b7280;
      font-size: 12px;
      margin-bottom: 8px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
    }
    .footer-text {
      white-space: pre-line;
      line-height: 1.8;
    }
  </style>
</head>
<body>
  <div class="preview-container">
    ${profile.header_image_url ? `<img src="${profile.header_image_url}" alt="Header" class="header-banner" onerror="this.style.display='none'">` : ''}

    <div class="header">
      <div>
        ${profile.logo_url ? `<img src="${profile.logo_url}" alt="Company Logo" class="logo" onerror="this.style.display='none'">` : `<div class="company-name">${profile.name || 'Your Company Name'}</div>`}
      </div>
      <div class="company-info">
        <div style="font-weight: 600; margin-bottom: 8px;">${profile.trading_name || profile.name || 'Your Company'}</div>
        ${profile.address_line1 ? `<div>${profile.address_line1}</div>` : ''}
        ${profile.address_line2 ? `<div>${profile.address_line2}</div>` : ''}
        ${profile.city || profile.postcode ? `<div>${profile.city || ''}${profile.city && profile.postcode ? ', ' : ''}${profile.postcode || ''}</div>` : ''}
        ${profile.phone ? `<div>Tel: ${profile.phone}</div>` : ''}
        ${profile.email ? `<div>${profile.email}</div>` : ''}
        ${profile.company_number ? `<div>Co. No: ${profile.company_number}</div>` : ''}
        ${profile.vat_number ? `<div>VAT: ${profile.vat_number}</div>` : ''}
      </div>
    </div>

    <h1 class="document-title">INVOICE</h1>

    <div class="details-section">
      <div class="detail-block">
        <h3>Bill To</h3>
        <p><strong>Sample Client Ltd</strong></p>
        <p>123 Client Street</p>
        <p>London, SW1A 1AA</p>
        <p>client@example.com</p>
      </div>
      <div class="detail-block">
        <h3>Invoice Details</h3>
        <p><strong>Invoice #:</strong> ${invoiceNumber}</p>
        <p><strong>Date:</strong> ${invoiceDate}</p>
        <p><strong>Due Date:</strong> ${dueDate}</p>
      </div>
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
        <tr>
          <td>
            <div><strong>Electrical Installation Work</strong></div>
            ${showItemCodes ? '<div class="item-code">SKU: EIW-001</div>' : ''}
            ${showItemDescriptions ? '<div class="item-description">Full rewire of property including consumer unit upgrade</div>' : ''}
          </td>
          <td class="text-right">1</td>
          <td class="text-right">£2,500.00</td>
          <td class="text-right">£2,500.00</td>
        </tr>
        <tr>
          <td>
            <div><strong>Consumer Unit - 18 Way</strong></div>
            ${showItemCodes ? '<div class="item-code">SKU: CU-18W-001</div>' : ''}
            ${showItemDescriptions ? '<div class="item-description">Hager 18-way consumer unit with RCBO protection</div>' : ''}
          </td>
          <td class="text-right">1</td>
          <td class="text-right">£450.00</td>
          <td class="text-right">£450.00</td>
        </tr>
        <tr>
          <td>
            <div><strong>Labour - Installation</strong></div>
            ${showItemCodes ? '<div class="item-code">SKU: LAB-INST</div>' : ''}
            ${showItemDescriptions ? '<div class="item-description">On-site installation and testing (16 hours @ £50/hr)</div>' : ''}
          </td>
          <td class="text-right">16</td>
          <td class="text-right">£50.00</td>
          <td class="text-right">£800.00</td>
        </tr>
      </tbody>
    </table>

    <div class="totals">
      <div class="total-row subtotal">
        <span>Subtotal:</span>
        <span>£3,750.00</span>
      </div>
      <div class="total-row">
        <span>VAT (${profile.default_vat_rate || 20}%):</span>
        <span>£${(3750 * ((profile.default_vat_rate || 20) / 100)).toFixed(2)}</span>
      </div>
      <div class="total-row grand-total">
        <span>Total Due:</span>
        <span>£${(3750 * (1 + (profile.default_vat_rate || 20) / 100)).toFixed(2)}</span>
      </div>
    </div>

    <div class="payment-section">
      <div class="payment-info">
        <h3>Payment Information</h3>
        ${profile.bank_name ? `<p><strong>Bank:</strong> ${profile.bank_name}</p>` : ''}
        ${profile.account_name ? `<p><strong>Account Name:</strong> ${profile.account_name}</p>` : ''}
        ${profile.sort_code ? `<p><strong>Sort Code:</strong> ${profile.sort_code}</p>` : ''}
        ${profile.account_number ? `<p><strong>Account Number:</strong> ${profile.account_number}</p>` : ''}
        ${profile.payment_terms ? `<p style="margin-top: 12px; font-style: italic;">${profile.payment_terms}</p>` : ''}
      </div>
      ${showPaymentQR ? `
      <div class="qr-code">
        <div class="qr-placeholder">QR Code<br>for Payment</div>
        <div style="font-size: 11px; color: #6b7280;">Scan to pay</div>
      </div>
      ` : ''}
    </div>

    ${profile.footer_text ? `
    <div class="footer">
      <div class="footer-text">${profile.footer_text}</div>
    </div>
    ` : ''}
  </div>
</body>
</html>`;
}

function generateQuotePreview(profile: any): string {
  const templateFont = profile.template_font || 'Inter';
  const primaryColor = profile.primary_color || '#3B82F6';
  const showItemCodes = profile.show_item_codes !== false;
  const showItemDescriptions = profile.show_item_descriptions !== false;

  // Sample quote data
  const quoteNumber = `${profile.quote_prefix || 'QUO'}1234`;
  const quoteDate = new Date().toLocaleDateString('en-GB');
  const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quote Preview - ${quoteNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ${templateFont}, -apple-system, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background: #f3f4f6;
      padding: 20px;
    }
    .preview-container {
      max-width: 850px;
      margin: 0 auto;
      background: white;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      padding: 60px;
    }
    ${profile.header_image_url ? `
    .header-banner {
      width: 100%;
      max-height: 150px;
      object-fit: cover;
      margin-bottom: 30px;
    }` : ''}
    .header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid ${primaryColor};
    }
    .logo {
      max-height: 80px;
      max-width: 300px;
    }
    .company-info {
      text-align: right;
      font-size: 14px;
    }
    .company-name {
      font-size: 24px;
      font-weight: bold;
      color: ${primaryColor};
      margin-bottom: 8px;
    }
    .document-title {
      font-size: 32px;
      font-weight: bold;
      color: ${primaryColor};
      margin-bottom: 30px;
    }
    .details-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-bottom: 40px;
    }
    .detail-block h3 {
      font-size: 12px;
      text-transform: uppercase;
      color: #6b7280;
      margin-bottom: 8px;
    }
    .detail-block p {
      font-size: 14px;
      margin-bottom: 4px;
    }
    .validity-notice {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 12px 16px;
      margin-bottom: 30px;
      font-size: 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    thead {
      background: ${primaryColor};
      color: white;
    }
    th {
      padding: 12px;
      text-align: left;
      font-size: 13px;
      font-weight: 600;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 14px;
    }
    .item-code {
      color: #6b7280;
      font-size: 12px;
    }
    .item-description {
      color: #6b7280;
      font-size: 13px;
      margin-top: 4px;
    }
    .text-right { text-align: right; }
    .totals {
      margin-left: auto;
      width: 350px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 14px;
    }
    .total-row.subtotal {
      border-top: 1px solid #e5e7eb;
    }
    .total-row.grand-total {
      border-top: 2px solid ${primaryColor};
      font-size: 18px;
      font-weight: bold;
      color: ${primaryColor};
      padding-top: 12px;
      margin-top: 8px;
    }
    .acceptance {
      margin-top: 40px;
      padding: 20px;
      background: #f9fafb;
      border-radius: 8px;
    }
    .acceptance h3 {
      font-size: 16px;
      margin-bottom: 15px;
      color: ${primaryColor};
    }
    .signature-line {
      margin-top: 30px;
      padding-top: 10px;
      border-top: 2px solid #1f2937;
      width: 300px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
    }
    .footer-text {
      white-space: pre-line;
      line-height: 1.8;
    }
  </style>
</head>
<body>
  <div class="preview-container">
    ${profile.header_image_url ? `<img src="${profile.header_image_url}" alt="Header" class="header-banner" onerror="this.style.display='none'">` : ''}

    <div class="header">
      <div>
        ${profile.logo_url ? `<img src="${profile.logo_url}" alt="Company Logo" class="logo" onerror="this.style.display='none'">` : `<div class="company-name">${profile.name || 'Your Company Name'}</div>`}
      </div>
      <div class="company-info">
        <div style="font-weight: 600; margin-bottom: 8px;">${profile.trading_name || profile.name || 'Your Company'}</div>
        ${profile.address_line1 ? `<div>${profile.address_line1}</div>` : ''}
        ${profile.address_line2 ? `<div>${profile.address_line2}</div>` : ''}
        ${profile.city || profile.postcode ? `<div>${profile.city || ''}${profile.city && profile.postcode ? ', ' : ''}${profile.postcode || ''}</div>` : ''}
        ${profile.phone ? `<div>Tel: ${profile.phone}</div>` : ''}
        ${profile.email ? `<div>${profile.email}</div>` : ''}
        ${profile.company_number ? `<div>Co. No: ${profile.company_number}</div>` : ''}
        ${profile.vat_number ? `<div>VAT: ${profile.vat_number}</div>` : ''}
      </div>
    </div>

    <h1 class="document-title">QUOTATION</h1>

    <div class="details-section">
      <div class="detail-block">
        <h3>Prepared For</h3>
        <p><strong>Sample Client Ltd</strong></p>
        <p>123 Client Street</p>
        <p>London, SW1A 1AA</p>
        <p>client@example.com</p>
      </div>
      <div class="detail-block">
        <h3>Quote Details</h3>
        <p><strong>Quote #:</strong> ${quoteNumber}</p>
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
        <tr>
          <td>
            <div><strong>Electrical Installation Work</strong></div>
            ${showItemCodes ? '<div class="item-code">SKU: EIW-001</div>' : ''}
            ${showItemDescriptions ? '<div class="item-description">Full rewire of property including consumer unit upgrade</div>' : ''}
          </td>
          <td class="text-right">1</td>
          <td class="text-right">£2,500.00</td>
          <td class="text-right">£2,500.00</td>
        </tr>
        <tr>
          <td>
            <div><strong>Consumer Unit - 18 Way</strong></div>
            ${showItemCodes ? '<div class="item-code">SKU: CU-18W-001</div>' : ''}
            ${showItemDescriptions ? '<div class="item-description">Hager 18-way consumer unit with RCBO protection</div>' : ''}
          </td>
          <td class="text-right">1</td>
          <td class="text-right">£450.00</td>
          <td class="text-right">£450.00</td>
        </tr>
        <tr>
          <td>
            <div><strong>Labour - Installation</strong></div>
            ${showItemCodes ? '<div class="item-code">SKU: LAB-INST</div>' : ''}
            ${showItemDescriptions ? '<div class="item-description">On-site installation and testing (16 hours @ £50/hr)</div>' : ''}
          </td>
          <td class="text-right">16</td>
          <td class="text-right">£50.00</td>
          <td class="text-right">£800.00</td>
        </tr>
      </tbody>
    </table>

    <div class="totals">
      <div class="total-row subtotal">
        <span>Subtotal:</span>
        <span>£3,750.00</span>
      </div>
      <div class="total-row">
        <span>VAT (${profile.default_vat_rate || 20}%):</span>
        <span>£${(3750 * ((profile.default_vat_rate || 20) / 100)).toFixed(2)}</span>
      </div>
      <div class="total-row grand-total">
        <span>Total:</span>
        <span>£${(3750 * (1 + (profile.default_vat_rate || 20) / 100)).toFixed(2)}</span>
      </div>
    </div>

    <div class="acceptance">
      <h3>Acceptance</h3>
      <p style="margin-bottom: 15px;">By signing below, you agree to the terms and pricing outlined in this quotation.</p>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 30px;">
        <div>
          <div class="signature-line"></div>
          <p style="margin-top: 8px; font-size: 12px; color: #6b7280;">Client Signature</p>
        </div>
        <div>
          <div class="signature-line"></div>
          <p style="margin-top: 8px; font-size: 12px; color: #6b7280;">Date</p>
        </div>
      </div>
    </div>

    ${profile.footer_text ? `
    <div class="footer">
      <div class="footer-text">${profile.footer_text}</div>
    </div>
    ` : ''}
  </div>
</body>
</html>`;
}
