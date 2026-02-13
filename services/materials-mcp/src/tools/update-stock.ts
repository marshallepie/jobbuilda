import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { trace } from '@opentelemetry/api';
import type { AuthContext } from '@jobbuilda/contracts';
import { randomUUID } from 'crypto';

const tracer = trace.getTracer('materials-mcp');

interface UpdateStockInput {
  material_id: string;
  transfer_type: 'purchase' | 'adjustment' | 'return';
  quantity: number; // Positive for additions, negative for removals
  reference?: string; // PO number, invoice, etc.
  notes?: string;
}

export async function updateStock(
  input: UpdateStockInput,
  context: AuthContext
): Promise<any> {
  return tracer.startActiveSpan('tool.update_stock', async (span) => {
    try {
      span.setAttributes({
        'tenant.id': context.tenant_id,
        'material.id': input.material_id,
        'transfer.type': input.transfer_type,
      });

      // Verify material exists
      const materialResult = await query(
        `SELECT * FROM materials WHERE id = $1 AND tenant_id = $2`,
        [input.material_id, context.tenant_id]
      );

      if (materialResult.rows.length === 0) {
        throw new Error('Material not found');
      }

      const material = materialResult.rows[0];

      // Record transfer (trigger will update stock automatically)
      const transferResult = await query(
        `INSERT INTO material_transfers (
          tenant_id, material_id, transfer_type, quantity, reference, notes, recorded_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          context.tenant_id,
          input.material_id,
          input.transfer_type,
          input.quantity,
          input.reference || null,
          input.notes || null,
          context.user_id,
        ]
      );

      const transfer = transferResult.rows[0];

      // Get updated stock
      const updatedMaterial = await query(
        `SELECT * FROM materials WHERE id = $1`,
        [input.material_id]
      );

      // Publish event
      await publishEvent({
        id: randomUUID(),
        type: 'materials.stock_updated',
        tenant_id: context.tenant_id,
        occurred_at: new Date().toISOString(),
        actor: { user_id: context.user_id },
        data: {
          material_id: input.material_id,
          sku: material.sku,
          transfer_type: input.transfer_type,
          quantity: input.quantity,
          previous_stock: parseFloat(material.current_stock),
          new_stock: parseFloat(updatedMaterial.rows[0].current_stock),
        },
        schema: 'urn:jobbuilda:events:materials.stock_updated:1',
      });

      return {
        transfer,
        material: updatedMaterial.rows[0],
      };
    } finally {
      span.end();
    }
  });
}
