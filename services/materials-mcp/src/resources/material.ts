import { query } from '../lib/database.js';
import { trace } from '@opentelemetry/api';
import type { AuthContext } from '@jobbuilda/contracts';

const tracer = trace.getTracer('materials-mcp');

interface MaterialResourceArgs {
  material_id?: string;
}

export async function handleMaterialResource(
  uri: string,
  context: AuthContext
): Promise<any> {
  return tracer.startActiveSpan('resource.material', async (span) => {
    try {
      span.setAttributes({
        'resource.uri': uri,
        'tenant.id': context.tenant_id,
      });

      // List all materials: res://materials/materials
      if (uri === 'res://materials/materials') {
        const result = await query(
          `SELECT
            m.*,
            CASE
              WHEN m.min_stock_level IS NOT NULL AND m.current_stock <= m.min_stock_level
              THEN true
              ELSE false
            END as is_low_stock
          FROM materials m
          WHERE m.tenant_id = $1
          ORDER BY m.name`,
          [context.tenant_id]
        );

        return {
          data: result.rows,
          _meta: { context },
        };
      }

      // Get single material: res://materials/materials/{id}
      const materialMatch = uri.match(/^res:\/\/materials\/materials\/([a-f0-9-]+)$/);
      if (materialMatch) {
        const materialId = materialMatch[1];

        const result = await query(
          `SELECT
            m.*,
            CASE
              WHEN m.min_stock_level IS NOT NULL AND m.current_stock <= m.min_stock_level
              THEN true
              ELSE false
            END as is_low_stock,
            (
              SELECT json_agg(
                json_build_object(
                  'id', sub.id,
                  'transfer_type', sub.transfer_type,
                  'quantity', sub.quantity,
                  'reference', sub.reference,
                  'recorded_at', sub.recorded_at
                )
              )
              FROM (
                SELECT id, transfer_type, quantity, reference, recorded_at
                FROM material_transfers
                WHERE material_id = m.id
                ORDER BY recorded_at DESC
                LIMIT 10
              ) sub
            ) as recent_transfers
          FROM materials m
          WHERE m.id = $1 AND m.tenant_id = $2`,
          [materialId, context.tenant_id]
        );

        if (result.rows.length === 0) {
          throw new Error('Material not found');
        }

        return {
          data: result.rows[0],
          _meta: { context },
        };
      }

      throw new Error(`Unknown material resource URI: ${uri}`);
    } finally {
      span.end();
    }
  });
}
