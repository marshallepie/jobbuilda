import dotenv from 'dotenv';
dotenv.config();

import { initTracing } from './lib/tracing.js';
import { initEventBus } from './lib/event-bus.js';
import { runServer } from './server.js';

async function main() {
  // Initialize OpenTelemetry
  initTracing('payments-mcp');

  // Initialize NATS (optional for MVP)
  try {
    await initEventBus();
  } catch (error) {
    console.error('NATS connection failed, continuing without event bus:', error.message);
  }

  // Start MCP server
  await runServer();
}

main().catch((error) => {
  console.error('Fatal error starting payments-mcp:', error);
  process.exit(1);
});
