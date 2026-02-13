import { initTracing } from './lib/tracing.js';
import { connectToNATS, closeNATS } from './lib/event-bus.js';
import { closeDatabase } from './lib/database.js';
import { runServer } from './server.js';

async function main() {
  // Initialize tracing
  initTracing('suppliers-mcp');

  // Connect to NATS
  try {
    await connectToNATS();
  } catch (error) {
    console.error('Failed to connect to NATS:', error);
    console.error('Continuing without event bus');
  }

  // Handle graceful shutdown
  const shutdown = async () => {
    console.error('Shutting down suppliers-mcp...');
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
  console.error('Fatal error in suppliers-mcp:', error);
  process.exit(1);
});
