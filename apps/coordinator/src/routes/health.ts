import { FastifyInstance } from 'fastify';
import { getPool } from '../lib/db.js';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (_request, reply) => {
    const timestamp = new Date().toISOString();

    try {
      const db = getPool();
      await db.query('SELECT 1 AS ok');

      return {
        status: 'ok',
        service: 'coordinator',
        version: '2.0.0',
        timestamp,
        checks: {
          database: 'ok'
        }
      };
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Health check database probe failed');

      return reply.status(503).send({
        status: 'degraded',
        service: 'coordinator',
        version: '2.0.0',
        timestamp,
        checks: {
          database: 'error'
        },
        error: {
          message: error?.message || 'Database connectivity check failed'
        }
      });
    }
  });
}
