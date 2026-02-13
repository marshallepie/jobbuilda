import dotenv from 'dotenv';
import { initTracing } from './lib/tracing.js';
import { connectToNATS, closeNATS } from './lib/event-bus.js';
import { closeDatabase } from './lib/database.js';
import { runServer } from './server.js';

// Load environment variables
dotenv.config();

async function main() {
  // Initialize tracing
  initTracing('jobs-mcp');

  // Connect to NATS
  try {
    await connectToNATS();
  } catch (error) {
    console.error('Failed to connect to NATS:', error);
    console.error('Continuing without event bus');
  }

  // Handle graceful shutdown
  const shutdown = async () => {
    console.error('Shutting down jobs-mcp...');
    await closeNATS();
    await closeDatabase();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start MCP server
  await runServer();
}

main().catch((error) => {
  console.error('Fatal error in jobs-mcp:', error);
  process.exit(1);
});
