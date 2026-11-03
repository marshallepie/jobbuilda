import dotenv from 'dotenv';
import { startNatsCapture } from './lib/nats-capture.js';
import { preflightBrowserRehearsal } from './lib/browser-rehearsal-profile.js';
import { createServer } from './server.js';

const protectedEnvFile = process.env.JOBBUILDA_REHEARSAL_ENV_FILE;
if (!protectedEnvFile) {
  throw new Error('JOBBUILDA_REHEARSAL_ENV_FILE must name a protected external environment file');
}
const loaded = dotenv.config({ path: protectedEnvFile });
if (loaded.error) throw loaded.error;

const configuration = preflightBrowserRehearsal();
const capture = await startNatsCapture();
process.env.NATS_URL = capture.url;
process.env.HOST = configuration.host;

let fastify: Awaited<ReturnType<typeof createServer>> | undefined;
let closing = false;
async function close(exitCode: number): Promise<void> {
  if (closing) return;
  closing = true;
  try {
    await fastify?.close();
    await capture.close();
    process.exit(exitCode);
  } catch (error) {
    console.error('Browser rehearsal shutdown failed:', error);
    process.exit(1);
  }
}

try {
  fastify = await createServer();
  await fastify.listen({ host: configuration.host, port: configuration.port });
  console.log(`Browser rehearsal coordinator listening on http://${configuration.host}:${configuration.port}`);
  console.log(`Browser rehearsal event capture listening on ${capture.url} (no consumers)`);
} catch (error) {
  await capture.close().catch(() => undefined);
  throw error;
}

process.once('SIGINT', () => { void close(0); });
process.once('SIGTERM', () => { void close(0); });
