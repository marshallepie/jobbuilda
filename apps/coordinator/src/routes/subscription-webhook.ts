import { FastifyInstance } from 'fastify';
import { Readable } from 'stream';
import { stripe } from '../lib/stripe.js';
import { getPool } from '../lib/db.js';

type TenantRow = {
  id: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
};

type TenantStore = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: TenantRow[]; rowCount?: number | null }>;
};

export type SubscriptionWebhookDependencies = {
  getPool?: () => TenantStore;
};

function stripeId(value: unknown): string | undefined {
  if (typeof value === 'string' && value) return value;
  if (value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string') {
    return (value as { id: string }).id;
  }
  return undefined;
}

function exactlyOneTenant(rows: TenantRow[]): TenantRow | undefined {
  return rows.length === 1 ? rows[0] : undefined;
}

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
export async function subscriptionWebhookRoutes(
  fastify: FastifyInstance,
  dependencies: SubscriptionWebhookDependencies = {},
) {
  fastify.addHook('preParsing', async (request, _reply, payload) => {
    const chunks: Buffer[] = [];
    for await (const chunk of payload) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
    }
    const raw = Buffer.concat(chunks);
    (request as any).rawBody = raw;
    return Readable.from(raw);
  });

  fastify.post('/api/subscription/webhook', async (request, reply) => {
    const sig = request.headers['stripe-signature'] as string;
    const rawBody = (request as any).rawBody as Buffer;

    if (!sig) return reply.status(400).send({ error: 'Missing stripe-signature header' });
    if (!rawBody) return reply.status(400).send({ error: 'Missing raw body' });

    let event: any;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch (err: any) {
      fastify.log.warn({ err }, 'Stripe webhook signature verification failed');
      return reply.status(400).send({ error: `Webhook Error: ${err.message}` });
    }

    const pool = dependencies.getPool?.() ?? getPool();
    const ignore = (reason: string, details: Record<string, unknown> = {}) =>
      fastify.log.warn({ eventType: event.type, ...details }, `Ignoring Stripe webhook: ${reason}`);

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const customerId = stripeId(session.customer);
          const subscriptionId = stripeId(session.subscription);
          if (!customerId || !subscriptionId) {
            ignore('checkout session has no customer/subscription identifiers');
            break;
          }

          // Metadata and client_reference_id are correlation-only. The pre-existing
          // durable Stripe customer mapping is the sole tenant-routing authority.
          const result = await pool.query(
            `SELECT id, stripe_customer_id, stripe_subscription_id
             FROM tenants WHERE stripe_customer_id = $1`,
            [customerId],
          );
          const tenant = exactlyOneTenant(result.rows);
          if (!tenant || (tenant.stripe_subscription_id && tenant.stripe_subscription_id !== subscriptionId)) {
            ignore('checkout customer mapping is absent, ambiguous, or conflicts with subscription', { customerId, subscriptionId });
            break;
          }

          const updated = await pool.query(
            `UPDATE tenants
             SET stripe_subscription_id = $1, updated_at = NOW()
             WHERE id = $2
               AND stripe_customer_id = $3
               AND (stripe_subscription_id IS NULL OR stripe_subscription_id = $1)`,
            [subscriptionId, tenant.id, customerId],
          );
          if (updated.rowCount !== undefined && updated.rowCount !== 1) {
            ignore('checkout mapping changed before update', { customerId, subscriptionId });
          }
          break;
        }

        case 'customer.subscription.updated': {
          const sub = event.data.object;
          const customerId = stripeId(sub.customer);
          const subscriptionId = stripeId(sub.id);
          if (!customerId || !subscriptionId) {
            ignore('subscription update has no customer/subscription identifiers');
            break;
          }
          const result = await pool.query(
            `SELECT id, stripe_customer_id, stripe_subscription_id
             FROM tenants
             WHERE stripe_subscription_id = $1 AND stripe_customer_id = $2`,
            [subscriptionId, customerId],
          );
          const tenant = exactlyOneTenant(result.rows);
          if (!tenant) {
            ignore('subscription mapping is absent or ambiguous', { customerId, subscriptionId });
            break;
          }
          const seats = sub.items?.data?.reduce(
            (sum: number, item: any) => sum + (item.quantity || 1), 0,
          ) || 1;
          await pool.query(
            `UPDATE tenants
             SET subscription_status = $1, seats_count = $2, updated_at = NOW()
             WHERE id = $3 AND stripe_subscription_id = $4 AND stripe_customer_id = $5`,
            [sub.status, seats, tenant.id, subscriptionId, customerId],
          );
          break;
        }

        case 'customer.subscription.deleted': {
          const sub = event.data.object;
          const customerId = stripeId(sub.customer);
          const subscriptionId = stripeId(sub.id);
          if (!customerId || !subscriptionId) {
            ignore('subscription deletion has no customer/subscription identifiers');
            break;
          }
          const result = await pool.query(
            `SELECT id, stripe_customer_id, stripe_subscription_id
             FROM tenants
             WHERE stripe_subscription_id = $1 AND stripe_customer_id = $2`,
            [subscriptionId, customerId],
          );
          const tenant = exactlyOneTenant(result.rows);
          if (!tenant) {
            ignore('subscription mapping is absent or ambiguous', { customerId, subscriptionId });
            break;
          }
          await pool.query(
            `UPDATE tenants SET subscription_status = 'canceled', updated_at = NOW()
             WHERE id = $1 AND stripe_subscription_id = $2 AND stripe_customer_id = $3`,
            [tenant.id, subscriptionId, customerId],
          );
          break;
        }

        case 'invoice.payment_failed':
        case 'invoice.payment_succeeded': {
          const invoice = event.data.object;
          const customerId = stripeId(invoice.customer);
          const subscriptionId = stripeId(invoice.subscription);
          if (!customerId || !subscriptionId) {
            ignore('invoice has no customer/subscription identifiers');
            break;
          }
          const result = await pool.query(
            `SELECT id, stripe_customer_id, stripe_subscription_id
             FROM tenants WHERE stripe_customer_id = $1`,
            [customerId],
          );
          const tenant = exactlyOneTenant(result.rows);
          if (!tenant || tenant.stripe_subscription_id !== subscriptionId) {
            ignore('invoice mapping is absent, ambiguous, or conflicts with subscription', { customerId, subscriptionId });
            break;
          }
          if (event.type === 'invoice.payment_failed') {
            await pool.query(
              `UPDATE tenants SET subscription_status = 'past_due', updated_at = NOW()
               WHERE id = $1 AND stripe_customer_id = $2 AND stripe_subscription_id = $3`,
              [tenant.id, customerId, subscriptionId],
            );
          } else {
            await pool.query(
              `UPDATE tenants
               SET subscription_status = CASE WHEN subscription_status = 'past_due' THEN 'active' ELSE subscription_status END,
                   updated_at = NOW()
               WHERE id = $1 AND stripe_customer_id = $2 AND stripe_subscription_id = $3`,
              [tenant.id, customerId, subscriptionId],
            );
          }
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
