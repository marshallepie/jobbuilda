import dotenv from 'dotenv';
import { initTracing } from './lib/tracing.js';
import { rejectBrowserRehearsalProfileFromNormalStart } from './lib/browser-rehearsal-profile.js';
import { startServer } from './server.js';

// Load environment variables
dotenv.config();
rejectBrowserRehearsalProfileFromNormalStart();

// Initialize OpenTelemetry
initTracing('coordinator');

// Start the server
startServer().catch((error) => {
  console.error('Failed to start coordinator:', error);
  process.exit(1);
});
