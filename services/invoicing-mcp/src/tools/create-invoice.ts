import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { trace } from '@opentelemetry/api';
import type { AuthContext } from '@jobbuilda/contracts';
import { randomUUID } from 'crypto';

const tracer = trace.getTracer('invoicing-mcp');

interface InvoiceItem {
  item_type: 'labor' | 'material' | 'variation' | 'other';
  description: string;
  quantity: number;
  unit?: string;
  unit_price_ex_vat: number;
  vat_rate?: number;
  job_item_id?: string;
  variation_id?: string;
}

interface CreateInvoiceInput {
  job_id: string;
  client_id: string;
  site_id: string;
  invoice_type?: 'deposit' | 'progress' | 'final' | 'credit_note';
  invoice_date?: string;
  payment_terms_days?: number;
  items: InvoiceItem[];
  notes?: string;
}

export async function createInvoice(
  input: CreateInvoiceInput,
  context: AuthContext
): Promise<any> {
  return tracer.startActiveSpan('tool.create_invoice', async (span) => {
    try {
      span.setAttributes({
        'tenant.id': context.tenant_id,
        'job.id': input.job_id,
      });

      const invoiceId = randomUUID();

      // Generate invoice number
      const numberResult = await query(
        `SELECT generate_invoice_number($1) as number`,
        [context.tenant_id]
      );
      const invoiceNumber = numberResult.rows[0].number;

      const invoiceDate = input.invoice_date || new Date().toISOString().split('T')[0];
      const paymentTermsDays = input.payment_terms_days || 30;
      const dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + paymentTermsDays);

      // Insert invoice
      const invoiceResult = await query(
        `INSERT INTO invoices (
          id, tenant_id, invoice_number, job_id, client_id, site_id, invoice_type,
          invoice_date, due_date, payment_terms_days, notes, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          invoiceId,
          context.tenant_id,
          invoiceNumber,
          input.job_id,
          input.client_id,
          input.site_id,
          input.invoice_type || 'final',
          invoiceDate,
          dueDate.toISOString().split('T')[0],
          paymentTermsDays,
          input.notes || null,
          'draft',
          context.user_id,
        ]
      );

      const invoice = invoiceResult.rows[0];

      // Insert invoice items with VAT calculations
      const items = [];
      for (const item of input.items) {
        const vatRate = item.vat_rate || 20.00;
        const lineTotal = item.quantity * item.unit_price_ex_vat;
        const lineVat = Math.round(lineTotal * (vatRate / 100) * 100) / 100;
        const lineTotalIncVat = lineTotal + lineVat;

        const itemResult = await query(
          `INSERT INTO invoice_items (
            tenant_id, invoice_id, item_type, description, quantity, unit,
            unit_price_ex_vat, line_total_ex_vat, vat_rate, line_vat,
            line_total_inc_vat, job_item_id, variation_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *`,
          [
            context.tenant_id,
            invoiceId,
            item.item_type,
            item.description,
            item.quantity,
            item.unit || 'unit',
            item.unit_price_ex_vat,
            lineTotal,
            vatRate,
            lineVat,
            lineTotalIncVat,
            item.job_item_id || null,
            item.variation_id || null,
          ]
        );

        items.push(itemResult.rows[0]);
      }

      // Get updated invoice with totals
      const updatedResult = await query(
        `SELECT * FROM invoices WHERE id = $1`,
        [invoiceId]
      );

      const result = {
        ...updatedResult.rows[0],
        items,
      };

      // Publish event
      await publishEvent({
        id: randomUUID(),
        type: 'invoicing.invoice_created',
        tenant_id: context.tenant_id,
        occurred_at: new Date().toISOString(),
        actor: { user_id: context.user_id },
        data: {
          invoice_id: invoiceId,
          invoice_number: invoiceNumber,
          job_id: input.job_id,
          client_id: input.client_id,
          total_inc_vat: parseFloat(result.total_inc_vat),
        },
        schema: 'urn:jobbuilda:events:invoicing.invoice_created:1',
      });

      return result;
    } finally {
      span.end();
    }
  });
}
