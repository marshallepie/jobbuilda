import dotenv from 'dotenv';
import { initTracing } from './lib/tracing.js';
import { startServer } from './server.js';

// Load environment variables
dotenv.config();

// Initialize OpenTelemetry
initTracing('coordinator');

// Start the server
startServer().catch((error) => {
  console.error('Failed to start coordinator:', error);
  process.exit(1);
});
