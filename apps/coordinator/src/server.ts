import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { MCPClient } from '@jobbuilda/mcp-sdk';
import { coordinatorCorsOptions } from './cors.js';
import { healthRoutes } from './routes/health.js';
import { identityRoutes } from './routes/identity.js';
import { clientsRoutes } from './routes/clients.js';
import { quotingRoutes } from './routes/quoting.js';
import { invoicingRoutes } from './routes/invoicing.js';
import {
  registerAccountIsolationContainment,
  sendContainmentBadUrlResponse,
} from './lib/account-isolation-containment.js';
import { registerServerAuth } from './lib/auth.js';
import { registerVerificationOwnerAccess } from './lib/verification-owner-access.js';
import {
  isBrowserRehearsalProfile,
  rejectBrowserRehearsalProfileFromNormalStart,
} from './lib/browser-rehearsal-profile.js';
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

export async function createServer({ browserRehearsal = false }: { browserRehearsal?: boolean } = {}) {
  if (browserRehearsal !== isBrowserRehearsalProfile()) {
    throw new Error('Browser rehearsal server mode must be selected only by the validated rehearsal entrypoint');
  }
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info'
    },
    routerOptions: {
      onBadUrl: (_path, _request, response) => sendContainmentBadUrlResponse(response),
    },
  });

  await fastify.register(cors, coordinatorCorsOptions(process.env, browserRehearsal));
  // Containment stays first: account-data routes remain paused until a separate
  // route-by-route audit explicitly allows this server-authenticated context.
  registerAccountIsolationContainment(fastify);
  registerServerAuth(fastify);
  registerVerificationOwnerAccess(fastify);

  let suppliersClient: MCPClient | undefined;
  let jobsClient: MCPClient | undefined;
  let materialsClient: MCPClient | undefined;
  let variationsClient: MCPClient | undefined;
  let testsClient: MCPClient | undefined;
  let paymentsClient: MCPClient | undefined;
  let reportingClient: MCPClient | undefined;

  // Initialize MCP clients
  const identityMcpPath = path.resolve(__dirname, '../../../services/identity-mcp');

  const identityClient = new MCPClient('identity-mcp', {
    command: 'node',
    args: [path.join(identityMcpPath, 'dist/index.js')],
    browserRehearsal,
    env: {
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://jobbuilda:jobbuilda@localhost:5432/identity_mcp',
      NATS_URL: process.env.NATS_URL || 'nats://localhost:4222',
      ...(!browserRehearsal ? { JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production' } : {}),
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
    browserRehearsal,
    env: {
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://jobbuilda:jobbuilda@localhost:5432/clients_mcp',
      NATS_URL: process.env.NATS_URL || 'nats://localhost:4222',
      OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
      OTEL_SERVICE_NAME: 'clients-mcp',
      NODE_ENV: process.env.NODE_ENV || 'development'
    }
  });

  // Connect to clients-mcp on startup
  await clientsClient.connect();
  fastify.log.info('Connected to clients-mcp');

  if (!browserRehearsal) {
  // Initialize suppliers-mcp client
  const suppliersMcpPath = path.resolve(__dirname, '../../../services/suppliers-mcp');

  suppliersClient = new MCPClient('suppliers-mcp', {
    command: 'node',
    args: [path.join(suppliersMcpPath, 'dist/index.js')],
    env: {
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://jobbuilda:jobbuilda@localhost:5432/suppliers_mcp',
      NATS_URL: process.env.NATS_URL || 'nats://localhost:4222',
      OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
      OTEL_SERVICE_NAME: 'suppliers-mcp',
      NODE_ENV: process.env.NODE_ENV || 'development'
    }
  });

  // Connect to suppliers-mcp on startup
  await suppliersClient.connect();
  fastify.log.info('Connected to suppliers-mcp');

  }

  // Initialize quoting-mcp client
  const quotingMcpPath = path.resolve(__dirname, '../../../services/quoting-mcp');

  const quotingClient = new MCPClient('quoting-mcp', {
    command: 'node',
    args: [path.join(quotingMcpPath, 'dist/index.js')],
    browserRehearsal,
    env: {
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://jobbuilda:jobbuilda@localhost:5432/quoting_mcp',
      NATS_URL: process.env.NATS_URL || 'nats://localhost:4222',
      OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
      OTEL_SERVICE_NAME: 'quoting-mcp',
      NODE_ENV: process.env.NODE_ENV || 'development'
    }
  });

  // Connect to quoting-mcp on startup
  await quotingClient.connect();
  fastify.log.info('Connected to quoting-mcp');

  if (!browserRehearsal) {
  // Initialize jobs-mcp client
  const jobsMcpPath = path.resolve(__dirname, '../../../services/jobs-mcp');

  jobsClient = new MCPClient('jobs-mcp', {
    command: 'node',
    args: [path.join(jobsMcpPath, 'dist/index.js')],
    env: {
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://jobbuilda:jobbuilda@localhost:5432/jobs_mcp',
      NATS_URL: process.env.NATS_URL || 'nats://localhost:4222',
      OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
      OTEL_SERVICE_NAME: 'jobs-mcp',
      NODE_ENV: process.env.NODE_ENV || 'development'
    }
  });

  // Connect to jobs-mcp on startup
  await jobsClient.connect();
  fastify.log.info('Connected to jobs-mcp');

  }

  if (!browserRehearsal) {
  // Initialize materials-mcp client
  const materialsMcpPath = path.resolve(__dirname, '../../../services/materials-mcp');

  materialsClient = new MCPClient('materials-mcp', {
    command: 'node',
    args: [path.join(materialsMcpPath, 'dist/index.js')],
    env: {
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://jobbuilda:jobbuilda@localhost:5432/materials_mcp',
      NATS_URL: process.env.NATS_URL || 'nats://localhost:4222',
      OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
      OTEL_SERVICE_NAME: 'materials-mcp',
      NODE_ENV: process.env.NODE_ENV || 'development'
    }
  });

  // Connect to materials-mcp on startup
  await materialsClient.connect();
  fastify.log.info('Connected to materials-mcp');

  }

  if (!browserRehearsal) {
  // Initialize variations-mcp client
  const variationsMcpPath = path.resolve(__dirname, '../../../services/variations-mcp');

  variationsClient = new MCPClient('variations-mcp', {
    command: 'node',
    args: [path.join(variationsMcpPath, 'dist/index.js')],
    env: {
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://jobbuilda:jobbuilda@localhost:5432/variations_mcp',
      NATS_URL: process.env.NATS_URL || 'nats://localhost:4222',
      OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
      OTEL_SERVICE_NAME: 'variations-mcp',
      NODE_ENV: process.env.NODE_ENV || 'development'
    }
  });

  // Connect to variations-mcp on startup
  await variationsClient.connect();
  fastify.log.info('Connected to variations-mcp');

  }

  if (!browserRehearsal) {
  // Initialize tests-mcp client
  const testsMcpPath = path.resolve(__dirname, '../../../services/tests-mcp');

  testsClient = new MCPClient('tests-mcp', {
    command: 'node',
    args: [path.join(testsMcpPath, 'dist/index.js')],
    env: {
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://jobbuilda:jobbuilda@localhost:5432/tests_mcp',
      NATS_URL: process.env.NATS_URL || 'nats://localhost:4222',
      OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
      OTEL_SERVICE_NAME: 'tests-mcp',
      NODE_ENV: process.env.NODE_ENV || 'development'
    }
  });

  // Connect to tests-mcp on startup
  await testsClient.connect();
  fastify.log.info('Connected to tests-mcp');

  }

  // Initialize invoicing-mcp client
  const invoicingMcpPath = path.resolve(__dirname, '../../../services/invoicing-mcp');

  const invoicingClient = new MCPClient('invoicing-mcp', {
    command: 'node',
    args: [path.join(invoicingMcpPath, 'dist/index.js')],
    browserRehearsal,
    env: {
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://jobbuilda:jobbuilda@localhost:5432/invoicing_mcp',
      NATS_URL: process.env.NATS_URL || 'nats://localhost:4222',
      OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
      OTEL_SERVICE_NAME: 'invoicing-mcp',
      NODE_ENV: process.env.NODE_ENV || 'development'
    }
  });

  // Connect to invoicing-mcp on startup
  await invoicingClient.connect();
  fastify.log.info('Connected to invoicing-mcp');

  if (!browserRehearsal) {
  // Initialize payments-mcp client
  const paymentsMcpPath = path.resolve(__dirname, '../../../services/payments-mcp');

  paymentsClient = new MCPClient('payments-mcp', {
    command: 'node',
    args: [path.join(paymentsMcpPath, 'dist/index.js')],
    env: {
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://jobbuilda:jobbuilda@localhost:5432/payments_mcp',
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

  }

  if (!browserRehearsal) {
  // Initialize reporting-mcp client
  const reportingMcpPath = path.resolve(__dirname, '../../../services/reporting-mcp');

  reportingClient = new MCPClient('reporting-mcp', {
    command: 'node',
    args: [path.join(reportingMcpPath, 'dist/index.js')],
    env: {
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://jobbuilda:jobbuilda@localhost:5432/reporting_mcp',
      NATS_URL: process.env.NATS_URL || 'nats://localhost:4222',
      OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
      OTEL_SERVICE_NAME: 'reporting-mcp',
      NODE_ENV: process.env.NODE_ENV || 'development'
    }
  });

  // Connect to reporting-mcp on startup
  await reportingClient.connect();
  fastify.log.info('Connected to reporting-mcp');

  }

  // Attach MCP clients to Fastify instance
  fastify.decorate('mcp', {
    identity: identityClient,
    clients: clientsClient,
    quoting: quotingClient,
    invoicing: invoicingClient,
    ...(!browserRehearsal ? {
      suppliers: suppliersClient!,
      jobs: jobsClient!,
      materials: materialsClient!,
      variations: variationsClient!,
      tests: testsClient!,
      payments: paymentsClient!,
      reporting: reportingClient!,
    } : {}),
  } as FastifyInstance['mcp']);

  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    await identityClient.disconnect();
    await clientsClient.disconnect();
    await suppliersClient?.disconnect();
    await quotingClient.disconnect();
    await jobsClient?.disconnect();
    await materialsClient?.disconnect();
    await variationsClient?.disconnect();
    await testsClient?.disconnect();
    await invoicingClient.disconnect();
    await paymentsClient?.disconnect();
    await reportingClient?.disconnect();
    fastify.log.info('Disconnected from all MCP servers');
  });

  // Register routes
  await fastify.register(healthRoutes);
  await fastify.register(identityRoutes);
  await fastify.register(clientsRoutes);
  await fastify.register(quotingRoutes);
  await fastify.register(invoicingRoutes);
  if (!browserRehearsal) {
    const [
      { suppliersRoutes }, { jobsRoutes }, { materialsRoutes }, { variationsRoutes },
      { testsRoutes }, { paymentsRoutes }, { reportingRoutes }, { previewRoutes },
      { pdfRoutes }, { emailRoutes }, { subscriptionRoutes }, { subscriptionWebhookRoutes },
      { quoteDepositWebhookRoutes }, { shareRoutes }, { receiptsRoutes }, { clientPortalRoutes },
    ] = await Promise.all([
      import('./routes/suppliers.js'), import('./routes/jobs.js'), import('./routes/materials.js'), import('./routes/variations.js'),
      import('./routes/tests.js'), import('./routes/payments.js'), import('./routes/reporting.js'), import('./routes/preview.js'),
      import('./routes/pdf.js'), import('./routes/email.js'), import('./routes/subscription.js'), import('./routes/subscription-webhook.js'),
      import('./routes/quote-deposit-webhook.js'), import('./routes/share.js'), import('./routes/receipts.js'), import('./routes/client-portal.js'),
    ]);
    await fastify.register(suppliersRoutes);
    await fastify.register(jobsRoutes);
    await fastify.register(materialsRoutes);
    await fastify.register(variationsRoutes);
    await fastify.register(testsRoutes);
    await fastify.register(paymentsRoutes);
    await fastify.register(reportingRoutes);
    await fastify.register(previewRoutes);
    await fastify.register(pdfRoutes);
    await fastify.register(emailRoutes);
    await fastify.register(subscriptionRoutes);
    await fastify.register(subscriptionWebhookRoutes);
    await fastify.register(quoteDepositWebhookRoutes);
    await fastify.register(shareRoutes);
    await fastify.register(receiptsRoutes);
    await fastify.register(clientPortalRoutes);
  }

  return fastify;
}

export async function startServer() {
  rejectBrowserRehearsalProfileFromNormalStart();
  const fastify = await createServer();
  const port = parseInt(process.env.PORT || '3000', 10);
  const host = process.env.HOST || '0.0.0.0';

  try {
    await fastify.listen({ port, host });
    console.log(`Coordinator listening on http://${host}:${port}`);

    if (!isBrowserRehearsalProfile()) {
      // Warm up Chrome in the background — downloads ~170 MB on first deploy
      // so PDF requests don't time out on first use
      const { warmUpBrowser } = await import('./lib/pdf.js');
      warmUpBrowser().catch((err) =>
        console.warn('[pdf] Background browser warm-up failed:', err.message)
      );
    }
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}
