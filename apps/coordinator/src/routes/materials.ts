import { FastifyInstance, FastifyRequest } from 'fastify';
import { extractAuthContext } from '../lib/auth.js';

export async function materialsRoutes(fastify: FastifyInstance) {
  // GET /api/materials - List all materials
  fastify.get('/api/materials', async (request: FastifyRequest, reply) => {
    const context = extractAuthContext(request);
    const uri = 'res://materials/materials';
    try {
      const result = await fastify.mcp.materials.readResource(uri, context);
      // MCP resources return { data: { data: [...], _meta: {...} } }
      // Extract the actual array from result.data.data
      const materials = (result.data as any)?.data || result.data || [];
      return materials;
    } catch (error: any) {
      reply.status(500).send({ error: 'Failed to list materials', message: error.message });
    }
  });

  // GET /api/materials/:id - Get material by ID
  fastify.get<{ Params: { id: string } }>(
    '/api/materials/:id',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      const uri = `res://materials/materials/${id}`;
      try {
        const result = await fastify.mcp.materials.readResource(uri, context);
        return result.data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to fetch material', message: error.message });
      }
    }
  );

  // GET /api/materials/job-usage/:jobId - Get materials for a job
  fastify.get<{ Params: { jobId: string } }>(
    '/api/materials/job-usage/:jobId',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { jobId } = request.params;
      const uri = `res://materials/job-usage/${jobId}`;
      try {
        const result = await fastify.mcp.materials.readResource(uri, context);
        return result.data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to fetch job materials', message: error.message });
      }
    }
  );

  // GET /api/materials/alerts - Get active stock alerts
  fastify.get('/api/materials/alerts', async (request: FastifyRequest, reply) => {
    const context = extractAuthContext(request);
    const uri = 'res://materials/alerts';
    try {
      const result = await fastify.mcp.materials.readResource(uri, context);
      return result.data;
    } catch (error: any) {
      reply.status(500).send({ error: 'Failed to fetch alerts', message: error.message });
    }
  });

  // POST /api/materials - Add new material
  fastify.post<{ Body: Record<string, unknown> }>(
    '/api/materials',
    async (request, reply) => {
      const context = extractAuthContext(request);
      try {
        const result = await fastify.mcp.materials.callTool(
          'add_material',
          request.body,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to add material', message: error.message });
      }
    }
  );

  // POST /api/materials/:id/stock - Update material stock
  fastify.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/materials/:id/stock',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      try {
        const args: Record<string, unknown> = { material_id: id, ...request.body };
        const result = await fastify.mcp.materials.callTool(
          'update_stock',
          args,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to update stock', message: error.message });
      }
    }
  );

  // POST /api/materials/assign - Assign material to job
  fastify.post<{ Body: Record<string, unknown> }>(
    '/api/materials/assign',
    async (request, reply) => {
      const context = extractAuthContext(request);
      try {
        const result = await fastify.mcp.materials.callTool(
          'assign_material_to_job',
          request.body,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to assign material', message: error.message });
      }
    }
  );

  // POST /api/materials/usage - Record material usage (simplified for field use)
  fastify.post<{ Body: Record<string, unknown> }>(
    '/api/materials/usage',
    async (request, reply) => {
      const context = extractAuthContext(request);
      try {
        const body = request.body as any;

        // Get material_id from SKU if not provided
        let materialId = body.material_id;
        if (!materialId && body.sku) {
          // Look up material by SKU using MCP resource
          const materialsUri = 'res://materials/materials';
          const result = await fastify.mcp.materials.readResource(materialsUri, context);

          // Extract materials array from nested structure
          const materials = (result.data as any)?.data || result.data || [];

          if (!Array.isArray(materials)) {
            console.error('[POST /api/materials/usage] Materials is not an array:', materials);
            reply.status(500).send({ error: 'Invalid materials data structure' });
            return;
          }

          const material = materials.find((m: any) => m.sku === body.sku);

          if (!material) {
            reply.status(404).send({
              error: 'Material not found',
              message: `No material found with SKU: ${body.sku}`
            });
            return;
          }

          materialId = material.id;
        }

        if (!materialId) {
          reply.status(400).send({ error: 'Missing material identifier', message: 'Either material_id or sku must be provided' });
          return;
        }

        const quantity = body.quantity || body.quantity_used;

        // First, ensure material is assigned to the job (if not already)
        try {
          await fastify.mcp.materials.callTool(
            'assign_material_to_job',
            {
              job_id: body.job_id,
              material_id: materialId,
              quantity_planned: quantity,
              notes: body.notes,
            },
            context
          );
        } catch (assignError: any) {
          // If already assigned (duplicate key error), that's fine, continue
          if (!assignError.message?.includes('duplicate key') &&
              !assignError.message?.includes('already exists')) {
            // Re-throw if it's not a duplicate key error
            console.warn('Material assignment warning:', assignError.message);
          }
        }

        // Now record the usage
        const result = await fastify.mcp.materials.callTool(
          'record_material_usage',
          {
            job_id: body.job_id,
            material_id: materialId,
            quantity_used: quantity,
            notes: body.notes,
          },
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to record usage', message: error.message });
      }
    }
  );
}
