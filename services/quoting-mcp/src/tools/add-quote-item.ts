import { trace } from '@opentelemetry/api';
import { randomUUID } from 'crypto';
import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { AuthContext } from '@jobbuilda/contracts';

export interface AddQuoteItemInput {
  quote_id: string;
  item_type: 'material' | 'labor' | 'other';
  description: string;
  quantity: number;
  unit?: string;

  // For materials
  unit_price_ex_vat?: number;
  markup_percent?: number;

  // For labor
  estimated_hours?: number;
  labor_rate?: number;

  vat_rate?: number;
  notes?: string;
}

export async function addQuoteItem(
  input: AddQuoteItemInput,
  context: AuthContext
): Promise<any> {
  const tracer = trace.getTracer('quoting-mcp');
  const span = tracer.startSpan('tool.add_quote_item');

  try {
    span.setAttribute('tenant_id', context.tenant_id);
    span.setAttribute('quote_id', input.quote_id);

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

    const itemId = randomUUID();
    const vatRate = input.vat_rate || 20.0;

    // Calculate pricing based on item type
    let unitPrice = 0;
    if (input.item_type === 'labor') {
      // For labor: unit_price = estimated_hours × labor_rate
      const hours = input.estimated_hours || 0;
      const rate = input.labor_rate || 0;
      unitPrice = hours * rate;
    } else {
      // For materials/other: use provided unit_price
      unitPrice = input.unit_price_ex_vat || 0;
    }

    const markup = input.markup_percent || 0;
    const lineTotalExVat = Math.round(input.quantity * unitPrice * (1 + markup / 100) * 100) / 100;
    const lineVat = Math.round(lineTotalExVat * (vatRate / 100) * 100) / 100;
    const lineTotalIncVat = lineTotalExVat + lineVat;

    // Get next sort order
    const sortResult = await query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM quote_items WHERE quote_id = $1`,
      [input.quote_id]
    );
    const sortOrder = sortResult.rows[0].next_order;

    await query(
      `INSERT INTO quote_items (
        id, tenant_id, quote_id, item_type, description, quantity, unit,
        unit_price_ex_vat, markup_percent, line_total_ex_vat, vat_rate,
        line_total_inc_vat, estimated_hours, labor_rate, sort_order, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        itemId,
        context.tenant_id,
        input.quote_id,
        input.item_type,
        input.description,
        input.quantity,
        input.unit || (input.item_type === 'labor' ? 'hour' : 'unit'),
        unitPrice,
        markup,
        lineTotalExVat,
        vatRate,
        lineTotalIncVat,
        input.estimated_hours || null,
        input.labor_rate || null,
        sortOrder,
        input.notes || null
      ]
    );

    // Get updated quote with new totals
    const updatedQuote = await query(
      `SELECT * FROM quotes WHERE id = $1`,
      [input.quote_id]
    );

    await publishEvent({
      id: randomUUID(),
      type: 'quote.item_added',
      tenant_id: context.tenant_id,
      occurred_at: new Date().toISOString(),
      actor: { user_id: context.user_id },
      data: {
        quote_id: input.quote_id,
        item_id: itemId,
        item_type: input.item_type,
        description: input.description,
        line_total_inc_vat: lineTotalIncVat,
      },
      schema: 'urn:jobbuilda:events:quote.item_added:1'
    });

    return {
      item_id: itemId,
      quote_total: updatedQuote.rows[0].total_inc_vat,
      message: 'Item added successfully'
    };
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
