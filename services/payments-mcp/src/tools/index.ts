import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createCheckoutSession } from './create-checkout-session.js';
import { processWebhook } from './process-webhook.js';
import { reconcilePayment } from './reconcile-payment.js';
import { createRefund } from './create-refund.js';

interface AuthContext {
  tenant_id: string;
  user_id: string;
  scopes: string[];
}

export function registerTools(server: Server) {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'create_checkout_session',
          description: 'Create a Stripe checkout session for invoice payment',
          inputSchema: {
            type: 'object',
            properties: {
              invoice_id: { type: 'string', description: 'Invoice ID to pay' },
              amount: { type: 'number', description: 'Amount to charge' },
              currency: { type: 'string', description: 'Currency code (default: gbp)' },
              description: { type: 'string', description: 'Payment description' },
              client_id: { type: 'string', description: 'Client ID' },
              success_url: { type: 'string', description: 'URL to redirect after successful payment' },
              cancel_url: { type: 'string', description: 'URL to redirect if payment cancelled' },
              payment_method_types: {
                type: 'array',
                items: { type: 'string' },
                description: 'Payment method types (default: ["card"])',
              },
              expires_in_minutes: { type: 'number', description: 'Session expiry in minutes (default: 30)' },
            },
            required: ['invoice_id', 'amount', 'success_url', 'cancel_url'],
          },
        },
        {
          name: 'process_webhook',
          description: 'Process Stripe webhook event',
          inputSchema: {
            type: 'object',
            properties: {
              event_type: { type: 'string', description: 'Stripe event type' },
              stripe_event_id: { type: 'string', description: 'Stripe event ID' },
              data: { type: 'object', description: 'Event data' },
            },
            required: ['event_type', 'stripe_event_id', 'data'],
          },
        },
        {
          name: 'reconcile_payment',
          description: 'Reconcile a payment transaction',
          inputSchema: {
            type: 'object',
            properties: {
              transaction_id: { type: 'string', description: 'Payment transaction ID' },
            },
            required: ['transaction_id'],
          },
        },
        {
          name: 'create_refund',
          description: 'Create a refund for a payment transaction',
          inputSchema: {
            type: 'object',
            properties: {
              transaction_id: { type: 'string', description: 'Payment transaction ID to refund' },
              amount: { type: 'number', description: 'Refund amount (defaults to full amount)' },
              reason: {
                type: 'string',
                enum: ['duplicate', 'fraudulent', 'requested_by_customer', 'other'],
                description: 'Refund reason',
              },
              notes: { type: 'string', description: 'Internal notes' },
            },
            required: ['transaction_id'],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Extract auth context from arguments
    const context = (args as any)?._meta?.context as AuthContext;

    if (!context) {
      throw new Error('Authentication context required');
    }

    try {
      let result;

      switch (name) {
        case 'create_checkout_session':
          result = await createCheckoutSession(args as any, context);
          break;

        case 'process_webhook':
          result = await processWebhook(args as any, context);
          break;

        case 'reconcile_payment':
          result = await reconcilePayment(args as any, context);
          break;

        case 'create_refund':
          result = await createRefund(args as any, context);
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });
}
