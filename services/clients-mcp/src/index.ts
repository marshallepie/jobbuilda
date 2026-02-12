import dotenv from 'dotenv';
import { initTracing } from './lib/tracing.js';
import { startServer } from './server.js';
import { closeDatabase } from './lib/database.js';
import { closeNATS } from './lib/event-bus.js';

// Load environment variables
dotenv.config();

// Initialize OpenTelemetry
initTracing('clients-mcp');

// Graceful shutdown handler
async function shutdown() {
  console.error('Shutting down clients-mcp...');
  await closeNATS();
  await closeDatabase();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the MCP server
startServer().catch((error) => {
  console.error('Failed to start clients-mcp:', error);
  process.exit(1);
});
