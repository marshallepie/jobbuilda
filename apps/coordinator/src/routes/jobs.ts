import { FastifyInstance, FastifyRequest } from 'fastify';
import { extractAuthContext } from '../lib/auth.js';

export async function jobsRoutes(fastify: FastifyInstance) {
  // GET /api/jobs - List all jobs
  fastify.get('/api/jobs', async (request: FastifyRequest, reply) => {
    const context = extractAuthContext(request);
    const uri = 'res://jobs/jobs';
    try {
      const result = await fastify.mcp.jobs.readResource(uri, context);
      return result.data;
    } catch (error: any) {
      reply.status(500).send({ error: 'Failed to list jobs', message: error.message });
    }
  });

  // GET /api/jobs/:id - Get job by ID with details
  fastify.get<{ Params: { id: string } }>(
    '/api/jobs/:id',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      const uri = `res://jobs/jobs/${id}`;
      try {
        const result = await fastify.mcp.jobs.readResource(uri, context);
        return result.data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to fetch job', message: error.message });
      }
    }
  );

  // GET /api/jobs/by-client/:clientId - List jobs by client
  fastify.get<{ Params: { clientId: string } }>(
    '/api/jobs/by-client/:clientId',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { clientId } = request.params;
      const uri = `res://jobs/jobs/by-client/${clientId}`;
      try {
        const result = await fastify.mcp.jobs.readResource(uri, context);
        return result.data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to list jobs by client', message: error.message });
      }
    }
  );

  // POST /api/jobs - Create job from quote
  fastify.post<{ Body: Record<string, unknown> }>(
    '/api/jobs',
    async (request, reply) => {
      const context = extractAuthContext(request);
      try {
        // Step 1: Create the job
        const result = await fastify.mcp.jobs.callTool(
          'create_job_from_quote',
          request.body,
          context
        );
        const job = JSON.parse(result.content[0]?.text || '{}');

        // Step 2: Update the quote with the job_id
        const { quote_id } = request.body as { quote_id: string };
        if (quote_id && job.id) {
          try {
            await fastify.mcp.quoting.callTool(
              'update_quote',
              { quote_id, job_id: job.id },
              context
            );
          } catch (updateError: any) {
            fastify.log.warn(`Failed to update quote ${quote_id} with job_id: ${updateError.message}`);
          }
        }

        return job;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to create job', message: error.message });
      }
    }
  );

  // POST /api/jobs/:id/start - Start job
  fastify.post<{ Params: { id: string } }>(
    '/api/jobs/:id/start',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      try {
        const result = await fastify.mcp.jobs.callTool(
          'start_job',
          { job_id: id },
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to start job', message: error.message });
      }
    }
  );

  // POST /api/jobs/:id/complete - Complete job
  fastify.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/jobs/:id/complete',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      try {
        const args: Record<string, unknown> = { job_id: id, ...request.body };
        const result = await fastify.mcp.jobs.callTool(
          'complete_job',
          args,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to complete job', message: error.message });
      }
    }
  );

  // POST /api/jobs/:id/time - Log time entry
  fastify.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/jobs/:id/time',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      try {
        const args: Record<string, unknown> = { job_id: id, ...request.body };
        const result = await fastify.mcp.jobs.callTool(
          'log_time',
          args,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to log time', message: error.message });
      }
    }
  );
}
