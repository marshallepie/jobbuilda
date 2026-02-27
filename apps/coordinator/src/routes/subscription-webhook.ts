import { FastifyInstance } from 'fastify';
import { stripe } from '../lib/stripe.js';
import { getPool } from '../lib/db.js';

/**
 * Webhook route registered as its own top-level plugin so that
 * addContentTypeParser only affects this one route and nothing else.
 */
export async function subscriptionWebhookRoutes(fastify: FastifyInstance) {
  // Return raw Buffer instead of parsed JSON — required for Stripe signature verification
  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, body);
  });

  fastify.post('/api/subscription/webhook', async (request, reply) => {
    const sig = request.headers['stripe-signature'] as string;
    const rawBody = request.body as Buffer;

    if (!sig) {
      return reply.status(400).send({ error: 'Missing stripe-signature header' });
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
      // Return 200 so Stripe doesn't retry for transient DB errors
    }

    return { received: true };
  });
}
