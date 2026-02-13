import dotenv from 'dotenv';
dotenv.config();

import { initTracing } from './lib/tracing.js';
import { runServer } from './server.js';

// Initialize OpenTelemetry
initTracing('tests-mcp');

// Start MCP server
runServer().catch((error) => {
  console.error('Fatal error starting tests-mcp:', error);
  process.exit(1);
});
