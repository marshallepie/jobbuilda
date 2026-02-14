import Fastify from 'fastify';
import cors from '@fastify/cors';
import { MCPClient } from '@jobbuilda/mcp-sdk';
import { healthRoutes } from './routes/health.js';
import { identityRoutes } from './routes/identity.js';
import { clientsRoutes } from './routes/clients.js';
import { suppliersRoutes } from './routes/suppliers.js';
import { quotingRoutes } from './routes/quoting.js';
import { jobsRoutes } from './routes/jobs.js';
import { materialsRoutes } from './routes/materials.js';
import { variationsRoutes } from './routes/variations.js';
import { testsRoutes } from './routes/tests.js';
import { invoicingRoutes } from './routes/invoicing.js';
import { paymentsRoutes } from './routes/payments.js';
import { reportingRoutes } from './routes/reporting.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extend Fastify instance type to include MCP clients
declare module 'fastify' {
  interface FastifyInstance {
    mcp: {
      identity: MCPClient;
      clients: MCPClient;
      suppliers: MCPClient;
      quoting: MCPClient;
      jobs: MCPClient;
      materials: MCPClient;
      variations: MCPClient;
      tests: MCPClient;
      invoicing: MCPClient;
      payments: MCPClient;
      reporting: MCPClient;
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
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://jobbuilda:jobbuilda@localhost:5435/identity_mcp',
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

  // Initialize clients-mcp client
  const clientsMcpPath = path.resolve(__dirname, '../../../services/clients-mcp');

  const clientsClient = new MCPClient('clients-mcp', {
    command: 'node',
    args: [path.join(clientsMcpPath, 'dist/index.js')],
    env: {
      DATABASE_URL: process.env.CLIENTS_DATABASE_URL || 'postgresql://jobbuilda:jobbuilda@127.0.0.1:5435/clients_mcp',
      NATS_URL: process.env.NATS_URL || 'nats://localhost:4222',
      OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
      OTEL_SERVICE_NAME: 'clients-mcp',
      NODE_ENV: process.env.NODE_ENV || 'development'
    }
  });

  // Connect to clients-mcp on startup
  await clientsClient.connect();
  fastify.log.info('Connected to clients-mcp');

  // Initialize suppliers-mcp client
  const suppliersMcpPath = path.resolve(__dirname, '../../../services/suppliers-mcp');

  const suppliersClient = new MCPClient('suppliers-mcp', {
    command: 'node',
    args: [path.join(suppliersMcpPath, 'dist/index.js')],
    env: {
      DATABASE_URL: process.env.SUPPLIERS_DATABASE_URL || 'postgresql://jobbuilda:jobbuilda@127.0.0.1:5435/suppliers_mcp',
      NATS_URL: process.env.NATS_URL || 'nats://localhost:4222',
      OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
      OTEL_SERVICE_NAME: 'suppliers-mcp',
      NODE_ENV: process.env.NODE_ENV || 'development'
    }
  });

  // Connect to suppliers-mcp on startup
  await suppliersClient.connect();
  fastify.log.info('Connected to suppliers-mcp');

  // Initialize quoting-mcp client
  const quotingMcpPath = path.resolve(__dirname, '../../../services/quoting-mcp');

  const quotingClient = new MCPClient('quoting-mcp', {
    command: 'node',
    args: [path.join(quotingMcpPath, 'dist/index.js')],
    env: {
      DATABASE_URL: process.env.QUOTING_DATABASE_URL || 'postgresql://jobbuilda:jobbuilda@127.0.0.1:5435/quoting_mcp',
      NATS_URL: process.env.NATS_URL || 'nats://localhost:4222',
      OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
      OTEL_SERVICE_NAME: 'quoting-mcp',
      NODE_ENV: process.env.NODE_ENV || 'development'
    }
  });

  // Connect to quoting-mcp on startup
  await quotingClient.connect();
  fastify.log.info('Connected to quoting-mcp');

  // Initialize jobs-mcp client
  const jobsMcpPath = path.resolve(__dirname, '../../../services/jobs-mcp');

  const jobsClient = new MCPClient('jobs-mcp', {
    command: 'node',
    args: [path.join(jobsMcpPath, 'dist/index.js')],
    env: {
      DATABASE_URL: process.env.JOBS_DATABASE_URL || 'postgresql://jobbuilda:jobbuilda@127.0.0.1:5435/jobs_mcp',
      NATS_URL: process.env.NATS_URL || 'nats://localhost:4222',
      OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
      OTEL_SERVICE_NAME: 'jobs-mcp',
      NODE_ENV: process.env.NODE_ENV || 'development'
    }
  });

  // Connect to jobs-mcp on startup
  await jobsClient.connect();
  fastify.log.info('Connected to jobs-mcp');

  // Initialize materials-mcp client
  const materialsMcpPath = path.resolve(__dirname, '../../../services/materials-mcp');

  const materialsClient = new MCPClient('materials-mcp', {
    command: 'node',
    args: [path.join(materialsMcpPath, 'dist/index.js')],
    env: {
      DATABASE_URL: process.env.MATERIALS_DATABASE_URL || 'postgresql://jobbuilda:jobbuilda@127.0.0.1:5435/materials_mcp',
      NATS_URL: process.env.NATS_URL || 'nats://localhost:4222',
      OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
      OTEL_SERVICE_NAME: 'materials-mcp',
      NODE_ENV: process.env.NODE_ENV || 'development'
    }
  });

  // Connect to materials-mcp on startup
  await materialsClient.connect();
  fastify.log.info('Connected to materials-mcp');

  // Initialize variations-mcp client
  const variationsMcpPath = path.resolve(__dirname, '../../../services/variations-mcp');

  const variationsClient = new MCPClient('variations-mcp', {
    command: 'node',
    args: [path.join(variationsMcpPath, 'dist/index.js')],
    env: {
      DATABASE_URL: process.env.VARIATIONS_DATABASE_URL || 'postgresql://jobbuilda:jobbuilda@127.0.0.1:5435/variations_mcp',
      NATS_URL: process.env.NATS_URL || 'nats://localhost:4222',
      OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
      OTEL_SERVICE_NAME: 'variations-mcp',
      NODE_ENV: process.env.NODE_ENV || 'development'
    }
  });

  // Connect to variations-mcp on startup
  await variationsClient.connect();
  fastify.log.info('Connected to variations-mcp');

  // Initialize tests-mcp client
  const testsMcpPath = path.resolve(__dirname, '../../../services/tests-mcp');

  const testsClient = new MCPClient('tests-mcp', {
    command: 'node',
    args: [path.join(testsMcpPath, 'dist/index.js')],
    env: {
      DATABASE_URL: process.env.TESTS_DATABASE_URL || 'postgresql://jobbuilda:jobbuilda@127.0.0.1:5435/tests_mcp',
      NATS_URL: process.env.NATS_URL || 'nats://localhost:4222',
      OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
      OTEL_SERVICE_NAME: 'tests-mcp',
      NODE_ENV: process.env.NODE_ENV || 'development'
    }
  });

  // Connect to tests-mcp on startup
  await testsClient.connect();
  fastify.log.info('Connected to tests-mcp');

  // Initialize invoicing-mcp client
  const invoicingMcpPath = path.resolve(__dirname, '../../../services/invoicing-mcp');

  const invoicingClient = new MCPClient('invoicing-mcp', {
    command: 'node',
    args: [path.join(invoicingMcpPath, 'dist/index.js')],
    env: {
      DATABASE_URL: process.env.INVOICING_DATABASE_URL || 'postgresql://jobbuilda:jobbuilda@127.0.0.1:5435/invoicing_mcp',
      NATS_URL: process.env.NATS_URL || 'nats://localhost:4222',
      OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
      OTEL_SERVICE_NAME: 'invoicing-mcp',
      NODE_ENV: process.env.NODE_ENV || 'development'
    }
  });

  // Connect to invoicing-mcp on startup
  await invoicingClient.connect();
  fastify.log.info('Connected to invoicing-mcp');

  // Initialize payments-mcp client
  const paymentsMcpPath = path.resolve(__dirname, '../../../services/payments-mcp');

  const paymentsClient = new MCPClient('payments-mcp', {
    command: 'node',
    args: [path.join(paymentsMcpPath, 'dist/index.js')],
    env: {
      DATABASE_URL: process.env.PAYMENTS_DATABASE_URL || 'postgresql://jobbuilda:jobbuilda@127.0.0.1:5435/payments_mcp',
      NATS_URL: process.env.NATS_URL || 'nats://localhost:4222',
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || 'sk_test_fake_key',
      OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
      OTEL_SERVICE_NAME: 'payments-mcp',
      NODE_ENV: process.env.NODE_ENV || 'development'
    }
  });

  // Connect to payments-mcp on startup
  await paymentsClient.connect();
  fastify.log.info('Connected to payments-mcp');

  // Initialize reporting-mcp client
  const reportingMcpPath = path.resolve(__dirname, '../../../services/reporting-mcp');

  const reportingClient = new MCPClient('reporting-mcp', {
    command: 'node',
    args: [path.join(reportingMcpPath, 'dist/index.js')],
    env: {
      DATABASE_URL: process.env.REPORTING_DATABASE_URL || 'postgresql://jobbuilda:jobbuilda@127.0.0.1:5435/reporting_mcp',
      NATS_URL: process.env.NATS_URL || 'nats://localhost:4222',
      OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
      OTEL_SERVICE_NAME: 'reporting-mcp',
      NODE_ENV: process.env.NODE_ENV || 'development'
    }
  });

  // Connect to reporting-mcp on startup
  await reportingClient.connect();
  fastify.log.info('Connected to reporting-mcp');

  // Attach MCP clients to Fastify instance
  fastify.decorate('mcp', {
    identity: identityClient,
    clients: clientsClient,
    suppliers: suppliersClient,
    quoting: quotingClient,
    jobs: jobsClient,
    materials: materialsClient,
    variations: variationsClient,
    tests: testsClient,
    invoicing: invoicingClient,
    payments: paymentsClient,
    reporting: reportingClient
  });

  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    await identityClient.disconnect();
    await clientsClient.disconnect();
    await suppliersClient.disconnect();
    await quotingClient.disconnect();
    await jobsClient.disconnect();
    await materialsClient.disconnect();
    await variationsClient.disconnect();
    await testsClient.disconnect();
    await invoicingClient.disconnect();
    await paymentsClient.disconnect();
    await reportingClient.disconnect();
    fastify.log.info('Disconnected from all MCP servers');
  });

  // Register routes
  await fastify.register(healthRoutes);
  await fastify.register(identityRoutes);
  await fastify.register(clientsRoutes);
  await fastify.register(suppliersRoutes);
  await fastify.register(quotingRoutes);
  await fastify.register(jobsRoutes);
  await fastify.register(materialsRoutes);
  await fastify.register(variationsRoutes);
  await fastify.register(testsRoutes);
  await fastify.register(invoicingRoutes);
  await fastify.register(paymentsRoutes);
  await fastify.register(reportingRoutes);

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
