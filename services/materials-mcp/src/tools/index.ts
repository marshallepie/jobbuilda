import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { addMaterial } from './add-material.js';
import { updateStock } from './update-stock.js';
import { assignMaterialToJob } from './assign-material-to-job.js';
import { recordMaterialUsage } from './record-material-usage.js';
import type { AuthContext } from '@jobbuilda/contracts';

export function registerTools(server: Server) {
  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'add_material',
        description: 'Add a new material to the catalog',
        inputSchema: {
          type: 'object',
          properties: {
            sku: { type: 'string', description: 'Material SKU/product code' },
            name: { type: 'string', description: 'Material name' },
            description: { type: 'string', description: 'Material description' },
            category: { type: 'string', description: 'Material category' },
            unit: { type: 'string', description: 'Unit of measure (metre, unit, box, roll)' },
            unit_cost: { type: 'number', description: 'Cost per unit' },
            initial_stock: { type: 'number', description: 'Initial stock quantity' },
            min_stock_level: { type: 'number', description: 'Minimum stock level for alerts' },
            reorder_quantity: { type: 'number', description: 'Recommended reorder quantity' },
            supplier_id: { type: 'string', description: 'Supplier UUID' },
            supplier_sku: { type: 'string', description: 'Supplier SKU' },
          },
          required: ['sku', 'name', 'unit', 'unit_cost'],
        },
      },
      {
        name: 'update_stock',
        description: 'Update material stock levels (purchase, adjustment, return)',
        inputSchema: {
          type: 'object',
          properties: {
            material_id: { type: 'string', description: 'Material UUID' },
            transfer_type: {
              type: 'string',
              enum: ['purchase', 'adjustment', 'return'],
              description: 'Type of stock transfer',
            },
            quantity: {
              type: 'number',
              description: 'Quantity change (positive for additions, negative for removals)',
            },
            reference: { type: 'string', description: 'Reference (PO, invoice, etc.)' },
            notes: { type: 'string', description: 'Additional notes' },
          },
          required: ['material_id', 'transfer_type', 'quantity'],
        },
      },
      {
        name: 'assign_material_to_job',
        description: 'Assign planned materials to a job',
        inputSchema: {
          type: 'object',
          properties: {
            job_id: { type: 'string', description: 'Job UUID' },
            material_id: { type: 'string', description: 'Material UUID' },
            quantity_planned: { type: 'number', description: 'Planned quantity' },
            notes: { type: 'string', description: 'Notes' },
          },
          required: ['job_id', 'material_id', 'quantity_planned'],
        },
      },
      {
        name: 'record_material_usage',
        description: 'Record actual material used on a job',
        inputSchema: {
          type: 'object',
          properties: {
            job_id: { type: 'string', description: 'Job UUID' },
            material_id: { type: 'string', description: 'Material UUID' },
            quantity_used: { type: 'number', description: 'Quantity actually used' },
            notes: { type: 'string', description: 'Usage notes' },
          },
          required: ['job_id', 'material_id', 'quantity_used'],
        },
      },
    ],
  }));

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const context = (args as any)?._meta?.context as AuthContext;

    if (!context?.tenant_id) {
      throw new Error('Missing authentication context');
    }

    let result: any;

    switch (name) {
      case 'add_material':
        result = await addMaterial(args as any, context);
        break;
      case 'update_stock':
        result = await updateStock(args as any, context);
        break;
      case 'assign_material_to_job':
        result = await assignMaterialToJob(args as any, context);
        break;
      case 'record_material_usage':
        result = await recordMaterialUsage(args as any, context);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  });
}
