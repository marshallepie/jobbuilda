import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { tools, handleToolCall } from './tools/index.js';
import { resources, handleResourceRead } from './resources/index.js';

export function createMCPServer(): Server {
  const server = new Server(
    {
      name: 'suppliers-mcp',
      version: '1.0.0'
    },
    {
      capabilities: {
        resources: {},
        tools: {}
      }
    }
  );

  // List available resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources };
  });

  // Read resource
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const result = await handleResourceRead(uri, request.params);
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  });

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  // Call tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const result = await handleToolCall(name, args || {});
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  });

  return server;
}

export async function runServer(): Promise<void> {
  const server = createMCPServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('suppliers-mcp server running on stdio');
}
