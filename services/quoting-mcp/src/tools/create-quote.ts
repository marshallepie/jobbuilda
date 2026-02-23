import { trace } from '@opentelemetry/api';
import { randomUUID } from 'crypto';
import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { AuthContext } from '@jobbuilda/contracts';

export interface QuoteLineItem {
  item_type: 'material' | 'labor' | 'other';
  product_id?: string;
  sku?: string;
  description: string;
  quantity: number;
  unit?: string;
  unit_price_ex_vat: number;
  markup_percent?: number;
  vat_rate?: number;
  notes?: string;
}

export interface CreateQuoteInput {
  lead_id?: string;
  client_id: string;
  site_id?: string;
  title: string;
  description?: string;
  valid_until?: string;
  terms?: string;
  notes?: string;
  items: QuoteLineItem[];
}

export interface CreateQuoteOutput {
  quote_id: string;
  quote_number: string;
  title: string;
  status: string;
  subtotal_ex_vat: number;
  vat_amount: number;
  total_inc_vat: number;
  created_at: string;
}

export async function createQuote(
  input: CreateQuoteInput,
  context: AuthContext
): Promise<CreateQuoteOutput> {
  const tracer = trace.getTracer('quoting-mcp');
  const span = tracer.startSpan('tool.create_quote');

  try {
    span.setAttribute('tenant_id', context.tenant_id);
    span.setAttribute('client_id', input.client_id);

    const quoteId = randomUUID();
    const now = new Date().toISOString();

    // Generate quote number (format: Q-YYYYMMDD-XXX)
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const countResult = await query(
      `SELECT COUNT(*) as count FROM quotes WHERE tenant_id = $1 AND quote_number LIKE $2`,
      [context.tenant_id, `Q-${dateStr}-%`]
    );
    const count = parseInt(countResult.rows[0].count) + 1;
    const quoteNumber = `Q-${dateStr}-${count.toString().padStart(3, '0')}`;

    // Create quote
    await query(
      `INSERT INTO quotes (id, tenant_id, quote_number, lead_id, client_id, site_id, title,
                           description, status, valid_until, terms, notes, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        quoteId,
        context.tenant_id,
        quoteNumber,
        input.lead_id || null,
        input.client_id,
        input.site_id || null,
        input.title,
        input.description || null,
        'draft',
        input.valid_until || null,
        input.terms || null,
        input.notes || null,
        context.user_id,
        now,
        now
      ]
    );

    // Add line items
    let sortOrder = 0;
    for (const item of input.items) {
      const itemId = randomUUID();
      const markup = item.markup_percent || 0;
      const vatRate = item.vat_rate || 20.0;

      const lineTotalExVat = Math.round(item.quantity * item.unit_price_ex_vat * (1 + markup / 100) * 100) / 100;
      const lineVatAmount = Math.round(lineTotalExVat * (vatRate / 100) * 100) / 100;
      const lineTotalIncVat = lineTotalExVat + lineVatAmount;

      await query(
        `INSERT INTO quote_items (id, quote_id, item_type, product_id, sku, description,
                                  quantity, unit, unit_price_ex_vat, markup_percent, line_total_ex_vat,
                                  vat_rate, line_vat_amount, line_total_inc_vat, sort_order, notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
        [
          itemId,
          quoteId,
          item.item_type,
          item.product_id || null,
          item.sku || null,
          item.description,
          item.quantity,
          item.unit || 'unit',
          item.unit_price_ex_vat,
          markup,
          lineTotalExVat,
          vatRate,
          lineVatAmount,
          lineTotalIncVat,
          sortOrder++,
          item.notes || null,
          now,
          now
        ]
      );
    }

    // Get updated quote with totals (calculated by trigger)
    const quoteResult = await query(
      `SELECT subtotal_ex_vat, vat_amount, total_inc_vat
       FROM quotes
       WHERE id = $1`,
      [quoteId]
    );

    const quote = quoteResult.rows[0];

    // Publish event
    await publishEvent({
      id: randomUUID(),
      type: 'quote.created',
      tenant_id: context.tenant_id,
      occurred_at: now,
      actor: { user_id: context.user_id },
      data: {
        quote_id: quoteId,
        quote_number: quoteNumber,
        client_id: input.client_id,
        title: input.title,
        total_inc_vat: quote.total_inc_vat,
        item_count: input.items.length
      },
      schema: 'urn:jobbuilda:events:quote.created:1'
    });

    return {
      quote_id: quoteId,
      quote_number: quoteNumber,
      title: input.title,
      status: 'draft',
      subtotal_ex_vat: parseFloat(quote.subtotal_ex_vat),
      vat_amount: parseFloat(quote.vat_amount),
      total_inc_vat: parseFloat(quote.total_inc_vat),
      created_at: now
    };
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
