import { trace } from '@opentelemetry/api';
import { randomUUID } from 'crypto';
import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { AuthContext } from '@jobbuilda/contracts';

export interface RejectQuoteInput {
  quote_id: string;
  rejection_reason?: string;
}

export interface RejectQuoteOutput {
  quote_id: string;
  quote_number: string;
  status: string;
  rejected_at: string;
}

export async function rejectQuote(
  input: RejectQuoteInput,
  context: AuthContext
): Promise<RejectQuoteOutput> {
  const tracer = trace.getTracer('quoting-mcp');
  const span = tracer.startSpan('tool.reject_quote');

  try {
    span.setAttribute('tenant_id', context.tenant_id);
    span.setAttribute('quote_id', input.quote_id);

    // Get quote
    const quoteResult = await query(
      `SELECT id, quote_number, status, client_id, title, lead_id
       FROM quotes
       WHERE id = $1 AND tenant_id = $2`,
      [input.quote_id, context.tenant_id]
    );

    if (quoteResult.rows.length === 0) {
      throw new Error(`Quote not found: ${input.quote_id}`);
    }

    const quote = quoteResult.rows[0];

    if (!['sent', 'viewed'].includes(quote.status)) {
      throw new Error(`Quote cannot be rejected in status: ${quote.status}`);
    }

    const now = new Date().toISOString();

    // Update quote status
    await query(
      `UPDATE quotes
       SET status = $1, rejected_at = $2, rejection_reason = $3, updated_at = $4
       WHERE id = $5 AND tenant_id = $6`,
      ['rejected', now, input.rejection_reason || null, now, input.quote_id, context.tenant_id]
    );

    // Update lead status if linked
    if (quote.lead_id) {
      await query(
        `UPDATE leads
         SET status = $1, updated_at = $2
         WHERE id = $3 AND tenant_id = $4`,
        ['lost', now, quote.lead_id, context.tenant_id]
      );
    }

    // Publish event
    await publishEvent({
      id: randomUUID(),
      type: 'quote.rejected',
      tenant_id: context.tenant_id,
      occurred_at: now,
      actor: { user_id: context.user_id },
      data: {
        quote_id: input.quote_id,
        quote_number: quote.quote_number,
        client_id: quote.client_id,
        title: quote.title,
        rejection_reason: input.rejection_reason,
        lead_id: quote.lead_id
      },
      schema: 'urn:jobbuilda:events:quote.rejected:1'
    });

    return {
      quote_id: input.quote_id,
      quote_number: quote.quote_number,
      status: 'rejected',
      rejected_at: now
    };
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
