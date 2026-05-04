import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { stripe } from '../lib/stripe.js';
import { getPool } from '../lib/db.js';
import { extractAuthContext } from '../lib/auth.js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APP_URL = process.env.APP_URL || 'https://jobbuilda.co.uk';
const ADMIN_URL = process.env.ADMIN_URL || 'https://admin.jobbuilda.co.uk';

async function createSupabaseUser(
  email: string,
  password: string,
  metadata: { tenant_id: string; role: string; company_name: string }
): Promise<{ id: string; email: string }> {
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
      user_metadata: metadata,
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
   * Public. Creates Supabase auth user, inserts tenant row, creates Stripe customer and
   * a hosted Checkout Session (subscription mode, 14-day trial). Returns the Stripe
   * checkout URL — the frontend redirects there to collect card details.
   */
  fastify.post<{
    Body: { email: string; password: string; company_name?: string };
  }>('/api/auth/register', async (request, reply) => {
    const { email, password, company_name } = request.body;

    if (!email || !password) {
      return reply.status(400).send({ error: 'email and password are required' });
    }

    if (!process.env.STRIPE_PRICE_ID) {
      return reply.status(503).send({ error: 'Subscription pricing not configured. Please contact support.' });
    }

    // Pre-generate tenant ID so it can be embedded in the Supabase user's metadata
    // before the row is committed to the DB.
    const tenantId = randomUUID();
    const trialDays = 14;

    try {
      // 1. Create Supabase auth user (confirmed, no email verification step)
      const supabaseUser = await createSupabaseUser(email, password, {
        tenant_id: tenantId,
        role: 'admin',
        company_name: company_name || '',
      });

      // 2. Create Stripe customer
      const customer = await stripe.customers.create({
        email,
        name: company_name,
        metadata: { supabase_user_id: supabaseUser.id, tenant_id: tenantId },
      });

      // 3. Create hosted Checkout Session (subscription + trial, no Stripe.js needed)
      const checkoutSession = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customer.id,
        client_reference_id: tenantId,
        line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
        subscription_data: {
          trial_period_days: trialDays,
          metadata: { tenant_id: tenantId },
        },
        allow_promotion_codes: true,
        success_url: `${ADMIN_URL}/onboarding?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${ADMIN_URL}/signup`,
        metadata: { tenant_id: tenantId },
      });

      // 4. Insert tenant row (subscription_status = 'incomplete' until webhook confirms)
      const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();
      await db.query(
        `INSERT INTO tenants (id, name, plan, stripe_customer_id, trial_ends_at, subscription_status, billing_email, seats_count)
         VALUES ($1, $2, 'trial', $3, $4, 'incomplete', $5, 1)`,
        [tenantId, company_name || email, customer.id, trialEndsAt, email]
      );

      fastify.log.info({ tenantId, customerId: customer.id }, 'New tenant registered, Stripe checkout created');

      return {
        checkout_url: checkoutSession.url,
        tenant_id: tenantId,
        user_id: supabaseUser.id,
      };
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Registration failed');
      return reply.status(400).send({ error: error.message || 'Registration failed' });
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
