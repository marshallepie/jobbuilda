import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { trace } from '@opentelemetry/api';
import type { AuthContext } from '@jobbuilda/contracts';
import { randomUUID } from 'crypto';

const tracer = trace.getTracer('materials-mcp');

interface AssignMaterialInput {
  job_id: string;
  material_id: string;
  quantity_planned: number;
  notes?: string;
}

export async function assignMaterialToJob(
  input: AssignMaterialInput,
  context: AuthContext
): Promise<any> {
  return tracer.startActiveSpan('tool.assign_material_to_job', async (span) => {
    try {
      span.setAttributes({
        'tenant.id': context.tenant_id,
        'job.id': input.job_id,
        'material.id': input.material_id,
      });

      // Get material with current cost
      const materialResult = await query(
        `SELECT * FROM materials WHERE id = $1 AND tenant_id = $2`,
        [input.material_id, context.tenant_id]
      );

      if (materialResult.rows.length === 0) {
        throw new Error('Material not found');
      }

      const material = materialResult.rows[0];

      // Insert or update job material usage
      const result = await query(
        `INSERT INTO job_material_usage (
          tenant_id, job_id, material_id, quantity_planned, unit_cost, notes
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (tenant_id, job_id, material_id)
        DO UPDATE SET
          quantity_planned = EXCLUDED.quantity_planned,
          notes = EXCLUDED.notes,
          updated_at = NOW()
        RETURNING *`,
        [
          context.tenant_id,
          input.job_id,
          input.material_id,
          input.quantity_planned,
          material.unit_cost,
          input.notes || null,
        ]
      );

      const jobMaterial = result.rows[0];

      // Publish event
      await publishEvent({
        id: randomUUID(),
        type: 'materials.material_assigned_to_job',
        tenant_id: context.tenant_id,
        occurred_at: new Date().toISOString(),
        actor: { user_id: context.user_id },
        data: {
          job_id: input.job_id,
          material_id: input.material_id,
          sku: material.sku,
          quantity_planned: input.quantity_planned,
        },
        schema: 'urn:jobbuilda:events:materials.material_assigned_to_job:1',
      });

      return {
        ...jobMaterial,
        material: {
          sku: material.sku,
          name: material.name,
          unit: material.unit,
        },
      };
    } finally {
      span.end();
    }
  });
}
