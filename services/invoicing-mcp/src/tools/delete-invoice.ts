import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { trace } from '@opentelemetry/api';
import type { AuthContext } from '@jobbuilda/contracts';
import { randomUUID } from 'crypto';

export interface DeleteInvoiceInput {
  invoice_id: string;
}

export async function deleteInvoice(
  input: DeleteInvoiceInput,
  context: AuthContext
): Promise<{ success: boolean; message: string }> {
  const tracer = trace.getTracer('invoicing-mcp');
  return tracer.startActiveSpan('tool.delete_invoice', async (span) => {
    try {
      span.setAttributes({ 'tenant.id': context.tenant_id, 'invoice.id': input.invoice_id });

      const check = await query(
        `SELECT id, invoice_number, status, total_inc_vat FROM invoices WHERE id = $1 AND tenant_id = $2`,
        [input.invoice_id, context.tenant_id]
      );
      if (check.rows.length === 0) throw new Error('Invoice not found');

      const invoice = check.rows[0];
      // Only block deletion if payment has been recorded (partial/paid)
      if (invoice.status === 'partial' || invoice.status === 'paid') {
        throw new Error('Cannot delete an invoice that has payments recorded');
      }

      // Delete items first (in case there's no cascade)
      await query(
        `DELETE FROM invoice_items WHERE invoice_id = $1 AND tenant_id = $2`,
        [input.invoice_id, context.tenant_id]
      );

      await query(
        `DELETE FROM invoices WHERE id = $1 AND tenant_id = $2`,
        [input.invoice_id, context.tenant_id]
      );

      await publishEvent({
        id: randomUUID(),
        type: 'invoicing.invoice_deleted',
        tenant_id: context.tenant_id,
        occurred_at: new Date().toISOString(),
        actor: { user_id: context.user_id },
        data: {
          invoice_id: input.invoice_id,
          invoice_number: invoice.invoice_number,
          status: invoice.status,
        },
        schema: 'urn:jobbuilda:events:invoicing.invoice_deleted:1',
      });

      return { success: true, message: `Invoice ${invoice.invoice_number} deleted successfully` };
    } finally {
      span.end();
    }
  });
}
