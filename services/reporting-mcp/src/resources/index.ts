import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ReadResourceRequestSchema,
  ListResourcesRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { handleProfitLossResource } from './profit-loss.js';
import { handleVatReturnResource } from './vat-return.js';

export function registerResources(server: Server) {
  server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
    return {
      resources: [
        {
          uri: 'res://reporting/profit-loss?start={date}&end={date}',
          name: 'Profit & Loss Report',
          description: 'Generate P&L report for date range',
          mimeType: 'application/json',
        },
        {
          uri: 'res://reporting/vat-returns',
          name: 'VAT Returns',
          description: 'List all VAT returns',
          mimeType: 'application/json',
        },
        {
          uri: 'res://reporting/vat-returns/{id}',
          name: 'VAT Return',
          description: 'Get VAT return by ID',
          mimeType: 'application/json',
        },
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    const context = (request.params as any)?._meta?.context;

    let data;
    if (uri.startsWith('res://reporting/profit-loss')) {
      data = await handleProfitLossResource(uri, context);
    } else if (uri.startsWith('res://reporting/vat-returns')) {
      data = await handleVatReturnResource(uri, context);
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
