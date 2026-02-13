import { trace } from '@opentelemetry/api';
import { query } from '../lib/database.js';

export interface Quote {
  id: string;
  tenant_id: string;
  quote_number: string;
  lead_id?: string;
  client_id: string;
  site_id?: string;
  title: string;
  description?: string;
  status: string;
  subtotal_ex_vat: number;
  vat_amount: number;
  total_inc_vat: number;
  valid_until?: string;
  sent_at?: string;
  viewed_at?: string;
  approved_at?: string;
  rejected_at?: string;
  rejection_reason?: string;
  terms?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  items?: QuoteItem[];
}

export interface QuoteItem {
  id: string;
  tenant_id: string;
  quote_id: string;
  item_type: string;
  product_id?: string;
  sku?: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price_ex_vat: number;
  markup_percent: number;
  line_total_ex_vat: number;
  vat_rate: number;
  line_total_inc_vat: number;
  sort_order: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export async function getQuote(quoteId: string, tenantId: string, includeItems = true): Promise<Quote | null> {
  const tracer = trace.getTracer('quoting-mcp');
  const span = tracer.startSpan('resource.get_quote');

  try {
    span.setAttribute('quote_id', quoteId);
    span.setAttribute('tenant_id', tenantId);

    const result = await query<Quote>(
      `SELECT id, tenant_id, quote_number, lead_id, client_id, site_id, title, description,
              status, subtotal_ex_vat, vat_amount, total_inc_vat, valid_until,
              sent_at, viewed_at, approved_at, rejected_at, rejection_reason,
              terms, notes, created_by, created_at, updated_at
       FROM quotes
       WHERE id = $1 AND tenant_id = $2`,
      [quoteId, tenantId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const quote = result.rows[0];

    if (includeItems) {
      const itemsResult = await query<QuoteItem>(
        `SELECT id, tenant_id, quote_id, item_type, product_id, sku, description,
                quantity, unit, unit_price_ex_vat, markup_percent, line_total_ex_vat,
                vat_rate, line_total_inc_vat, sort_order, notes, created_at, updated_at
         FROM quote_items
         WHERE quote_id = $1 AND tenant_id = $2
         ORDER BY sort_order ASC, created_at ASC`,
        [quoteId, tenantId]
      );
      quote.items = itemsResult.rows;
    }

    return quote;
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}

export async function listQuotesByClient(clientId: string, tenantId: string): Promise<Quote[]> {
  const tracer = trace.getTracer('quoting-mcp');
  const span = tracer.startSpan('resource.list_quotes_by_client');

  try {
    span.setAttribute('client_id', clientId);
    span.setAttribute('tenant_id', tenantId);

    const result = await query<Quote>(
      `SELECT id, tenant_id, quote_number, lead_id, client_id, site_id, title, description,
              status, subtotal_ex_vat, vat_amount, total_inc_vat, valid_until,
              sent_at, viewed_at, approved_at, rejected_at, rejection_reason,
              terms, notes, created_by, created_at, updated_at
       FROM quotes
       WHERE client_id = $1 AND tenant_id = $2
       ORDER BY created_at DESC`,
      [clientId, tenantId]
    );

    return result.rows;
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}

export async function listQuotes(tenantId: string, status?: string): Promise<Quote[]> {
  const tracer = trace.getTracer('quoting-mcp');
  const span = tracer.startSpan('resource.list_quotes');

  try {
    span.setAttribute('tenant_id', tenantId);
    if (status) {
      span.setAttribute('status', status);
    }

    const whereClause = status
      ? 'WHERE tenant_id = $1 AND status = $2'
      : 'WHERE tenant_id = $1';
    const params = status ? [tenantId, status] : [tenantId];

    const result = await query<Quote>(
      `SELECT id, tenant_id, quote_number, lead_id, client_id, site_id, title, description,
              status, subtotal_ex_vat, vat_amount, total_inc_vat, valid_until,
              sent_at, viewed_at, approved_at, rejected_at, rejection_reason,
              terms, notes, created_by, created_at, updated_at
       FROM quotes
       ${whereClause}
       ORDER BY created_at DESC`,
      params
    );

    return result.rows;
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
