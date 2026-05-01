import { trace } from '@opentelemetry/api';
import { query } from '../lib/database.js';
import { AuthContext } from '@jobbuilda/contracts';

export interface SelectEngagementOptionInput {
  quote_id: string;
  engagement_type: 'option_a' | 'option_b' | 'option_c';
  selected_by: 'client' | 'admin';
}

export interface SelectEngagementOptionOutput {
  quote_id: string;
  engagement_type: string;
  engagement_selected_at: string;
  engagement_selected_by: string;
}

export async function selectEngagementOption(
  input: SelectEngagementOptionInput,
  context: AuthContext
): Promise<SelectEngagementOptionOutput> {
  const tracer = trace.getTracer('quoting-mcp');
  const span = tracer.startSpan('tool.select_engagement_option');

  try {
    span.setAttribute('tenant_id', context.tenant_id);
    span.setAttribute('quote_id', input.quote_id);

    const quoteResult = await query(
      `SELECT id, option_b_percent, option_c_equity_percent
       FROM quotes
       WHERE id = $1 AND tenant_id = $2`,
      [input.quote_id, context.tenant_id]
    );

    if (quoteResult.rows.length === 0) {
      throw new Error(`Quote not found: ${input.quote_id}`);
    }

    const quote = quoteResult.rows[0];

    if (input.engagement_type === 'option_b' && !quote.option_b_percent) {
      throw new Error('Option B is not configured for this quote');
    }

    if (input.engagement_type === 'option_c' && !quote.option_c_equity_percent) {
      throw new Error('Option C is not configured for this quote');
    }

    const now = new Date().toISOString();

    await query(
      `UPDATE quotes
       SET engagement_type = $1,
           engagement_selected_at = $2,
           engagement_selected_by = $3,
           updated_at = NOW()
       WHERE id = $4 AND tenant_id = $5`,
      [input.engagement_type, now, input.selected_by, input.quote_id, context.tenant_id]
    );

    return {
      quote_id: input.quote_id,
      engagement_type: input.engagement_type,
      engagement_selected_at: now,
      engagement_selected_by: input.selected_by,
    };
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
