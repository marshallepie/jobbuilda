import Fastify from 'fastify';
import cors from '@fastify/cors';
import { MCPClient } from '@jobbuilda/mcp-sdk';
import { healthRoutes } from './routes/health.js';
import { identityRoutes } from './routes/identity.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extend Fastify instance type to include MCP clients
declare module 'fastify' {
  interface FastifyInstance {
    mcp: {
      identity: MCPClient;
    };
  }
}

export async function createServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info'
    }
  });

  // Enable CORS
  await fastify.register(cors, {
    origin: true
  });

  // Initialize MCP clients
  const identityMcpCwd = process.env.IDENTITY_MCP_CWD ||
    path.resolve(__dirname, '../../../services/identity-mcp');

  const identityMcpPath = path.resolve(__dirname, '../../../services/identity-mcp');

  const identityClient = new MCPClient('identity-mcp', {
    command: 'node',
    args: [path.join(identityMcpPath, 'dist/index.js')],
    env: {
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://jobbuilda:jobbuilda@localhost:5432/identity_mcp',
      NATS_URL: process.env.NATS_URL || 'nats://localhost:4222',
      JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production',
      OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
      OTEL_SERVICE_NAME: 'identity-mcp',
      NODE_ENV: process.env.NODE_ENV || 'development'
    }
  });

  // Connect to identity-mcp on startup
  await identityClient.connect();
  fastify.log.info('Connected to identity-mcp');

  // Attach MCP clients to Fastify instance
  fastify.decorate('mcp', {
    identity: identityClient
  });

  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    await identityClient.disconnect();
    fastify.log.info('Disconnected from identity-mcp');
  });

  // Register routes
  await fastify.register(healthRoutes);
  await fastify.register(identityRoutes);

  return fastify;
}

export async function startServer() {
  const fastify = await createServer();
  const port = parseInt(process.env.PORT || '3000', 10);
  const host = process.env.HOST || '0.0.0.0';

  try {
    await fastify.listen({ port, host });
    console.log(`Coordinator listening on http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}
