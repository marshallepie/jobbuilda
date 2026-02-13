import { query } from '../lib/database.js';
import { trace } from '@opentelemetry/api';
import type { AuthContext } from '@jobbuilda/contracts';

const tracer = trace.getTracer('materials-mcp');

export async function handleJobUsageResource(
  uri: string,
  context: AuthContext
): Promise<any> {
  return tracer.startActiveSpan('resource.job-usage', async (span) => {
    try {
      span.setAttributes({
        'resource.uri': uri,
        'tenant.id': context.tenant_id,
      });

      // Get materials for a job: res://materials/job-usage/{job_id}
      const jobMatch = uri.match(/^res:\/\/materials\/job-usage\/([a-f0-9-]+)$/);
      if (jobMatch) {
        const jobId = jobMatch[1];

        const result = await query(
          `SELECT
            jmu.*,
            m.sku,
            m.name,
            m.description,
            m.unit,
            m.current_stock,
            (jmu.quantity_used * jmu.unit_cost) as total_cost,
            (jmu.quantity_planned - jmu.quantity_used) as quantity_variance
          FROM job_material_usage jmu
          JOIN materials m ON m.id = jmu.material_id
          WHERE jmu.job_id = $1 AND jmu.tenant_id = $2
          ORDER BY m.name`,
          [jobId, context.tenant_id]
        );

        return {
          data: {
            job_id: jobId,
            materials: result.rows,
            summary: {
              total_materials: result.rows.length,
              total_cost: result.rows.reduce((sum, row) => sum + parseFloat(row.total_cost || 0), 0),
              total_planned: result.rows.reduce((sum, row) => sum + parseFloat(row.quantity_planned || 0), 0),
              total_used: result.rows.reduce((sum, row) => sum + parseFloat(row.quantity_used || 0), 0),
            },
          },
          _meta: { context },
        };
      }

      throw new Error(`Unknown job usage resource URI: ${uri}`);
    } finally {
      span.end();
    }
  });
}
