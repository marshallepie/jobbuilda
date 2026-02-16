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
