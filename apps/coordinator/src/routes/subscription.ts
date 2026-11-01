import { FastifyInstance } from 'fastify';
import { stripe } from '../lib/stripe.js';
import { getPool } from '../lib/db.js';
import { extractAuthContext } from '../lib/auth.js';

const ADMIN_URL = process.env.ADMIN_URL || 'https://admin.jobbuilda.co.uk';

export async function subscriptionRoutes(fastify: FastifyInstance) {
  const db = getPool();

  /**
   * POST /api/auth/register
   * Public acquisition is paused while tenant authentication is remediated.
   */
  fastify.post<{
    Body: { email: string; password: string; company_name?: string };
  }>('/api/auth/register', async (_request, reply) => {
    return reply.status(503).send({
      error: 'Registration temporarily unavailable',
      code: 'REGISTRATION_PAUSED',
      message: 'New trials and subscription checkout are temporarily unavailable while we complete maintenance.',
    });
  });

  /**
   * GET /api/subscription/status
   * Authenticated. Returns tenant subscription info.
   */
  fastify.get('/api/subscription/status', async (request, reply) => {
    const context = extractAuthContext(request);

    try {
      const result = await db.query(
        'SELECT subscription_status, trial_ends_at, seats_count FROM tenants WHERE id = $1',
        [context.tenant_id]
      );
      if (!result.rows[0]) {
        return reply.status(404).send({ error: 'Tenant not found' });
      }
      return result.rows[0];
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * POST /api/subscription/portal
   * Authenticated. Creates Stripe Customer Portal session so the user can manage
   * their subscription, update payment method, view invoices, etc.
   */
  fastify.post('/api/subscription/portal', async (request, reply) => {
    const context = extractAuthContext(request);

    try {
      const result = await db.query(
        'SELECT stripe_customer_id FROM tenants WHERE id = $1',
        [context.tenant_id]
      );
      if (!result.rows[0]?.stripe_customer_id) {
        return reply.status(404).send({ error: 'No billing account found' });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: result.rows[0].stripe_customer_id,
        return_url: `${ADMIN_URL}/settings/billing`,
      });

      return { url: session.url };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
