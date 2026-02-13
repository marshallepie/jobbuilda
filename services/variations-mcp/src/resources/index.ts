import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { handleVariationResource } from './variation.js';
import type { AuthContext } from '@jobbuilda/contracts';

export function registerResources(server: Server) {
  // List available resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: 'res://variations/variations',
        mimeType: 'application/json',
        name: 'List all variations',
        description: 'Get all job variations with status',
      },
      {
        uri: 'res://variations/variations/{id}',
        mimeType: 'application/json',
        name: 'Get variation by ID',
        description: 'Get a specific variation with line items',
      },
      {
        uri: 'res://variations/job-variations/{job_id}',
        mimeType: 'application/json',
        name: 'Get variations for a job',
        description: 'Get all variations for a specific job with summary',
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
    if (uri.startsWith('res://variations/')) {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(await handleVariationResource(uri, context)),
          },
        ],
      };
    }

    throw new Error(`Unknown resource URI: ${uri}`);
  });
}
