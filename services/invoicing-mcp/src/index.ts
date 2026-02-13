import dotenv from 'dotenv';
dotenv.config();

import { initTracing } from './lib/tracing.js';
import { runServer } from './server.js';

// Initialize OpenTelemetry
initTracing('invoicing-mcp');

// Start MCP server
runServer().catch((error) => {
  console.error('Fatal error starting invoicing-mcp:', error);
  process.exit(1);
});
