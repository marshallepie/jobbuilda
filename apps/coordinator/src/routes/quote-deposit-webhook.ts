import { FastifyInstance } from 'fastify';
import { Readable } from 'stream';
import { stripe } from '../lib/stripe.js';
import { sendEmail, generateDepositReceivedEmail, generateDepositReceiptEmail } from '../lib/email.js';

/**
 * Quote deposit webhook route.
 *
 * Uses a preParsing hook to capture the raw bytes before the JSON parser
 * consumes them, so we can verify the Stripe signature on the raw body.
 * The same pattern as subscription-webhook.ts.
 */
export async function quoteDepositWebhookRoutes(fastify: FastifyInstance) {
  // Capture raw body bytes before the JSON parser reads the stream
  fastify.addHook('preParsing', async (request, _reply, payload) => {
    const chunks: Buffer[] = [];
    for await (const chunk of payload) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
    }
    const raw = Buffer.concat(chunks);
    (request as any).rawBody = raw;
    // Return a new Readable so the JSON parser still works
    return Readable.from(raw);
  });

  fastify.post('/api/payments/quote-deposit/webhook', async (request, reply) => {
    const sig = request.headers['stripe-signature'] as string;
    const rawBody = (request as any).rawBody as Buffer;

    if (!sig) {
      return reply.status(400).send({ error: 'Missing stripe-signature header' });
    }
    if (!rawBody) {
      return reply.status(400).send({ error: 'Missing raw body' });
    }

    // With Stripe Connect, events from connected accounts include a 'stripe-account' header
    // identifying which tenant's account triggered the event. The primary routing key is
    // session.metadata.tenant_id (set when the checkout session was created), so no
    // special branching is needed — we log it for observability only.
    const connectAccountId = request.headers['stripe-account'] as string | undefined;

    let event: any;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        sig,
        process.env.STRIPE_QUOTE_WEBHOOK_SECRET!
      );
    } catch (err: any) {
      fastify.log.warn({ err }, 'Quote deposit webhook signature verification failed');
      return reply.status(400).send({ error: `Webhook Error: ${err.message}` });
    }

    if (connectAccountId) {
      fastify.log.debug({ connectAccountId, eventType: event.type }, 'Received Stripe Connect event');
    }

    try {
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        // Only handle quote deposit payments
        if (session.metadata?.payment_type !== 'quote_deposit') {
          fastify.log.debug({ sessionId: session.id }, 'Ignoring non-quote-deposit checkout session');
          return { received: true };
        }

        const quoteId: string = session.metadata.quote_id;
        const tenantId: string = session.metadata.tenant_id;

        if (!quoteId || !tenantId) {
          fastify.log.warn({ sessionId: session.id }, 'Missing quote_id or tenant_id in session metadata');
          return { received: true };
        }

        const context = {
          tenant_id: tenantId,
          user_id: 'system',
          scopes: [] as string[],
          x_request_id: 'webhook',
        };

        // Fetch the quote
        let quote: any;
        try {
          const quoteResource = await fastify.mcp.quoting.readResource(
            `res://quoting/quotes/${quoteId}`,
            context
          );
          const quoteWrapper = quoteResource.data as any;
          quote = quoteWrapper.data || quoteWrapper;
        } catch (err: any) {
          fastify.log.error({ err, quoteId }, 'Failed to fetch quote in deposit webhook');
          return { received: true };
        }

        // Idempotency check — if job already created, skip
        if (quote.job_id) {
          fastify.log.info({ quoteId, jobId: quote.job_id }, 'Job already created for quote deposit — skipping');
          return { received: true };
        }

        // Create job from quote
        let job: any;
        try {
          const jobResult = await fastify.mcp.jobs.callTool(
            'create_job_from_quote',
            {
              quote_id: quoteId,
              client_id: quote.client_id,
              site_id: quote.site_id,
              title: quote.title,
              description: quote.description,
              quote_items: (quote.items || []).map((item: any) => ({
                quote_item_id: item.id,
                item_type: item.item_type,
                description: item.description,
                quantity_planned: item.quantity,
                unit: item.unit,
              })),
            },
            context
          );
          job = JSON.parse(jobResult.content[0]?.text || '{}');
        } catch (err: any) {
          fastify.log.error({ err, quoteId }, 'Failed to create job from quote in deposit webhook');
          return { received: true };
        }

        // Update quote status to approved and link the job
        try {
          await fastify.mcp.quoting.callTool(
            'update_quote',
            {
              quote_id: quoteId,
              status: 'approved',
              job_id: job.job_id,
            },
            context
          );
        } catch (err: any) {
          fastify.log.error({ err, quoteId }, 'Failed to update quote status after deposit');
        }

        // Fetch client details
        let client: any = {};
        try {
          const clientResource = await fastify.mcp.clients.readResource(
            `res://clients/clients/${quote.client_id}`,
            context
          );
          const clientWrapper = clientResource.data as any;
          client = clientWrapper.data || clientWrapper;
        } catch (err: any) {
          fastify.log.warn({ err, clientId: quote.client_id }, 'Failed to fetch client in deposit webhook');
        }

        // Fetch tenant profile
        let profile: any = {};
        try {
          const profileResource = await fastify.mcp.identity.readResource(
            `res://identity/tenants/${tenantId}`,
            context
          );
          const profileWrapper = profileResource.data as any;
          profile = profileWrapper.data || profileWrapper;
        } catch (err: any) {
          fastify.log.warn({ err, tenantId }, 'Failed to fetch tenant profile in deposit webhook');
        }

        const currencyFormatter = new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency: 'GBP',
        });

        const depositAmount = parseFloat(quote.deposit_amount) ||
          (quote.deposit_percent
            ? Math.round(parseFloat(quote.total_inc_vat) * parseFloat(quote.deposit_percent) / 100 * 100) / 100
            : parseFloat(quote.deposit_fixed_amount) || 0);
        const balanceDue = parseFloat(quote.total_inc_vat) - depositAmount;

        const formattedDeposit = currencyFormatter.format(depositAmount);
        const formattedBalance = currencyFormatter.format(balanceDue);

        const adminUrl = process.env.ADMIN_URL || 'http://localhost:3002';

        // Send notification email to tenant
        if (profile.email) {
          try {
            const tenantEmailHTML = generateDepositReceivedEmail({
              clientName: client.name || 'Client',
              quoteNumber: quote.quote_number,
              jobNumber: job.job_number,
              depositAmount: formattedDeposit,
              balanceDue: formattedBalance,
              companyName: profile.name || 'Your Company',
              dashboardUrl: `${adminUrl}/jobs/${job.job_id}`,
            });

            await sendEmail({
              to: profile.email,
              subject: `Deposit received — ${client.name || 'Client'} — Quote ${quote.quote_number}`,
              html: tenantEmailHTML,
            });
          } catch (err: any) {
            fastify.log.warn({ err }, 'Failed to send deposit notification email to tenant');
          }
        }

        // Send receipt email to client
        if (client.email) {
          try {
            const clientEmailHTML = generateDepositReceiptEmail({
              clientName: client.name || 'Client',
              quoteNumber: quote.quote_number,
              quoteTitle: quote.title,
              depositAmount: formattedDeposit,
              balanceDue: formattedBalance,
              companyName: profile.name || 'Your Company',
              companyPhone: profile.phone,
              companyEmail: profile.email,
            });

            await sendEmail({
              to: client.email,
              subject: `Deposit receipt — ${quote.quote_number} — ${profile.name || 'Your Company'}`,
              html: clientEmailHTML,
            });
          } catch (err: any) {
            fastify.log.warn({ err }, 'Failed to send deposit receipt email to client');
          }
        }

        fastify.log.info(
          { quoteId, jobId: job.job_id, depositAmount },
          'Quote deposit processed — job created'
        );
      } else {
        fastify.log.debug({ type: event.type }, 'Unhandled event type in quote deposit webhook');
      }
    } catch (err: any) {
      fastify.log.error({ err, event: event.type }, 'Failed to process quote deposit webhook event');
      // Always return 200 to Stripe even on errors
    }

    return { received: true };
  });
}
