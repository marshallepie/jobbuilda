import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { tools, handleToolCall } from './tools/index.js';
import { resources, handleResourceRead } from './resources/index.js';
import { connectToNATS } from './lib/event-bus.js';

export async function createServer(): Promise<Server> {
  const server = new Server(
    {
      name: 'identity-mcp',
      version: '2.0.0'
    },
    {
      capabilities: {
        resources: {},
        tools: {}
      }
    }
  );

  // Initialize NATS connection
  await connectToNATS();

  // List resources handler
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: resources
  }));

  // Read resource handler
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const data = await handleResourceRead(request.params.uri, request.params);
    return {
      contents: [{
        uri: request.params.uri,
        mimeType: 'application/json',
        text: JSON.stringify(data)
      }]
    };
  });

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools
  }));

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const result = await handleToolCall(
      request.params.name,
      request.params.arguments
    );

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result)
      }]
    };
  });

  return server;
}

export async function startServer(): Promise<void> {
  const server = await createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('identity-mcp server running on stdio');
}
