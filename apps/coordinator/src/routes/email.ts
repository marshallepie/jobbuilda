import { FastifyInstance } from 'fastify';
import { sendEmail, generateQuoteEmail, generateQuoteEmailText, generateInvoiceEmail } from '../lib/email.js';
import { generatePDFFromHTML } from '../lib/pdf.js';
import { generateQuoteHTML, generateInvoiceHTML } from './pdf.js';

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
      const quoteWrapper = quoteResource.data as any;
      const quote = quoteWrapper.data || quoteWrapper;

      // Fetch client data to get email
      const clientResource = await fastify.mcp.clients.readResource(
        `res://clients/clients/${quote.client_id}`,
        context
      );
      const clientWrapper = clientResource.data as any;
      const client = clientWrapper.data || clientWrapper;

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
      const profileWrapper = profileResource.data as any;
      const profile = profileWrapper.data || profileWrapper;

      // Enrich quote with client name for the PDF template
      quote.client_name = client.name;

      // Fetch site details if available
      if (quote.site_id) {
        try {
          const siteResource = await fastify.mcp.clients.readResource(
            `res://clients/sites/${quote.site_id}`,
            context
          );
          const siteWrapper = siteResource.data as any;
          const site = siteWrapper.data || siteWrapper;
          quote.site_name = site.name;
          quote.site_address = [
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

      // Generate quote PDF using the same full template as the preview
      const quoteHTML = generateQuoteHTML(quote, profile);
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

      // Compute deposit amount and balance
      const rawDepositAmount = parseFloat(quote.deposit_amount) ||
        (quote.deposit_percent
          ? Math.round(parseFloat(quote.total_inc_vat) * parseFloat(quote.deposit_percent) / 100 * 100) / 100
          : parseFloat(quote.deposit_fixed_amount) || 0);
      const rawBalanceDue = parseFloat(quote.total_inc_vat) - rawDepositAmount;

      const gbpFormatter = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

      let payDepositUrl: string | undefined;
      let formattedDeposit: string | undefined;
      let formattedBalance: string | undefined;

      if (rawDepositAmount > 0) {
        const portalUrl = process.env.PORTAL_URL || 'http://localhost:3001';
        payDepositUrl = `${portalUrl}/payment/quote-deposit/${quoteId}`;
        formattedDeposit = gbpFormatter.format(rawDepositAmount);
        formattedBalance = gbpFormatter.format(rawBalanceDue);
      }

      // Generate email content
      const emailHTML = generateQuoteEmail({
        clientName: client.name,
        quoteNumber: quote.quote_number,
        quoteTitle: quote.title || '',
        companyName: profile.name || 'Your Company',
        total,
        validUntil,
        viewUrl: undefined, // TODO: Add client portal URL when available
        depositAmount: formattedDeposit,
        balanceDue: formattedBalance,
        payDepositUrl,
      });

      const emailText = generateQuoteEmailText({
        clientName: client.name,
        quoteNumber: quote.quote_number,
        companyName: profile.name || 'Your Company',
        total,
        validUntil,
      });

      // Build "from" display name from tenant profile so clients see the
      // company name in their inbox, not "JobBuilda"
      const quoteFromName = profile.trading_name || profile.name || 'Your Company';
      const defaultAddr = process.env.EMAIL_FROM_ADDRESS || 'noreply@jobbuilda.com';
      const addrMatch = defaultAddr.match(/<([^>]+)>/);
      const sendingEmail = addrMatch ? addrMatch[1] : defaultAddr;

      // Send email with PDF attachment
      const emailResult = await sendEmail({
        to: client.email,
        from: `${quoteFromName} <${sendingEmail}>`,
        subject: `Quote ${quote.quote_number} from ${quoteFromName}`,
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
      const invoiceWrapper = invoiceResource.data as any;
      const invoice = invoiceWrapper.data || invoiceWrapper;

      // Fetch client data
      const clientResource = await fastify.mcp.clients.readResource(
        `res://clients/clients/${invoice.client_id}`,
        context
      );
      const clientWrapper = clientResource.data as any;
      const client = clientWrapper.data || clientWrapper;

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
      const profileWrapper = profileResource.data as any;
      const profile = profileWrapper.data || profileWrapper;

      // Enrich invoice with client details for the PDF template
      invoice.client_name = client.name;
      invoice.client_email = client.email;
      invoice.client_phone = client.phone;
      invoice.client_address = [
        client.address_line1,
        client.address_line2,
        client.city,
        client.postcode,
      ].filter(Boolean).join(', ');

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

      // Generate invoice PDF using the same full template as the preview
      const invoiceHTML = generateInvoiceHTML(invoice, profile);
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
        bankName: profile.bank_name || undefined,
        accountName: profile.account_name || undefined,
        sortCode: profile.sort_code || undefined,
        accountNumber: profile.account_number || undefined,
        companyPhone: profile.phone || undefined,
        companyEmail: profile.email || undefined,
      });

      // Build "from" display name from tenant profile so clients see the
      // company name in their inbox, not "JobBuilda"
      const invoiceFromName = profile.trading_name || profile.name || 'Your Company';
      const invoiceDefaultAddr = process.env.EMAIL_FROM_ADDRESS || 'noreply@jobbuilda.com';
      const invoiceAddrMatch = invoiceDefaultAddr.match(/<([^>]+)>/);
      const invoiceSendingEmail = invoiceAddrMatch ? invoiceAddrMatch[1] : invoiceDefaultAddr;

      // Send email with PDF attachment
      const emailResult = await sendEmail({
        to: client.email,
        from: `${invoiceFromName} <${invoiceSendingEmail}>`,
        subject: `Invoice ${invoice.invoice_number} from ${invoiceFromName}`,
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

      // Only advance status to "sent" if the invoice is still a draft
      if (invoice.status === 'draft') {
        await fastify.mcp.invoicing.callTool(
          'update_invoice',
          {
            invoice_id: invoiceId,
            status: 'sent',
          },
          context
        );
      }

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

