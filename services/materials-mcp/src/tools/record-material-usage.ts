import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { trace } from '@opentelemetry/api';
import type { AuthContext } from '@jobbuilda/contracts';
import { randomUUID } from 'crypto';

const tracer = trace.getTracer('materials-mcp');

interface RecordUsageInput {
  job_id: string;
  material_id: string;
  quantity_used: number;
  notes?: string;
}

export async function recordMaterialUsage(
  input: RecordUsageInput,
  context: AuthContext
): Promise<any> {
  return tracer.startActiveSpan('tool.record_material_usage', async (span) => {
    try {
      span.setAttributes({
        'tenant.id': context.tenant_id,
        'job.id': input.job_id,
        'material.id': input.material_id,
      });

      // Get job material assignment
      const assignmentResult = await query(
        `SELECT * FROM job_material_usage
        WHERE job_id = $1 AND material_id = $2 AND tenant_id = $3`,
        [input.job_id, input.material_id, context.tenant_id]
      );

      if (assignmentResult.rows.length === 0) {
        throw new Error('Material not assigned to this job. Use assign_material_to_job first.');
      }

      const assignment = assignmentResult.rows[0];

      // Update quantity used
      const updatedResult = await query(
        `UPDATE job_material_usage
        SET quantity_used = quantity_used + $1,
            notes = COALESCE(notes || E'\\n', '') || $2,
            updated_at = NOW()
        WHERE job_id = $3 AND material_id = $4 AND tenant_id = $5
        RETURNING *`,
        [
          input.quantity_used,
          input.notes || `Used ${input.quantity_used} on ${new Date().toISOString()}`,
          input.job_id,
          input.material_id,
          context.tenant_id,
        ]
      );

      const updated = updatedResult.rows[0];

      // Record transfer (negative quantity for usage, trigger will update stock)
      await query(
        `INSERT INTO material_transfers (
          tenant_id, material_id, transfer_type, quantity, job_id, reference, recorded_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          context.tenant_id,
          input.material_id,
          'usage',
          -input.quantity_used, // Negative for usage
          input.job_id,
          `Job usage`,
          context.user_id,
        ]
      );

      // Get material details
      const materialResult = await query(
        `SELECT * FROM materials WHERE id = $1`,
        [input.material_id]
      );

      const material = materialResult.rows[0];

      // Publish event
      await publishEvent({
        id: randomUUID(),
        type: 'materials.material_used',
        tenant_id: context.tenant_id,
        occurred_at: new Date().toISOString(),
        actor: { user_id: context.user_id },
        data: {
          job_id: input.job_id,
          material_id: input.material_id,
          sku: material.sku,
          quantity_used: input.quantity_used,
          total_used: parseFloat(updated.quantity_used),
          quantity_planned: parseFloat(updated.quantity_planned),
        },
        schema: 'urn:jobbuilda:events:materials.material_used:1',
      });

      return {
        ...updated,
        material: {
          sku: material.sku,
          name: material.name,
          unit: material.unit,
          current_stock: material.current_stock,
        },
      };
    } finally {
      span.end();
    }
  });
}
