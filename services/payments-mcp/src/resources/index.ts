import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ReadResourceRequestSchema,
  ListResourcesRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { handlePaymentIntentResource } from './payment-intent.js';
import { handlePaymentTransactionResource } from './payment-transaction.js';
import { handleInvoiceTransactionsResource } from './invoice-transactions.js';

export function registerResources(server: Server) {
  server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
    return {
      resources: [
        {
          uri: 'res://payments/payment-intents',
          name: 'Payment Intents',
          description: 'List all payment intents (Stripe checkout sessions)',
          mimeType: 'application/json',
        },
        {
          uri: 'res://payments/payment-intents/{id}',
          name: 'Payment Intent',
          description: 'Get payment intent by ID',
          mimeType: 'application/json',
        },
        {
          uri: 'res://payments/transactions',
          name: 'Payment Transactions',
          description: 'List all payment transactions',
          mimeType: 'application/json',
        },
        {
          uri: 'res://payments/transactions/{id}',
          name: 'Payment Transaction',
          description: 'Get payment transaction by ID',
          mimeType: 'application/json',
        },
        {
          uri: 'res://payments/invoice-transactions/{invoiceId}',
          name: 'Invoice Transactions',
          description: 'Get all transactions for an invoice',
          mimeType: 'application/json',
        },
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    const context = (request.params as any)?._meta?.context;

    let data;
    if (uri.startsWith('res://payments/payment-intents')) {
      data = await handlePaymentIntentResource(uri, context);
    } else if (uri.startsWith('res://payments/invoice-transactions/')) {
      data = await handleInvoiceTransactionsResource(uri, context);
    } else if (uri.startsWith('res://payments/transactions')) {
      data = await handlePaymentTransactionResource(uri, context);
    } else {
      throw new Error(`Unknown resource URI: ${uri}`);
    }

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  });
}
