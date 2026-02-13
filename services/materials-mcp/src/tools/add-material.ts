import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { trace } from '@opentelemetry/api';
import type { AuthContext } from '@jobbuilda/contracts';
import { randomUUID } from 'crypto';

const tracer = trace.getTracer('materials-mcp');

interface AddMaterialInput {
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unit: string;
  unit_cost: number;
  initial_stock?: number;
  min_stock_level?: number;
  reorder_quantity?: number;
  supplier_id?: string;
  supplier_sku?: string;
}

export async function addMaterial(
  input: AddMaterialInput,
  context: AuthContext
): Promise<any> {
  return tracer.startActiveSpan('tool.add_material', async (span) => {
    try {
      span.setAttributes({
        'tenant.id': context.tenant_id,
        'material.sku': input.sku,
      });

      const materialId = randomUUID();
      const initialStock = input.initial_stock || 0;

      // Insert material
      const result = await query(
        `INSERT INTO materials (
          id, tenant_id, sku, name, description, category, unit,
          unit_cost, current_stock, min_stock_level, reorder_quantity,
          supplier_id, supplier_sku
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          materialId,
          context.tenant_id,
          input.sku,
          input.name,
          input.description || null,
          input.category || null,
          input.unit,
          input.unit_cost,
          initialStock,
          input.min_stock_level || null,
          input.reorder_quantity || null,
          input.supplier_id || null,
          input.supplier_sku || null,
        ]
      );

      const material = result.rows[0];

      // If initial stock provided, record as a transfer
      if (initialStock > 0) {
        await query(
          `INSERT INTO material_transfers (
            tenant_id, material_id, transfer_type, quantity, reference, recorded_by
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            context.tenant_id,
            materialId,
            'adjustment',
            initialStock,
            'Initial stock',
            context.user_id,
          ]
        );
      }

      // Publish event
      await publishEvent({
        id: randomUUID(),
        type: 'materials.material_added',
        tenant_id: context.tenant_id,
        occurred_at: new Date().toISOString(),
        actor: { user_id: context.user_id },
        data: {
          material_id: materialId,
          sku: input.sku,
          name: input.name,
          initial_stock: initialStock,
        },
        schema: 'urn:jobbuilda:events:materials.material_added:1',
      });

      return material;
    } finally {
      span.end();
    }
  });
}
