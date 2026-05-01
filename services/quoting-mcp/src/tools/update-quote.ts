import { trace } from '@opentelemetry/api';
import { query } from '../lib/database.js';
import { AuthContext } from '@jobbuilda/contracts';

export interface UpdateQuoteInput {
  quote_id: string;
  title?: string;
  description?: string;
  status?: 'draft' | 'sent' | 'viewed' | 'approved' | 'rejected' | 'expired';
  valid_until?: string;
  terms?: string;
  notes?: string;
  job_id?: string;
  deposit_percent?: number;
  deposit_fixed_amount?: number;
  deposit_amount?: number;
  is_digital?: boolean;
  digital_site?: string;
  engagement_type?: 'option_a' | 'option_b' | 'option_c';
  option_b_percent?: number;
  option_c_equity_percent?: number;
  option_b_label?: string;
  option_c_label?: string;
  project_urls?: Array<{ label: string; url: string }>;
}

export interface UpdateQuoteOutput {
  quote: any;
}

export async function updateQuote(
  input: UpdateQuoteInput,
  context: AuthContext
): Promise<UpdateQuoteOutput> {
  const tracer = trace.getTracer('quoting-mcp');
  const span = tracer.startSpan('tool.update_quote');

  try {
    span.setAttribute('tenant_id', context.tenant_id);
    span.setAttribute('quote_id', input.quote_id);

    // Build dynamic UPDATE statement
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(input.title);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }
    if (input.valid_until !== undefined) {
      updates.push(`valid_until = $${paramIndex++}`);
      values.push(input.valid_until);
    }
    if (input.terms !== undefined) {
      updates.push(`terms = $${paramIndex++}`);
      values.push(input.terms);
    }
    if (input.notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(input.notes);
    }
    if (input.job_id !== undefined) {
      updates.push(`job_id = $${paramIndex++}`);
      values.push(input.job_id);
    }
    if (input.deposit_percent !== undefined) {
      updates.push(`deposit_percent = $${paramIndex++}`);
      values.push(input.deposit_percent);
    }
    if (input.deposit_fixed_amount !== undefined) {
      updates.push(`deposit_fixed_amount = $${paramIndex++}`);
      values.push(input.deposit_fixed_amount);
    }
    if (input.deposit_amount !== undefined) {
      updates.push(`deposit_amount = $${paramIndex++}`);
      values.push(input.deposit_amount);
    }
    if (input.is_digital !== undefined) {
      updates.push(`is_digital = $${paramIndex++}`);
      values.push(input.is_digital);
    }
    if (input.digital_site !== undefined) {
      updates.push(`digital_site = $${paramIndex++}`);
      values.push(input.digital_site || null);
    }
    if (input.engagement_type !== undefined) {
      updates.push(`engagement_type = $${paramIndex++}`);
      values.push(input.engagement_type);
    }
    if (input.option_b_percent !== undefined) {
      updates.push(`option_b_percent = $${paramIndex++}`);
      values.push(input.option_b_percent || null);
    }
    if (input.option_c_equity_percent !== undefined) {
      updates.push(`option_c_equity_percent = $${paramIndex++}`);
      values.push(input.option_c_equity_percent || null);
    }
    if (input.option_b_label !== undefined) {
      updates.push(`option_b_label = $${paramIndex++}`);
      values.push(input.option_b_label || null);
    }
    if (input.option_c_label !== undefined) {
      updates.push(`option_c_label = $${paramIndex++}`);
      values.push(input.option_c_label || null);
    }
    if (input.project_urls !== undefined) {
      updates.push(`project_urls = $${paramIndex++}`);
      values.push(JSON.stringify(input.project_urls));
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    // Always update updated_at
    updates.push(`updated_at = NOW()`);

    // Add WHERE clause parameters
    values.push(input.quote_id, context.tenant_id);

    const updateQuery = `
      UPDATE quotes
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await query(updateQuery, values);

    if (result.rows.length === 0) {
      throw new Error(`Quote not found: ${input.quote_id}`);
    }

    return { quote: result.rows[0] };
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
