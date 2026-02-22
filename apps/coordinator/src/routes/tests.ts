import { FastifyInstance, FastifyRequest } from 'fastify';
import { extractAuthContext } from '../lib/auth.js';

export async function testsRoutes(fastify: FastifyInstance) {
  // GET /api/tests - List all tests
  fastify.get('/api/tests', async (request: FastifyRequest, reply) => {
    const context = extractAuthContext(request);
    const uri = 'res://tests/tests';
    try {
      const result = await fastify.mcp.tests.readResource(uri, context);
      return result.data;
    } catch (error: any) {
      reply.status(500).send({ error: 'Failed to list tests', message: error.message });
    }
  });

  // GET /api/tests/standards - Get measurement standards (MUST come before /:id route)
  fastify.get<{ Querystring: { measurement_type: string; circuit_type?: string; circuit_rating?: string } }>(
    '/api/tests/standards',
    async (request, reply) => {
      const context = extractAuthContext(request);
      try {
        const result = await fastify.mcp.tests.callTool(
          'get_measurement_standards',
          request.query,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to get measurement standards', message: error.message });
      }
    }
  );

  // GET /api/tests/:id - Get test by ID
  fastify.get<{ Params: { id: string } }>(
    '/api/tests/:id',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      const uri = `res://tests/tests/${id}`;
      try {
        const result = await fastify.mcp.tests.readResource(uri, context);
        return result.data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to fetch test', message: error.message });
      }
    }
  );

  // GET /api/tests/job/:jobId - Get tests for a job
  fastify.get<{ Params: { jobId: string } }>(
    '/api/tests/job/:jobId',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { jobId } = request.params;
      const uri = `res://tests/job-tests/${jobId}`;
      try {
        const result = await fastify.mcp.tests.readResource(uri, context);
        return result.data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to fetch job tests', message: error.message });
      }
    }
  );

  // POST /api/tests - Create new test
  fastify.post<{ Body: Record<string, unknown> }>(
    '/api/tests',
    async (request, reply) => {
      const context = extractAuthContext(request);
      try {
        const result = await fastify.mcp.tests.callTool(
          'create_test',
          request.body,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to create test', message: error.message });
      }
    }
  );

  // POST /api/tests/:id/measurements - Add measurement to test
  fastify.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/tests/:id/measurements',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      try {
        const args: Record<string, unknown> = { test_id: id, ...request.body };
        const result = await fastify.mcp.tests.callTool(
          'add_measurement',
          args,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to add measurement', message: error.message });
      }
    }
  );

  // POST /api/tests/:id/complete - Complete test
  fastify.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/tests/:id/complete',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      try {
        const args: Record<string, unknown> = { test_id: id, ...request.body };
        const result = await fastify.mcp.tests.callTool(
          'complete_test',
          args,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to complete test', message: error.message });
      }
    }
  );

  // POST /api/tests/:id/certificate - Generate certificate
  fastify.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/tests/:id/certificate',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      try {
        const args: Record<string, unknown> = { test_id: id, ...request.body };
        const result = await fastify.mcp.tests.callTool(
          'generate_certificate',
          args,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to generate certificate', message: error.message });
      }
    }
  );

  // GET /api/tests/:id/certificates/:certId/download - Get signed download URL
  fastify.get<{ Params: { id: string; certId: string } }>(
    '/api/tests/:id/certificates/:certId/download',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { certId } = request.params;
      try {
        const args: Record<string, unknown> = { certificate_id: certId };
        const result = await fastify.mcp.tests.callTool(
          'get_certificate_download_url',
          args,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to get download URL', message: error.message });
      }
    }
  );

  // POST /api/tests/:id/circuits - Create circuit
  fastify.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/tests/:id/circuits',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      try {
        const args: Record<string, unknown> = { test_id: id, ...request.body };
        const result = await fastify.mcp.tests.callTool(
          'create_circuit',
          args,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to create circuit', message: error.message });
      }
    }
  );

  // PUT /api/tests/:id/circuits/:circuitId - Update circuit measurements
  fastify.put<{ Params: { id: string; circuitId: string }; Body: Record<string, unknown> }>(
    '/api/tests/:id/circuits/:circuitId',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { circuitId } = request.params;
      try {
        const args: Record<string, unknown> = { circuit_id: circuitId, ...request.body };
        const result = await fastify.mcp.tests.callTool(
          'update_circuit_measurements',
          args,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to update circuit measurements', message: error.message });
      }
    }
  );

  // POST /api/tests/:id/circuits/bulk - Bulk create circuits from job
  fastify.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/tests/:id/circuits/bulk',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      try {
        const args: Record<string, unknown> = { test_id: id, ...request.body };
        const result = await fastify.mcp.tests.callTool(
          'bulk_create_circuits_from_job',
          args,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to bulk create circuits', message: error.message });
      }
    }
  );

  // POST /api/tests/:id/inspections - Add inspection item
  fastify.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/tests/:id/inspections',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      try {
        const args: Record<string, unknown> = { test_id: id, ...request.body };
        const result = await fastify.mcp.tests.callTool(
          'add_inspection_item',
          args,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to add inspection item', message: error.message });
      }
    }
  );
}
