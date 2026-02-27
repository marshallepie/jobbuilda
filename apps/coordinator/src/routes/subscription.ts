import { FastifyInstance } from 'fastify';
import { stripe } from '../lib/stripe.js';
import { getPool } from '../lib/db.js';
import { extractAuthContext } from '../lib/auth.js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APP_URL = process.env.APP_URL || 'https://jobbuilda.co.uk';

async function createSupabaseUser(email: string, password: string): Promise<{ id: string; email: string }> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: false,
      options: {
        email_redirect_to: `${APP_URL}/onboarding`,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || `Supabase signup failed: ${res.status}`);
  }

  return res.json() as Promise<{ id: string; email: string }>;
}

export async function subscriptionRoutes(fastify: FastifyInstance) {
  const db = getPool();

  /**
   * POST /api/auth/register
   * Public. Creates Supabase auth user, inserts tenant row, creates Stripe customer + SetupIntent.
   */
  fastify.post<{
    Body: { email: string; password: string; company_name?: string };
  }>('/api/auth/register', async (request, reply) => {
    const { email, password, company_name } = request.body;

    if (!email || !password) {
      return reply.status(400).send({ error: 'email and password are required' });
    }

    try {
      // 1. Create Supabase auth user
      const supabaseUser = await createSupabaseUser(email, password);

      // 2. Create Stripe customer
      const customer = await stripe.customers.create({
        email,
        name: company_name,
        metadata: { supabase_user_id: supabaseUser.id },
      });

      // 3. Create Stripe SetupIntent (to collect card details upfront)
      const setupIntent = await stripe.setupIntents.create({
        customer: customer.id,
        payment_method_types: ['card'],
        usage: 'off_session',
        metadata: { supabase_user_id: supabaseUser.id },
      });

      // 4. Insert tenant row
      const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const result = await db.query(
        `INSERT INTO tenants (name, plan, stripe_customer_id, trial_ends_at, subscription_status, billing_email, seats_count)
         VALUES ($1, 'trial', $2, $3, 'incomplete', $4, 1)
         RETURNING id`,
        [company_name || email, customer.id, trialEndsAt, email]
      );
      const tenantId = result.rows[0].id;

      // 5. Store tenant_id in Stripe customer metadata
      await stripe.customers.update(customer.id, {
        metadata: { supabase_user_id: supabaseUser.id, tenant_id: tenantId },
      });

      return {
        setup_intent_client_secret: setupIntent.client_secret,
        tenant_id: tenantId,
        user_id: supabaseUser.id,
      };
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Registration failed');
      return reply.status(400).send({ error: error.message || 'Registration failed' });
    }
  });

  /**
   * POST /api/auth/confirm-subscription
   * Public. Attaches payment method to Stripe customer and creates subscription with 14-day trial.
   */
  fastify.post<{
    Body: { payment_method_id: string; tenant_id: string };
  }>('/api/auth/confirm-subscription', async (request, reply) => {
    const { payment_method_id, tenant_id } = request.body;

    if (!payment_method_id || !tenant_id) {
      return reply.status(400).send({ error: 'payment_method_id and tenant_id are required' });
    }

    try {
      // 1. Get tenant's Stripe customer ID
      const tenantResult = await db.query(
        'SELECT stripe_customer_id FROM tenants WHERE id = $1',
        [tenant_id]
      );
      if (!tenantResult.rows[0]) {
        return reply.status(404).send({ error: 'Tenant not found' });
      }
      const customerId = tenantResult.rows[0].stripe_customer_id;

      // 2. Attach payment method to customer
      await stripe.paymentMethods.attach(payment_method_id, { customer: customerId });

      // 3. Set as default payment method
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: payment_method_id },
      });

      // 4. Create subscription with 14-day trial
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: process.env.STRIPE_PRICE_ID! }],
        trial_period_days: 14,
        default_payment_method: payment_method_id,
        metadata: { tenant_id },
      });

      // 5. Update tenant row
      await db.query(
        `UPDATE tenants
         SET stripe_subscription_id = $1, subscription_status = 'trialing', updated_at = NOW()
         WHERE id = $2`,
        [subscription.id, tenant_id]
      );

      return { subscription_id: subscription.id, status: 'trialing' };
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Confirm subscription failed');
      return reply.status(400).send({ error: error.message || 'Failed to confirm subscription' });
    }
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
   * Authenticated. Creates Stripe Customer Portal session.
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
        return_url: `${process.env.ADMIN_URL || 'https://admin.jobbuilda.co.uk'}/settings/billing`,
      });

      return { url: session.url };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

}
