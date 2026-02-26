import { AuthContext } from '@jobbuilda/contracts';
import { createLead, CreateLeadInput, CreateLeadOutput } from './create-lead.js';
import { createQuote, CreateQuoteInput, CreateQuoteOutput } from './create-quote.js';
import { sendQuote, SendQuoteInput, SendQuoteOutput } from './send-quote.js';
import { approveQuote, ApproveQuoteInput, ApproveQuoteOutput } from './approve-quote.js';
import { rejectQuote, RejectQuoteInput, RejectQuoteOutput } from './reject-quote.js';
import { updateQuote, UpdateQuoteInput, UpdateQuoteOutput } from './update-quote.js';
import { deleteQuote, DeleteQuoteInput } from './delete-quote.js';
import { addQuoteItem, AddQuoteItemInput } from './add-quote-item.js';
import { removeQuoteItem, RemoveQuoteItemInput } from './remove-quote-item.js';

export const tools = [
  {
    name: 'create_lead',
    description: 'Create a new lead (initial client inquiry)',
    inputSchema: {
      type: 'object',
      properties: {
        client_id: { type: 'string', description: 'Existing client UUID (optional)' },
        name: { type: 'string', description: 'Lead name' },
        email: { type: 'string', description: 'Contact email' },
        phone: { type: 'string', description: 'Contact phone' },
        address: { type: 'string', description: 'Job address' },
        description: { type: 'string', description: 'Lead description/requirements' },
        source: { type: 'string', description: 'Lead source (e.g., "website", "referral")' },
        assigned_to: { type: 'string', description: 'User UUID to assign to' },
        notes: { type: 'string', description: 'Additional notes' }
      },
      required: ['name']
    }
  },
  {
    name: 'create_quote',
    description: 'Create a new quote with line items',
    inputSchema: {
      type: 'object',
      properties: {
        lead_id: { type: 'string', description: 'Lead UUID (optional)' },
        client_id: { type: 'string', description: 'Client UUID' },
        site_id: { type: 'string', description: 'Site UUID (optional)' },
        title: { type: 'string', description: 'Quote title' },
        description: { type: 'string', description: 'Quote description' },
        valid_until: { type: 'string', description: 'Expiry date (ISO 8601)' },
        terms: { type: 'string', description: 'Terms and conditions' },
        notes: { type: 'string', description: 'Internal notes' },
        items: {
          type: 'array',
          description: 'Quote line items',
          items: {
            type: 'object',
            properties: {
              item_type: { type: 'string', enum: ['material', 'labor', 'other'] },
              product_id: { type: 'string', description: 'Product UUID (for materials)' },
              sku: { type: 'string', description: 'Product SKU' },
              description: { type: 'string', description: 'Line item description' },
              quantity: { type: 'number', description: 'Quantity' },
              unit: { type: 'string', description: 'Unit of measure', default: 'unit' },
              unit_price_ex_vat: { type: 'number', description: 'Unit price excluding VAT' },
              markup_percent: { type: 'number', description: 'Markup percentage', default: 0 },
              vat_rate: { type: 'number', description: 'VAT rate percentage', default: 20.0 },
              notes: { type: 'string', description: 'Line item notes' }
            },
            required: ['item_type', 'description', 'quantity', 'unit_price_ex_vat']
          }
        }
      },
      required: ['client_id', 'title', 'items']
    }
  },
  {
    name: 'send_quote',
    description: 'Send quote to client (changes status to "sent")',
    inputSchema: {
      type: 'object',
      properties: {
        quote_id: { type: 'string', description: 'Quote UUID' }
      },
      required: ['quote_id']
    }
  },
  {
    name: 'approve_quote',
    description: 'Approve quote (client acceptance)',
    inputSchema: {
      type: 'object',
      properties: {
        quote_id: { type: 'string', description: 'Quote UUID' }
      },
      required: ['quote_id']
    }
  },
  {
    name: 'reject_quote',
    description: 'Reject quote (client rejection)',
    inputSchema: {
      type: 'object',
      properties: {
        quote_id: { type: 'string', description: 'Quote UUID' },
        rejection_reason: { type: 'string', description: 'Reason for rejection' }
      },
      required: ['quote_id']
    }
  },
  {
    name: 'delete_quote',
    description: 'Delete a quote (not allowed for approved quotes)',
    inputSchema: {
      type: 'object',
      properties: {
        quote_id: { type: 'string', description: 'Quote UUID' },
      },
      required: ['quote_id'],
    }
  },
  {
    name: 'add_quote_item',
    description: 'Add a line item to an existing quote',
    inputSchema: {
      type: 'object',
      properties: {
        quote_id: { type: 'string' },
        item_type: { type: 'string', enum: ['material', 'labor', 'other'] },
        description: { type: 'string' },
        quantity: { type: 'number' },
        unit: { type: 'string' },
        unit_price_ex_vat: { type: 'number' },
        markup_percent: { type: 'number' },
        estimated_hours: { type: 'number' },
        labor_rate: { type: 'number' },
        vat_rate: { type: 'number' },
        notes: { type: 'string' },
      },
      required: ['quote_id', 'item_type', 'description', 'quantity'],
    }
  },
  {
    name: 'remove_quote_item',
    description: 'Remove a line item from a quote',
    inputSchema: {
      type: 'object',
      properties: {
        quote_id: { type: 'string' },
        item_id: { type: 'string' },
      },
      required: ['quote_id', 'item_id'],
    }
  },
  {
    name: 'update_quote',
    description: 'Update a quote with new values',
    inputSchema: {
      type: 'object',
      properties: {
        quote_id: { type: 'string', description: 'Quote ID (UUID)' },
        title: { type: 'string', description: 'Quote title' },
        description: { type: 'string', description: 'Quote description' },
        status: {
          type: 'string',
          enum: ['draft', 'sent', 'viewed', 'approved', 'rejected', 'expired'],
          description: 'Quote status',
        },
        valid_until: { type: 'string', description: 'Valid until date (ISO 8601)' },
        terms: { type: 'string', description: 'Terms and conditions' },
        notes: { type: 'string', description: 'Internal notes' },
        job_id: { type: 'string', description: 'Associated job ID (UUID)' },
      },
      required: ['quote_id'],
    }
  }
];

export async function handleToolCall(name: string, args: any): Promise<any> {
  const context: AuthContext = args._meta?.context;
  if (!context) {
    throw new Error('Missing auth context in tool call');
  }

  switch (name) {
    case 'create_lead':
      return await createLead(args as CreateLeadInput, context);

    case 'create_quote':
      return await createQuote(args as CreateQuoteInput, context);

    case 'send_quote':
      return await sendQuote(args as SendQuoteInput, context);

    case 'approve_quote':
      return await approveQuote(args as ApproveQuoteInput, context);

    case 'reject_quote':
      return await rejectQuote(args as RejectQuoteInput, context);

    case 'update_quote':
      return await updateQuote(args as UpdateQuoteInput, context);

    case 'delete_quote':
      return await deleteQuote(args as DeleteQuoteInput, context);

    case 'add_quote_item':
      return await addQuoteItem(args as AddQuoteItemInput, context);

    case 'remove_quote_item':
      return await removeQuoteItem(args as RemoveQuoteItemInput, context);

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
