import { trace } from '@opentelemetry/api';
import { randomUUID } from 'crypto';
import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { AuthContext } from '@jobbuilda/contracts';

export interface SendQuoteInput {
  quote_id: string;
}

export interface SendQuoteOutput {
  quote_id: string;
  quote_number: string;
  status: string;
  sent_at: string;
}

export async function sendQuote(
  input: SendQuoteInput,
  context: AuthContext
): Promise<SendQuoteOutput> {
  const tracer = trace.getTracer('quoting-mcp');
  const span = tracer.startSpan('tool.send_quote');

  try {
    span.setAttribute('tenant_id', context.tenant_id);
    span.setAttribute('quote_id', input.quote_id);

    // Get quote
    const quoteResult = await query(
      `SELECT id, quote_number, status, client_id, title
       FROM quotes
       WHERE id = $1 AND tenant_id = $2`,
      [input.quote_id, context.tenant_id]
    );

    if (quoteResult.rows.length === 0) {
      throw new Error(`Quote not found: ${input.quote_id}`);
    }

    const quote = quoteResult.rows[0];

    if (quote.status !== 'draft') {
      throw new Error(`Quote cannot be sent in status: ${quote.status}`);
    }

    const now = new Date().toISOString();

    // Update quote status
    await query(
      `UPDATE quotes
       SET status = $1, sent_at = $2, updated_at = $3
       WHERE id = $4 AND tenant_id = $5`,
      ['sent', now, now, input.quote_id, context.tenant_id]
    );

    // Publish event
    await publishEvent({
      id: randomUUID(),
      type: 'quote.sent',
      tenant_id: context.tenant_id,
      occurred_at: now,
      actor: { user_id: context.user_id },
      data: {
        quote_id: input.quote_id,
        quote_number: quote.quote_number,
        client_id: quote.client_id,
        title: quote.title
      },
      schema: 'urn:jobbuilda:events:quote.sent:1'
    });

    return {
      quote_id: input.quote_id,
      quote_number: quote.quote_number,
      status: 'sent',
      sent_at: now
    };
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
