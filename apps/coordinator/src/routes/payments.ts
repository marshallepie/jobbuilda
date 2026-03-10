import { FastifyInstance, FastifyRequest } from 'fastify';
import { extractAuthContext } from '../lib/auth.js';
import { stripe } from '../lib/stripe.js';

export async function paymentsRoutes(fastify: FastifyInstance) {
  // GET /api/payments/intents - List all payment intents
  fastify.get('/api/payments/intents', async (request: FastifyRequest, reply) => {
    const context = extractAuthContext(request);
    const uri = 'res://payments/payment-intents';
    try {
      const result = await fastify.mcp.payments.readResource(uri, context);
      return result.data;
    } catch (error: any) {
      reply.status(500).send({ error: 'Failed to list payment intents', message: error.message });
    }
  });

  // GET /api/payments/intents/:id - Get payment intent by ID
  fastify.get<{ Params: { id: string } }>('/api/payments/intents/:id', async (request, reply) => {
    const context = extractAuthContext(request);
    const { id } = request.params;
    const uri = `res://payments/payment-intents/${id}`;
    try {
      const result = await fastify.mcp.payments.readResource(uri, context);
      return result.data;
    } catch (error: any) {
      reply.status(500).send({ error: 'Failed to fetch payment intent', message: error.message });
    }
  });

  // GET /api/payments/transactions - List all payment transactions
  fastify.get('/api/payments/transactions', async (request: FastifyRequest, reply) => {
    const context = extractAuthContext(request);
    const uri = 'res://payments/transactions';
    try {
      const result = await fastify.mcp.payments.readResource(uri, context);
      return result.data;
    } catch (error: any) {
      reply.status(500).send({ error: 'Failed to list payment transactions', message: error.message });
    }
  });

  // GET /api/payments/transactions/:id - Get payment transaction by ID
  fastify.get<{ Params: { id: string } }>('/api/payments/transactions/:id', async (request, reply) => {
    const context = extractAuthContext(request);
    const { id } = request.params;
    const uri = `res://payments/transactions/${id}`;
    try {
      const result = await fastify.mcp.payments.readResource(uri, context);
      return result.data;
    } catch (error: any) {
      reply.status(500).send({ error: 'Failed to fetch payment transaction', message: error.message });
    }
  });

  // GET /api/payments/invoices/:invoiceId/transactions - Get transactions for invoice
  fastify.get<{ Params: { invoiceId: string } }>(
    '/api/payments/invoices/:invoiceId/transactions',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { invoiceId } = request.params;
      const uri = `res://payments/invoice-transactions/${invoiceId}`;
      try {
        const result = await fastify.mcp.payments.readResource(uri, context);
        return result.data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to fetch invoice transactions', message: error.message });
      }
    }
  );

  // POST /api/payments/checkout-session - Create Stripe checkout session
  fastify.post<{ Body: Record<string, unknown> }>(
    '/api/payments/checkout-session',
    async (request, reply) => {
      const context = extractAuthContext(request);
      try {
        const result = await fastify.mcp.payments.callTool(
          'create_checkout_session',
          request.body,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to create checkout session', message: error.message });
      }
    }
  );

  // POST /api/payments/webhook - Process Stripe webhook
  fastify.post<{ Body: Record<string, unknown> }>(
    '/api/payments/webhook',
    async (request, reply) => {
      const context = extractAuthContext(request);
      try {
        const result = await fastify.mcp.payments.callTool(
          'process_webhook',
          request.body,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to process webhook', message: error.message });
      }
    }
  );

  // POST /api/payments/transactions/:id/reconcile - Reconcile payment
  fastify.post<{ Params: { id: string } }>(
    '/api/payments/transactions/:id/reconcile',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      try {
        const result = await fastify.mcp.payments.callTool(
          'reconcile_payment',
          { transaction_id: id },
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to reconcile payment', message: error.message });
      }
    }
  );

  // POST /api/payments/transactions/:id/refund - Create refund
  fastify.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/payments/transactions/:id/refund',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      try {
        const args: Record<string, unknown> = { transaction_id: id, ...request.body };
        const result = await fastify.mcp.payments.callTool(
          'create_refund',
          args,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to create refund', message: error.message });
      }
    }
  );

  // POST /api/payments/quote/:quoteId/deposit-checkout - Create Stripe checkout session for quote deposit
  fastify.post<{ Params: { quoteId: string } }>(
    '/api/payments/quote/:quoteId/deposit-checkout',
    async (request, reply) => {
      const { quoteId } = request.params;
      const tenantId = (request.headers['x-tenant-id'] as string) ||
                       '550e8400-e29b-41d4-a716-446655440000';
      const context = {
        tenant_id: tenantId,
        user_id: 'portal',
        scopes: [],
        x_request_id: request.id,
      };

      try {
        // Fetch tenant profile to get Stripe Connect account
        const profileResource = await fastify.mcp.identity.readResource(
          `res://identity/tenants/${tenantId}`,
          context
        );
        const profileWrapper = profileResource.data as any;
        const profile = profileWrapper.data || profileWrapper;

        if (!profile.stripe_account_id || profile.stripe_connect_status !== 'active') {
          return reply.status(400).send({
            error: 'Stripe not connected',
            message: 'This business has not connected a Stripe account yet. Please contact them directly to arrange payment.',
          });
        }

        // Fetch quote
        const quoteResource = await fastify.mcp.quoting.readResource(
          `res://quoting/quotes/${quoteId}`,
          context
        );
        const quoteWrapper = quoteResource.data as any;
        const quote = quoteWrapper.data || quoteWrapper;

        // Compute deposit amount
        const depositAmount = quote.deposit_amount
          ? parseFloat(quote.deposit_amount)
          : quote.deposit_percent
            ? Math.round(parseFloat(quote.total_inc_vat) * parseFloat(quote.deposit_percent) / 100 * 100) / 100
            : parseFloat(quote.deposit_fixed_amount) || 0;

        if (depositAmount <= 0) {
          return reply.status(400).send({ error: 'No deposit configured on this quote' });
        }

        const portalUrl = process.env.PORTAL_URL || 'http://localhost:3001';

        // Create Stripe checkout session via payments-mcp, passing the tenant's Connect account
        const result = await fastify.mcp.payments.callTool(
          'create_checkout_session',
          {
            invoice_id: quoteId,
            amount: depositAmount,
            currency: 'gbp',
            description: `Deposit for Quote ${quote.quote_number}`,
            success_url: `${portalUrl}/payment/quote-deposit/success?quote_id=${quoteId}`,
            cancel_url: `${portalUrl}/payment/quote-deposit/${quoteId}`,
            stripe_account_id: profile.stripe_account_id,
            metadata: {
              payment_type: 'quote_deposit',
              quote_id: quoteId,
              tenant_id: context.tenant_id,
            },
          },
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');

        return reply.send({ checkoutUrl: data.checkout_url });
      } catch (error: any) {
        fastify.log.error({ error, quoteId }, 'Failed to create quote deposit checkout session');
        return reply.status(500).send({ error: 'Failed to create checkout session', message: error.message });
      }
    }
  );

  // Helper: get or create a Stripe Express Connect account for a tenant
  async function getOrCreateConnectAccount(
    tenant: any,
    tenantId: string,
    context: { tenant_id: string; user_id: string; scopes: string[]; x_request_id: string }
  ): Promise<string> {
    if (tenant.stripe_account_id) {
      return tenant.stripe_account_id;
    }

    // Create a new Express account
    const account = await stripe.accounts.create({
      type: 'express',
      metadata: { tenant_id: tenantId },
    });

    // Persist the new account ID and mark status as pending
    await fastify.mcp.identity.callTool(
      'update_tenant_profile',
      {
        stripe_account_id: account.id,
        stripe_connect_status: 'pending',
      },
      context
    );

    return account.id;
  }

  // GET /api/payments/connect/authorize - Start Stripe Connect onboarding
  fastify.get('/api/payments/connect/authorize', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const context = {
      tenant_id: tenantId,
      user_id: (request.headers['x-user-id'] as string) || 'admin',
      scopes: [],
      x_request_id: request.id,
    };

    try {
      const profileResource = await fastify.mcp.identity.readResource(
        `res://identity/tenants/${tenantId}`,
        context
      );
      const profileWrapper = profileResource.data as any;
      const tenant = profileWrapper.data || profileWrapper;

      const accountId = await getOrCreateConnectAccount(tenant, tenantId, context);

      const adminUrl = process.env.ADMIN_URL || 'http://localhost:3001';

      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${adminUrl}/settings?stripe=refresh`,
        return_url: `${adminUrl}/settings?stripe=success`,
        type: 'account_onboarding',
      });

      return reply.send({ url: accountLink.url });
    } catch (error: any) {
      fastify.log.error({ error, tenantId }, 'Failed to create Stripe Connect account link');
      return reply.status(500).send({ error: 'Failed to create Stripe Connect link', message: error.message });
    }
  });

  // GET /api/payments/connect/status - Get Stripe Connect status for tenant
  fastify.get('/api/payments/connect/status', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const context = {
      tenant_id: tenantId,
      user_id: (request.headers['x-user-id'] as string) || 'admin',
      scopes: [],
      x_request_id: request.id,
    };

    try {
      const profileResource = await fastify.mcp.identity.readResource(
        `res://identity/tenants/${tenantId}`,
        context
      );
      const profileWrapper = profileResource.data as any;
      const tenant = profileWrapper.data || profileWrapper;

      let stripeConnectStatus = tenant.stripe_connect_status;

      // If account exists but not yet marked active, check Stripe for onboarding completion
      if (tenant.stripe_account_id && stripeConnectStatus !== 'active') {
        try {
          const account = await stripe.accounts.retrieve(tenant.stripe_account_id);
          if (account.details_submitted) {
            stripeConnectStatus = 'active';
            await fastify.mcp.identity.callTool(
              'update_tenant_profile',
              { stripe_connect_status: 'active' },
              context
            );
          }
        } catch (stripeErr: any) {
          fastify.log.warn({ stripeErr, tenantId }, 'Failed to retrieve Stripe account for status check');
        }
      }

      return reply.send({
        stripe_account_id: tenant.stripe_account_id || null,
        stripe_connect_status: stripeConnectStatus || null,
        connected: !!tenant.stripe_account_id,
      });
    } catch (error: any) {
      fastify.log.error({ error, tenantId }, 'Failed to get Stripe Connect status');
      return reply.status(500).send({ error: 'Failed to get Stripe Connect status', message: error.message });
    }
  });

  // POST /api/payments/connect/disconnect - Disconnect Stripe Connect account
  fastify.post('/api/payments/connect/disconnect', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const context = {
      tenant_id: tenantId,
      user_id: (request.headers['x-user-id'] as string) || 'admin',
      scopes: [],
      x_request_id: request.id,
    };

    try {
      await fastify.mcp.identity.callTool(
        'update_tenant_profile',
        {
          stripe_account_id: '',
          stripe_connect_status: '',
        },
        context
      );

      return reply.send({ success: true });
    } catch (error: any) {
      fastify.log.error({ error, tenantId }, 'Failed to disconnect Stripe Connect account');
      return reply.status(500).send({ error: 'Failed to disconnect Stripe account', message: error.message });
    }
  });
}
