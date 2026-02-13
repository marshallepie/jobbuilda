import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { trace } from '@opentelemetry/api';
import type { AuthContext } from '@jobbuilda/contracts';
import { randomUUID } from 'crypto';

const tracer = trace.getTracer('variations-mcp');

interface CompleteVariationInput {
  variation_id: string;
}

export async function completeVariation(
  input: CompleteVariationInput,
  context: AuthContext
): Promise<any> {
  return tracer.startActiveSpan('tool.complete_variation', async (span) => {
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

      if (variation.status !== 'approved') {
        throw new Error(`Cannot complete variation with status: ${variation.status}. Must be approved first.`);
      }

      // Update variation status
      const result = await query(
        `UPDATE variations
        SET status = 'completed',
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2
        RETURNING *`,
        [input.variation_id, context.tenant_id]
      );

      // Publish event
      await publishEvent({
        id: randomUUID(),
        type: 'variations.variation_completed',
        tenant_id: context.tenant_id,
        occurred_at: new Date().toISOString(),
        actor: { user_id: context.user_id },
        data: {
          variation_id: input.variation_id,
          variation_number: variation.variation_number,
          job_id: variation.job_id,
          total_inc_vat: parseFloat(variation.total_inc_vat),
        },
        schema: 'urn:jobbuilda:events:variations.variation_completed:1',
      });

      return result.rows[0];
    } finally {
      span.end();
    }
  });
}
