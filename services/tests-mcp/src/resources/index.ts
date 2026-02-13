import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { handleTestResource } from './test.js';
import type { AuthContext } from '@jobbuilda/contracts';

export function registerResources(server: Server) {
  // List available resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: 'res://tests/tests',
        mimeType: 'application/json',
        name: 'List all tests',
        description: 'Get all compliance tests with status',
      },
      {
        uri: 'res://tests/tests/{id}',
        mimeType: 'application/json',
        name: 'Get test by ID',
        description: 'Get a specific test with measurements and certificates',
      },
      {
        uri: 'res://tests/job-tests/{job_id}',
        mimeType: 'application/json',
        name: 'Get tests for a job',
        description: 'Get all tests for a specific job with summary',
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
    if (uri.startsWith('res://tests/')) {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(await handleTestResource(uri, context)),
          },
        ],
      };
    }

    throw new Error(`Unknown resource URI: ${uri}`);
  });
}
