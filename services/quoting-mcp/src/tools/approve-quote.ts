import { trace } from '@opentelemetry/api';
import { randomUUID } from 'crypto';
import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { AuthContext } from '@jobbuilda/contracts';

export interface ApproveQuoteInput {
  quote_id: string;
}

export interface ApproveQuoteOutput {
  quote_id: string;
  quote_number: string;
  status: string;
  approved_at: string;
}

export async function approveQuote(
  input: ApproveQuoteInput,
  context: AuthContext
): Promise<ApproveQuoteOutput> {
  const tracer = trace.getTracer('quoting-mcp');
  const span = tracer.startSpan('tool.approve_quote');

  try {
    span.setAttribute('tenant_id', context.tenant_id);
    span.setAttribute('quote_id', input.quote_id);

    // Get quote
    const quoteResult = await query(
      `SELECT id, quote_number, status, client_id, title, lead_id, total_inc_vat
       FROM quotes
       WHERE id = $1 AND tenant_id = $2`,
      [input.quote_id, context.tenant_id]
    );

    if (quoteResult.rows.length === 0) {
      throw new Error(`Quote not found: ${input.quote_id}`);
    }

    const quote = quoteResult.rows[0];

    if (!['sent', 'viewed'].includes(quote.status)) {
      throw new Error(`Quote cannot be approved in status: ${quote.status}`);
    }

    const now = new Date().toISOString();

    // Update quote status
    await query(
      `UPDATE quotes
       SET status = $1, approved_at = $2, updated_at = $3
       WHERE id = $4 AND tenant_id = $5`,
      ['approved', now, now, input.quote_id, context.tenant_id]
    );

    // Update lead status if linked
    if (quote.lead_id) {
      await query(
        `UPDATE leads
         SET status = $1, updated_at = $2
         WHERE id = $3 AND tenant_id = $4`,
        ['won', now, quote.lead_id, context.tenant_id]
      );
    }

    // Publish event
    await publishEvent({
      id: randomUUID(),
      type: 'quote.approved',
      tenant_id: context.tenant_id,
      occurred_at: now,
      actor: { user_id: context.user_id },
      data: {
        quote_id: input.quote_id,
        quote_number: quote.quote_number,
        client_id: quote.client_id,
        title: quote.title,
        total_inc_vat: quote.total_inc_vat,
        lead_id: quote.lead_id
      },
      schema: 'urn:jobbuilda:events:quote.approved:1'
    });

    return {
      quote_id: input.quote_id,
      quote_number: quote.quote_number,
      status: 'approved',
      approved_at: now
    };
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
