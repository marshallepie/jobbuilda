import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { trace } from '@opentelemetry/api';
import type { AuthContext } from '@jobbuilda/contracts';
import { randomUUID } from 'crypto';

const tracer = trace.getTracer('variations-mcp');

interface ApproveVariationInput {
  variation_id: string;
}

export async function approveVariation(
  input: ApproveVariationInput,
  context: AuthContext
): Promise<any> {
  return tracer.startActiveSpan('tool.approve_variation', async (span) => {
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
        throw new Error(`Cannot approve variation with status: ${variation.status}`);
      }

      // Update variation status
      const result = await query(
        `UPDATE variations
        SET status = 'approved',
            approved_at = NOW(),
            approved_by = $1,
            updated_at = NOW()
        WHERE id = $2 AND tenant_id = $3
        RETURNING *`,
        [context.user_id, input.variation_id, context.tenant_id]
      );

      // Publish event
      await publishEvent({
        id: randomUUID(),
        type: 'variations.variation_approved',
        tenant_id: context.tenant_id,
        occurred_at: new Date().toISOString(),
        actor: { user_id: context.user_id },
        data: {
          variation_id: input.variation_id,
          variation_number: variation.variation_number,
          job_id: variation.job_id,
          total_inc_vat: parseFloat(variation.total_inc_vat),
        },
        schema: 'urn:jobbuilda:events:variations.variation_approved:1',
      });

      return result.rows[0];
    } finally {
      span.end();
    }
  });
}
