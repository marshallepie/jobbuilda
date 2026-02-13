import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { trace } from '@opentelemetry/api';
import type { AuthContext } from '@jobbuilda/contracts';
import { randomUUID } from 'crypto';

const tracer = trace.getTracer('variations-mcp');

interface RejectVariationInput {
  variation_id: string;
  rejection_reason: string;
}

export async function rejectVariation(
  input: RejectVariationInput,
  context: AuthContext
): Promise<any> {
  return tracer.startActiveSpan('tool.reject_variation', async (span) => {
    try {
      span.setAttributes({
        'tenant.id': context.tenant_id,
        'variation.id': input.variation_id,
      });

      // Get variation
      const getResult = await query(
        `SELECT * FROM variations WHERE id = $1 AND tenant_id = $2`,
        [input.variation_id, context.tenant_id]
      );

      if (getResult.rows.length === 0) {
        throw new Error('Variation not found');
      }

      const variation = getResult.rows[0];

      if (variation.status !== 'pending') {
        throw new Error(`Cannot reject variation with status: ${variation.status}`);
      }

      // Update variation status
      const result = await query(
        `UPDATE variations
        SET status = 'rejected',
            rejected_at = NOW(),
            rejected_by = $1,
            rejection_reason = $2,
            updated_at = NOW()
        WHERE id = $3 AND tenant_id = $4
        RETURNING *`,
        [
          context.user_id,
          input.rejection_reason,
          input.variation_id,
          context.tenant_id,
        ]
      );

      // Publish event
      await publishEvent({
        id: randomUUID(),
        type: 'variations.variation_rejected',
        tenant_id: context.tenant_id,
        occurred_at: new Date().toISOString(),
        actor: { user_id: context.user_id },
        data: {
          variation_id: input.variation_id,
          variation_number: variation.variation_number,
          job_id: variation.job_id,
          rejection_reason: input.rejection_reason,
        },
        schema: 'urn:jobbuilda:events:variations.variation_rejected:1',
      });

      return result.rows[0];
    } finally {
      span.end();
    }
  });
}
