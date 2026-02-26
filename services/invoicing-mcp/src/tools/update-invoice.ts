import { query } from '../lib/database.js';
import { trace } from '@opentelemetry/api';
import type { AuthContext } from '@jobbuilda/contracts';

interface InvoiceItem {
  item_type: 'labor' | 'material' | 'variation' | 'other';
  description: string;
  quantity: number;
  unit?: string;
  unit_price_ex_vat: number;
  vat_rate?: number;
}

export interface UpdateInvoiceInput {
  invoice_id: string;
  invoice_date?: string;
  payment_terms_days?: number;
  notes?: string;
  items?: InvoiceItem[];
}

export async function updateInvoice(
  input: UpdateInvoiceInput,
  context: AuthContext
): Promise<any> {
  const tracer = trace.getTracer('invoicing-mcp');
  return tracer.startActiveSpan('tool.update_invoice', async (span) => {
    try {
      span.setAttributes({ 'tenant.id': context.tenant_id, 'invoice.id': input.invoice_id });

      // Verify invoice exists and is draft
      const check = await query(
        `SELECT id, status FROM invoices WHERE id = $1 AND tenant_id = $2`,
        [input.invoice_id, context.tenant_id]
      );
      if (check.rows.length === 0) throw new Error('Invoice not found');
      if (check.rows[0].status !== 'draft') {
        throw new Error('Only draft invoices can be edited');
      }

      // Update header fields
      const updates: string[] = ['updated_at = NOW()'];
      const values: any[] = [];
      let p = 1;

      if (input.invoice_date !== undefined) {
        updates.push(`invoice_date = $${p++}`);
        values.push(input.invoice_date);
      }
      if (input.payment_terms_days !== undefined) {
        updates.push(`payment_terms_days = $${p++}`);
        values.push(input.payment_terms_days);
        // Recalculate due_date based on invoice_date
        const baseDateResult = await query(
          `SELECT COALESCE($1::date, invoice_date) as base FROM invoices WHERE id = $2`,
          [input.invoice_date || null, input.invoice_id]
        );
        const baseDate = new Date(baseDateResult.rows[0].base);
        baseDate.setDate(baseDate.getDate() + input.payment_terms_days);
        updates.push(`due_date = $${p++}`);
        values.push(baseDate.toISOString().split('T')[0]);
      }
      if (input.notes !== undefined) {
        updates.push(`notes = $${p++}`);
        values.push(input.notes);
      }

      values.push(input.invoice_id, context.tenant_id);
      await query(
        `UPDATE invoices SET ${updates.join(', ')} WHERE id = $${p} AND tenant_id = $${p + 1}`,
        values
      );

      // Replace items if provided
      if (input.items !== undefined) {
        await query(
          `DELETE FROM invoice_items WHERE invoice_id = $1 AND tenant_id = $2`,
          [input.invoice_id, context.tenant_id]
        );

        for (const item of input.items) {
          const vatRate = item.vat_rate ?? 20;
          const lineTotal = item.quantity * item.unit_price_ex_vat;
          const lineVat = Math.round(lineTotal * (vatRate / 100) * 100) / 100;
          const lineTotalIncVat = lineTotal + lineVat;

          await query(
            `INSERT INTO invoice_items (
              tenant_id, invoice_id, item_type, description, quantity, unit,
              unit_price_ex_vat, line_total_ex_vat, vat_rate, line_vat, line_total_inc_vat
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              context.tenant_id,
              input.invoice_id,
              item.item_type,
              item.description,
              item.quantity,
              item.unit || 'unit',
              item.unit_price_ex_vat,
              lineTotal,
              vatRate,
              lineVat,
              lineTotalIncVat,
            ]
          );
        }

        // Recalculate invoice totals from items
        await query(
          `UPDATE invoices SET
            subtotal_ex_vat = (SELECT COALESCE(SUM(line_total_ex_vat), 0) FROM invoice_items WHERE invoice_id = $1),
            vat_amount      = (SELECT COALESCE(SUM(line_vat), 0)          FROM invoice_items WHERE invoice_id = $1),
            total_inc_vat   = (SELECT COALESCE(SUM(line_total_inc_vat), 0) FROM invoice_items WHERE invoice_id = $1),
            amount_due      = (SELECT COALESCE(SUM(line_total_inc_vat), 0) FROM invoice_items WHERE invoice_id = $1) - amount_paid
          WHERE id = $1`,
          [input.invoice_id]
        );
      }

      const result = await query(`SELECT * FROM invoices WHERE id = $1`, [input.invoice_id]);
      const items = await query(
        `SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY created_at`,
        [input.invoice_id]
      );

      return { ...result.rows[0], items: items.rows };
    } finally {
      span.end();
    }
  });
}
