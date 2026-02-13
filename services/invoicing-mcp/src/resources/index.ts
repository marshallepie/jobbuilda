import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { handleInvoiceResource } from './invoice.js';
import type { AuthContext } from '@jobbuilda/contracts';

export function registerResources(server: Server) {
  // List available resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: 'res://invoicing/invoices',
        mimeType: 'application/json',
        name: 'List all invoices',
        description: 'Get all invoices with status',
      },
      {
        uri: 'res://invoicing/invoices/{id}',
        mimeType: 'application/json',
        name: 'Get invoice by ID',
        description: 'Get a specific invoice with line items',
      },
      {
        uri: 'res://invoicing/job-invoices/{job_id}',
        mimeType: 'application/json',
        name: 'Get invoices for a job',
        description: 'Get all invoices for a specific job with summary',
      },
    ],
  }));

  // Read resource handler
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    const context = (request.params as any)._meta?.context as AuthContext;

    if (!context?.tenant_id) {
      throw new Error('Missing authentication context');
    }

    // Route to handler
    if (uri.startsWith('res://invoicing/')) {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(await handleInvoiceResource(uri, context)),
          },
        ],
      };
    }

    throw new Error(`Unknown resource URI: ${uri}`);
  });
}
