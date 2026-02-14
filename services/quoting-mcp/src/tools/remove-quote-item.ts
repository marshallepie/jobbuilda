import { trace } from '@opentelemetry/api';
import { randomUUID } from 'crypto';
import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { AuthContext } from '@jobbuilda/contracts';

export interface RemoveQuoteItemInput {
  quote_id: string;
  item_id: string;
}

export async function removeQuoteItem(
  input: RemoveQuoteItemInput,
  context: AuthContext
): Promise<any> {
  const tracer = trace.getTracer('quoting-mcp');
  const span = tracer.startSpan('tool.remove_quote_item');

  try {
    span.setAttribute('tenant_id', context.tenant_id);
    span.setAttribute('quote_id', input.quote_id);
    span.setAttribute('item_id', input.item_id);

    // Verify quote exists and is editable
    const quoteResult = await query(
      `SELECT id, status FROM quotes WHERE id = $1 AND tenant_id = $2`,
      [input.quote_id, context.tenant_id]
    );

    if (quoteResult.rows.length === 0) {
      throw new Error('Quote not found');
    }

    const quote = quoteResult.rows[0];
    if (quote.status === 'approved' || quote.status === 'rejected') {
      throw new Error(`Cannot modify ${quote.status} quote`);
    }

    // Get item details before deletion
    const itemResult = await query(
      `SELECT description, line_total_inc_vat FROM quote_items
       WHERE id = $1 AND quote_id = $2 AND tenant_id = $3`,
      [input.item_id, input.quote_id, context.tenant_id]
    );

    if (itemResult.rows.length === 0) {
      throw new Error('Item not found');
    }

    const item = itemResult.rows[0];

    // Delete item
    await query(
      `DELETE FROM quote_items WHERE id = $1 AND quote_id = $2 AND tenant_id = $3`,
      [input.item_id, input.quote_id, context.tenant_id]
    );

    // Get updated quote totals
    const updatedQuote = await query(
      `SELECT * FROM quotes WHERE id = $1`,
      [input.quote_id]
    );

    await publishEvent({
      id: randomUUID(),
      type: 'quote.item_removed',
      tenant_id: context.tenant_id,
      occurred_at: new Date().toISOString(),
      actor: { user_id: context.user_id },
      data: {
        quote_id: input.quote_id,
        item_id: input.item_id,
        description: item.description,
        removed_amount: item.line_total_inc_vat,
      },
      schema: 'urn:jobbuilda:events:quote.item_removed:1'
    });

    return {
      quote_total: updatedQuote.rows[0].total_inc_vat,
      message: 'Item removed successfully'
    };
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
