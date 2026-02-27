import { FastifyInstance } from 'fastify';
import { Readable } from 'stream';
import { stripe } from '../lib/stripe.js';
import { getPool } from '../lib/db.js';

/**
 * Stripe webhook route.
 *
 * Fastify v5 no longer scopes addContentTypeParser per plugin, so we cannot
 * override the JSON parser here without breaking every other route. Instead we
 * use a preParsing hook to capture the exact raw bytes into request.rawBody
 * before the JSON parser consumes them, then re-emit those same bytes so the
 * JSON parser still runs normally. The webhook handler reads request.rawBody
 * for Stripe signature verification.
 */
export async function subscriptionWebhookRoutes(fastify: FastifyInstance) {
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

  fastify.post('/api/subscription/webhook', async (request, reply) => {
    const sig = request.headers['stripe-signature'] as string;
    const rawBody = (request as any).rawBody as Buffer;

    if (!sig) {
      return reply.status(400).send({ error: 'Missing stripe-signature header' });
    }
    if (!rawBody) {
      return reply.status(400).send({ error: 'Missing raw body' });
    }

    let event: any;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch (err: any) {
      fastify.log.warn({ err }, 'Stripe webhook signature verification failed');
      return reply.status(400).send({ error: `Webhook Error: ${err.message}` });
    }

    const pool = getPool();

    try {
      switch (event.type) {
        case 'customer.subscription.updated': {
          const sub = event.data.object;
          const tenantId = sub.metadata?.tenant_id;
          if (!tenantId) break;
          const seats = sub.items?.data?.reduce(
            (sum: number, item: any) => sum + (item.quantity || 1), 0
          ) || 1;
          await pool.query(
            `UPDATE tenants
             SET subscription_status = $1, stripe_subscription_id = $2, seats_count = $3, updated_at = NOW()
             WHERE id = $4`,
            [sub.status, sub.id, seats, tenantId]
          );
          break;
        }

        case 'customer.subscription.deleted': {
          const sub = event.data.object;
          const tenantId = sub.metadata?.tenant_id;
          if (!tenantId) break;
          await pool.query(
            `UPDATE tenants SET subscription_status = 'canceled', updated_at = NOW() WHERE id = $1`,
            [tenantId]
          );
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          const customerId = invoice.customer as string;
          await pool.query(
            `UPDATE tenants SET subscription_status = 'past_due', updated_at = NOW()
             WHERE stripe_customer_id = $1`,
            [customerId]
          );
          break;
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object;
          const customerId = invoice.customer as string;
          await pool.query(
            `UPDATE tenants
             SET subscription_status = CASE WHEN subscription_status = 'past_due' THEN 'active' ELSE subscription_status END,
                 updated_at = NOW()
             WHERE stripe_customer_id = $1`,
            [customerId]
          );
          break;
        }

        default:
          fastify.log.debug({ type: event.type }, 'Unhandled Stripe webhook event');
      }
    } catch (err: any) {
      fastify.log.error({ err, event: event.type }, 'Failed to process webhook event');
    }

    return { received: true };
  });
}
