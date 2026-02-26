import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createInvoice } from './create-invoice.js';
import { sendInvoice } from './send-invoice.js';
import { recordPayment } from './record-payment.js';
import { cancelInvoice } from './cancel-invoice.js';
import { updateInvoice } from './update-invoice.js';
import { deleteInvoice } from './delete-invoice.js';
import type { AuthContext } from '@jobbuilda/contracts';

export function registerTools(server: Server) {
  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'create_invoice',
        description: 'Create a new invoice from job items and variations',
        inputSchema: {
          type: 'object',
          properties: {
            job_id: { type: 'string', description: 'Job UUID (optional for standalone invoices)' },
            client_id: { type: 'string', description: 'Client UUID' },
            site_id: { type: 'string', description: 'Site UUID (optional for standalone invoices)' },
            invoice_type: {
              type: 'string',
              enum: ['deposit', 'progress', 'final', 'credit_note'],
              description: 'Invoice type (default: final)',
            },
            invoice_date: { type: 'string', description: 'Invoice date (ISO 8601)' },
            payment_terms_days: { type: 'number', description: 'Payment terms in days (default 30)' },
            items: {
              type: 'array',
              description: 'Invoice line items',
              items: {
                type: 'object',
                properties: {
                  item_type: {
                    type: 'string',
                    enum: ['labor', 'material', 'variation', 'other'],
                    description: 'Type of item',
                  },
                  description: { type: 'string', description: 'Item description' },
                  quantity: { type: 'number', description: 'Quantity' },
                  unit: { type: 'string', description: 'Unit of measure' },
                  unit_price_ex_vat: { type: 'number', description: 'Unit price excluding VAT' },
                  vat_rate: { type: 'number', description: 'VAT rate (default 20.00)' },
                  job_item_id: { type: 'string', description: 'Job item UUID if applicable' },
                  variation_id: { type: 'string', description: 'Variation UUID if applicable' },
                },
                required: ['item_type', 'description', 'quantity', 'unit_price_ex_vat'],
              },
            },
            notes: { type: 'string', description: 'Invoice notes' },
          },
          required: ['client_id', 'items'],
        },
      },
      {
        name: 'send_invoice',
        description: 'Send invoice to client',
        inputSchema: {
          type: 'object',
          properties: {
            invoice_id: { type: 'string', description: 'Invoice UUID' },
          },
          required: ['invoice_id'],
        },
      },
      {
        name: 'record_payment',
        description: 'Record payment against invoice',
        inputSchema: {
          type: 'object',
          properties: {
            invoice_id: { type: 'string', description: 'Invoice UUID' },
            amount: { type: 'number', description: 'Payment amount' },
            payment_date: { type: 'string', description: 'Payment date (ISO 8601)' },
            payment_method: { type: 'string', description: 'Payment method' },
            payment_reference: { type: 'string', description: 'Payment reference' },
            notes: { type: 'string', description: 'Payment notes' },
          },
          required: ['invoice_id', 'amount'],
        },
      },
      {
        name: 'update_invoice',
        description: 'Update a draft invoice (header fields and/or line items)',
        inputSchema: {
          type: 'object',
          properties: {
            invoice_id: { type: 'string' },
            invoice_date: { type: 'string' },
            payment_terms_days: { type: 'number' },
            notes: { type: 'string' },
            items: { type: 'array' },
          },
          required: ['invoice_id'],
        },
      },
      {
        name: 'delete_invoice',
        description: 'Delete a draft or sent invoice (not allowed if payments recorded)',
        inputSchema: {
          type: 'object',
          properties: {
            invoice_id: { type: 'string' },
          },
          required: ['invoice_id'],
        },
      },
      {
        name: 'cancel_invoice',
        description: 'Cancel an invoice',
        inputSchema: {
          type: 'object',
          properties: {
            invoice_id: { type: 'string', description: 'Invoice UUID' },
            reason: { type: 'string', description: 'Cancellation reason' },
          },
          required: ['invoice_id'],
        },
      },
    ],
  }));

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const context = (args as any)?._meta?.context as AuthContext;

    if (!context?.tenant_id) {
      throw new Error('Missing authentication context');
    }

    let result: any;

    switch (name) {
      case 'create_invoice':
        result = await createInvoice(args as any, context);
        break;
      case 'send_invoice':
        result = await sendInvoice(args as any, context);
        break;
      case 'record_payment':
        result = await recordPayment(args as any, context);
        break;
      case 'cancel_invoice':
        result = await cancelInvoice(args as any, context);
        break;
      case 'update_invoice':
        result = await updateInvoice(args as any, context);
        break;
      case 'delete_invoice':
        result = await deleteInvoice(args as any, context);
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
  });
}
