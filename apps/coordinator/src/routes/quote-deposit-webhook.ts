import { FastifyInstance } from 'fastify';
import { Readable } from 'stream';
import { stripe } from '../lib/stripe.js';

/**
 * Quote deposit webhook route.
 *
 * Quote resources can only be read through tenant-scoped MCP resources. There
 * is no server-owned lookup from a Stripe Checkout event (or Connect account)
 * to an exact quote tenant, so this route deliberately acknowledges events
 * without effects until such a mapping exists. Stripe metadata is never tenant
 * authority.
 */
export async function quoteDepositWebhookRoutes(fastify: FastifyInstance) {
  fastify.addHook('preParsing', async (request, _reply, payload) => {
    const chunks: Buffer[] = [];
    for await (const chunk of payload) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
    }
    const raw = Buffer.concat(chunks);
    (request as any).rawBody = raw;
    return Readable.from(raw);
  });

  fastify.post('/api/payments/quote-deposit/webhook', async (request, reply) => {
    const sig = request.headers['stripe-signature'] as string;
    const rawBody = (request as any).rawBody as Buffer;

    if (!sig) return reply.status(400).send({ error: 'Missing stripe-signature header' });
    if (!rawBody) return reply.status(400).send({ error: 'Missing raw body' });

    let event: any;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        sig,
        process.env.STRIPE_QUOTE_WEBHOOK_SECRET!,
      );
    } catch (err: any) {
      fastify.log.warn({ err }, 'Quote deposit webhook signature verification failed');
      return reply.status(400).send({ error: `Webhook Error: ${err.message}` });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      fastify.log.warn(
        { sessionId: session.id, connectAccountId: request.headers['stripe-account'] },
        'Ignoring quote deposit checkout: no trusted quote-to-tenant resolver is available',
      );
    } else {
      fastify.log.debug({ type: event.type }, 'Unhandled event type in quote deposit webhook');
    }

    // A signed Stripe event remains safely acknowledged; no metadata-derived
    // tenant context can reach MCP mutations or email delivery.
    return { received: true };
  });
}
