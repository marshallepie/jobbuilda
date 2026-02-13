import dotenv from 'dotenv';
dotenv.config();

import { initTracing } from './lib/tracing.js';
import { runServer } from './server.js';

// Initialize OpenTelemetry
initTracing('variations-mcp');

// Start MCP server
runServer().catch((error) => {
  console.error('Fatal error starting variations-mcp:', error);
  process.exit(1);
});
