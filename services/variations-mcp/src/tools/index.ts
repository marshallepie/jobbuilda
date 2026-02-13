import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createVariation } from './create-variation.js';
import { approveVariation } from './approve-variation.js';
import { rejectVariation } from './reject-variation.js';
import { completeVariation } from './complete-variation.js';
import type { AuthContext } from '@jobbuilda/contracts';

export function registerTools(server: Server) {
  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'create_variation',
        description: 'Create a new job variation with line items',
        inputSchema: {
          type: 'object',
          properties: {
            job_id: { type: 'string', description: 'Job UUID' },
            title: { type: 'string', description: 'Variation title' },
            description: { type: 'string', description: 'Variation description' },
            reason: {
              type: 'string',
              enum: ['client_request', 'site_conditions', 'design_change', 'compliance', 'other'],
              description: 'Reason for variation',
            },
            items: {
              type: 'array',
              description: 'Line items for the variation',
              items: {
                type: 'object',
                properties: {
                  item_type: {
                    type: 'string',
                    enum: ['material', 'labor', 'other'],
                    description: 'Type of item',
                  },
                  description: { type: 'string', description: 'Item description' },
                  quantity: { type: 'number', description: 'Quantity' },
                  unit: { type: 'string', description: 'Unit of measure' },
                  unit_price_ex_vat: { type: 'number', description: 'Unit price excluding VAT' },
                  vat_rate: { type: 'number', description: 'VAT rate (default 20.00)' },
                  material_id: { type: 'string', description: 'Material UUID if applicable' },
                },
                required: ['item_type', 'description', 'quantity', 'unit_price_ex_vat'],
              },
            },
          },
          required: ['job_id', 'title', 'description', 'items'],
        },
      },
      {
        name: 'approve_variation',
        description: 'Approve a pending variation',
        inputSchema: {
          type: 'object',
          properties: {
            variation_id: { type: 'string', description: 'Variation UUID' },
          },
          required: ['variation_id'],
        },
      },
      {
        name: 'reject_variation',
        description: 'Reject a pending variation with reason',
        inputSchema: {
          type: 'object',
          properties: {
            variation_id: { type: 'string', description: 'Variation UUID' },
            rejection_reason: { type: 'string', description: 'Reason for rejection' },
          },
          required: ['variation_id', 'rejection_reason'],
        },
      },
      {
        name: 'complete_variation',
        description: 'Mark an approved variation as completed',
        inputSchema: {
          type: 'object',
          properties: {
            variation_id: { type: 'string', description: 'Variation UUID' },
          },
          required: ['variation_id'],
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
      case 'create_variation':
        result = await createVariation(args as any, context);
        break;
      case 'approve_variation':
        result = await approveVariation(args as any, context);
        break;
      case 'reject_variation':
        result = await rejectVariation(args as any, context);
        break;
      case 'complete_variation':
        result = await completeVariation(args as any, context);
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
