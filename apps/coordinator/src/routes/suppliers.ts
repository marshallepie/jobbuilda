import { FastifyInstance, FastifyRequest } from 'fastify';
import { extractAuthContext } from '../lib/auth.js';

export async function suppliersRoutes(fastify: FastifyInstance) {
  // GET /api/suppliers - List all suppliers
  fastify.get('/api/suppliers', async (request: FastifyRequest, reply) => {
    const context = extractAuthContext(request);
    const uri = 'res://suppliers/suppliers';
    try {
      const result = await fastify.mcp.suppliers.readResource(uri, context);
      return result.data;
    } catch (error: any) {
      reply.status(500).send({ error: 'Failed to list suppliers', message: error.message });
    }
  });

  // GET /api/suppliers/:id - Get supplier by ID
  fastify.get<{ Params: { id: string } }>(
    '/api/suppliers/:id',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      const uri = `res://suppliers/suppliers/${id}`;
      try {
        const result = await fastify.mcp.suppliers.readResource(uri, context);
        return result.data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to fetch supplier', message: error.message });
      }
    }
  );

  // POST /api/suppliers - Create supplier
  fastify.post<{ Body: Record<string, unknown> }>(
    '/api/suppliers',
    async (request, reply) => {
      const context = extractAuthContext(request);
      try {
        const result = await fastify.mcp.suppliers.callTool(
          'create_supplier',
          request.body,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to create supplier', message: error.message });
      }
    }
  );

  // GET /api/suppliers/:supplierId/products - List products by supplier
  fastify.get<{ Params: { supplierId: string } }>(
    '/api/suppliers/:supplierId/products',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { supplierId } = request.params;
      const uri = `res://suppliers/products/by-supplier/${supplierId}`;
      try {
        const result = await fastify.mcp.suppliers.readResource(uri, context);
        return result.data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to list products', message: error.message });
      }
    }
  );

  // GET /api/products/:id - Get product by ID
  fastify.get<{ Params: { id: string } }>(
    '/api/products/:id',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      const uri = `res://suppliers/products/${id}`;
      try {
        const result = await fastify.mcp.suppliers.readResource(uri, context);
        return result.data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to fetch product', message: error.message });
      }
    }
  );

  // GET /api/products/search/:term - Search products
  fastify.get<{ Params: { term: string } }>(
    '/api/products/search/:term',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { term } = request.params;
      const uri = `res://suppliers/products/search/${encodeURIComponent(term)}`;
      try {
        const result = await fastify.mcp.suppliers.readResource(uri, context);
        return result.data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to search products', message: error.message });
      }
    }
  );

  // POST /api/products - Create product
  fastify.post<{ Body: Record<string, unknown> }>(
    '/api/products',
    async (request, reply) => {
      const context = extractAuthContext(request);
      try {
        const result = await fastify.mcp.suppliers.callTool(
          'create_product',
          request.body,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to create product', message: error.message });
      }
    }
  );

  // PATCH /api/products/:id/price - Update product price
  fastify.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/products/:id/price',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { id } = request.params;
      try {
        const args: Record<string, unknown> = { product_id: id, ...request.body };
        const result = await fastify.mcp.suppliers.callTool(
          'update_price',
          args,
          context
        );
        const data = JSON.parse(result.content[0]?.text || '{}');
        return data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to update price', message: error.message });
      }
    }
  );

  // GET /api/products/sku/:supplierId/:sku - Get product by SKU
  fastify.get<{ Params: { supplierId: string; sku: string } }>(
    '/api/products/sku/:supplierId/:sku',
    async (request, reply) => {
      const context = extractAuthContext(request);
      const { supplierId, sku } = request.params;
      const uri = `res://suppliers/products/by-sku/${supplierId}/${sku}`;
      try {
        const result = await fastify.mcp.suppliers.readResource(uri, context);
        return result.data;
      } catch (error: any) {
        reply.status(500).send({ error: 'Failed to fetch product by SKU', message: error.message });
      }
    }
  );
}
