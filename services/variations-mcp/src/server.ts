import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerResources } from './resources/index.js';
import { registerTools } from './tools/index.js';

export async function createServer() {
  const server = new Server(
    {
      name: 'variations-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    }
  );

  // Register resources and tools
  registerResources(server);
  registerTools(server);

  return server;
}

export async function runServer() {
  const server = await createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('variations-mcp server running on stdio');
}
