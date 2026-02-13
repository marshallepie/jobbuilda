import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { handleMaterialResource } from './material.js';
import { handleJobUsageResource } from './job-usage.js';
import { handleAlertsResource } from './alerts.js';
import type { AuthContext } from '@jobbuilda/contracts';

export function registerResources(server: Server) {
  // List available resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: 'res://materials/materials',
        mimeType: 'application/json',
        name: 'List all materials',
        description: 'Get all materials in the catalog with stock levels',
      },
      {
        uri: 'res://materials/materials/{id}',
        mimeType: 'application/json',
        name: 'Get material by ID',
        description: 'Get a specific material with recent transfer history',
      },
      {
        uri: 'res://materials/job-usage/{job_id}',
        mimeType: 'application/json',
        name: 'Get job material usage',
        description: 'Get all materials used on a specific job with planned vs actual',
      },
      {
        uri: 'res://materials/alerts',
        mimeType: 'application/json',
        name: 'Get stock alerts',
        description: 'Get all active low stock and out of stock alerts',
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

    // Route to appropriate handler
    if (uri.startsWith('res://materials/materials')) {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(await handleMaterialResource(uri, context)),
          },
        ],
      };
    }

    if (uri.startsWith('res://materials/job-usage/')) {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(await handleJobUsageResource(uri, context)),
          },
        ],
      };
    }

    if (uri.startsWith('res://materials/alerts')) {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(await handleAlertsResource(uri, context)),
          },
        ],
      };
    }

    throw new Error(`Unknown resource URI: ${uri}`);
  });
}
