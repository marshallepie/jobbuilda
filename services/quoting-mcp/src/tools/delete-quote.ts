import { trace } from '@opentelemetry/api';
import { randomUUID } from 'crypto';
import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { AuthContext } from '@jobbuilda/contracts';

export interface DeleteQuoteInput {
  quote_id: string;
}

export async function deleteQuote(
  input: DeleteQuoteInput,
  context: AuthContext
): Promise<{ success: boolean; message: string }> {
  const tracer = trace.getTracer('quoting-mcp');
  const span = tracer.startSpan('tool.delete_quote');

  try {
    span.setAttribute('tenant_id', context.tenant_id);
    span.setAttribute('quote_id', input.quote_id);

    // Get quote details before deletion
    const quoteResult = await query(
      `SELECT quote_number, status, title, total_inc_vat
       FROM quotes
       WHERE id = $1 AND tenant_id = $2`,
      [input.quote_id, context.tenant_id]
    );

    if (quoteResult.rows.length === 0) {
      throw new Error('Quote not found');
    }

    const quote = quoteResult.rows[0];

    // Prevent deletion of approved quotes (should convert to job first)
    if (quote.status === 'approved') {
      throw new Error('Cannot delete approved quotes. Please create a job from this quote or reject it first.');
    }

    const now = new Date().toISOString();

    // Delete quote (cascade will delete items)
    await query(
      `DELETE FROM quotes WHERE id = $1 AND tenant_id = $2`,
      [input.quote_id, context.tenant_id]
    );

    // Publish event
    await publishEvent({
      id: randomUUID(),
      type: 'quote.deleted',
      tenant_id: context.tenant_id,
      occurred_at: now,
      actor: { user_id: context.user_id },
      data: {
        quote_id: input.quote_id,
        quote_number: quote.quote_number,
        title: quote.title,
        status: quote.status,
        total_inc_vat: parseFloat(quote.total_inc_vat),
      },
      schema: 'urn:jobbuilda:events:quote.deleted:1'
    });

    return {
      success: true,
      message: `Quote ${quote.quote_number} deleted successfully`
    };
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
