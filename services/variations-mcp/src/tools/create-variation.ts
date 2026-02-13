import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { trace } from '@opentelemetry/api';
import type { AuthContext } from '@jobbuilda/contracts';
import { randomUUID } from 'crypto';

const tracer = trace.getTracer('variations-mcp');

interface VariationItem {
  item_type: 'material' | 'labor' | 'other';
  description: string;
  quantity: number;
  unit?: string;
  unit_price_ex_vat: number;
  vat_rate?: number;
  material_id?: string;
}

interface CreateVariationInput {
  job_id: string;
  title: string;
  description: string;
  reason?: string;
  items: VariationItem[];
}

export async function createVariation(
  input: CreateVariationInput,
  context: AuthContext
): Promise<any> {
  return tracer.startActiveSpan('tool.create_variation', async (span) => {
    try {
      span.setAttributes({
        'tenant.id': context.tenant_id,
        'job.id': input.job_id,
      });

      const variationId = randomUUID();

      // Generate variation number
      const numberResult = await query(
        `SELECT generate_variation_number($1) as number`,
        [context.tenant_id]
      );
      const variationNumber = numberResult.rows[0].number;

      // Insert variation
      const variationResult = await query(
        `INSERT INTO variations (
          id, tenant_id, variation_number, job_id, title, description, reason,
          status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          variationId,
          context.tenant_id,
          variationNumber,
          input.job_id,
          input.title,
          input.description,
          input.reason || 'other',
          'pending',
          context.user_id,
        ]
      );

      const variation = variationResult.rows[0];

      // Insert variation items with VAT calculations
      const items = [];
      for (const item of input.items) {
        const vatRate = item.vat_rate || 20.00;
        const lineTotal = item.quantity * item.unit_price_ex_vat;
        const lineVat = Math.round(lineTotal * (vatRate / 100) * 100) / 100;
        const lineTotalIncVat = lineTotal + lineVat;

        const itemResult = await query(
          `INSERT INTO variation_items (
            tenant_id, variation_id, item_type, description, quantity, unit,
            unit_price_ex_vat, line_total_ex_vat, vat_rate, line_vat,
            line_total_inc_vat, material_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING *`,
          [
            context.tenant_id,
            variationId,
            item.item_type,
            item.description,
            item.quantity,
            item.unit || 'unit',
            item.unit_price_ex_vat,
            lineTotal,
            vatRate,
            lineVat,
            lineTotalIncVat,
            item.material_id || null,
          ]
        );

        items.push(itemResult.rows[0]);
      }

      // Get updated variation with totals
      const updatedResult = await query(
        `SELECT * FROM variations WHERE id = $1`,
        [variationId]
      );

      const result = {
        ...updatedResult.rows[0],
        items,
      };

      // Publish event
      await publishEvent({
        id: randomUUID(),
        type: 'variations.variation_created',
        tenant_id: context.tenant_id,
        occurred_at: new Date().toISOString(),
        actor: { user_id: context.user_id },
        data: {
          variation_id: variationId,
          variation_number: variationNumber,
          job_id: input.job_id,
          total_inc_vat: parseFloat(result.total_inc_vat),
        },
        schema: 'urn:jobbuilda:events:variations.variation_created:1',
      });

      return result;
    } finally {
      span.end();
    }
  });
}
