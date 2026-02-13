import { query } from '../lib/database.js';
import { trace } from '@opentelemetry/api';
import type { AuthContext } from '@jobbuilda/contracts';

const tracer = trace.getTracer('variations-mcp');

export async function handleVariationResource(
  uri: string,
  context: AuthContext
): Promise<any> {
  return tracer.startActiveSpan('resource.variation', async (span) => {
    try {
      span.setAttributes({
        'resource.uri': uri,
        'tenant.id': context.tenant_id,
      });

      // List all variations: res://variations/variations
      if (uri === 'res://variations/variations') {
        const result = await query(
          `SELECT * FROM variations
          WHERE tenant_id = $1
          ORDER BY created_at DESC`,
          [context.tenant_id]
        );

        return {
          data: result.rows,
          _meta: { context },
        };
      }

      // Get single variation: res://variations/variations/{id}
      const variationMatch = uri.match(/^res:\/\/variations\/variations\/([a-f0-9-]+)$/);
      if (variationMatch) {
        const variationId = variationMatch[1];

        const variationResult = await query(
          `SELECT * FROM variations
          WHERE id = $1 AND tenant_id = $2`,
          [variationId, context.tenant_id]
        );

        if (variationResult.rows.length === 0) {
          throw new Error('Variation not found');
        }

        const itemsResult = await query(
          `SELECT * FROM variation_items
          WHERE variation_id = $1 AND tenant_id = $2
          ORDER BY created_at`,
          [variationId, context.tenant_id]
        );

        return {
          data: {
            ...variationResult.rows[0],
            items: itemsResult.rows,
          },
          _meta: { context },
        };
      }

      // Get variations for a job: res://variations/job-variations/{job_id}
      const jobMatch = uri.match(/^res:\/\/variations\/job-variations\/([a-f0-9-]+)$/);
      if (jobMatch) {
        const jobId = jobMatch[1];

        const result = await query(
          `SELECT * FROM variations
          WHERE job_id = $1 AND tenant_id = $2
          ORDER BY created_at DESC`,
          [jobId, context.tenant_id]
        );

        return {
          data: {
            job_id: jobId,
            variations: result.rows,
            summary: {
              total_variations: result.rows.length,
              pending: result.rows.filter(v => v.status === 'pending').length,
              approved: result.rows.filter(v => v.status === 'approved').length,
              rejected: result.rows.filter(v => v.status === 'rejected').length,
              completed: result.rows.filter(v => v.status === 'completed').length,
              total_value: result.rows
                .filter(v => v.status === 'approved' || v.status === 'completed')
                .reduce((sum, v) => sum + parseFloat(v.total_inc_vat || 0), 0),
            },
          },
          _meta: { context },
        };
      }

      throw new Error(`Unknown variation resource URI: ${uri}`);
    } finally {
      span.end();
    }
  });
}
