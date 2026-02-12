import dotenv from 'dotenv';
import { initTracing } from './lib/tracing.js';
import { startServer } from './server.js';
import { closeDatabase } from './lib/database.js';
import { closeNATS } from './lib/event-bus.js';

// Load environment variables
dotenv.config();

// Initialize OpenTelemetry
initTracing('identity-mcp');

// Graceful shutdown handler
async function shutdown() {
  console.error('Shutting down identity-mcp...');
  await closeNATS();
  await closeDatabase();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the MCP server
startServer().catch((error) => {
  console.error('Failed to start identity-mcp:', error);
  process.exit(1);
});
