import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { trace } from '@opentelemetry/api';
import type { AuthContext } from '@jobbuilda/contracts';
import { randomUUID } from 'crypto';

const tracer = trace.getTracer('invoicing-mcp');

interface CancelInvoiceInput {
  invoice_id: string;
  reason?: string;
}

export async function cancelInvoice(
  input: CancelInvoiceInput,
  context: AuthContext
): Promise<any> {
  return tracer.startActiveSpan('tool.cancel_invoice', async (span) => {
    try {
      span.setAttributes({
        'tenant.id': context.tenant_id,
        'invoice.id': input.invoice_id,
      });

      // Get invoice
      const getResult = await query(
        `SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2`,
        [input.invoice_id, context.tenant_id]
      );

      if (getResult.rows.length === 0) {
        throw new Error('Invoice not found');
      }

      const invoice = getResult.rows[0];

      if (invoice.status === 'paid') {
        throw new Error('Cannot cancel a paid invoice');
      }

      if (parseFloat(invoice.amount_paid) > 0) {
        throw new Error('Cannot cancel invoice with payments. Refund payments first.');
      }

      // Update invoice status
      const result = await query(
        `UPDATE invoices
        SET status = 'cancelled',
            notes = COALESCE(notes || E'\\n\\n', '') || $1,
            updated_at = NOW()
        WHERE id = $2 AND tenant_id = $3
        RETURNING *`,
        [
          `Cancelled: ${input.reason || 'No reason provided'}`,
          input.invoice_id,
          context.tenant_id,
        ]
      );

      // Publish event
      await publishEvent({
        id: randomUUID(),
        type: 'invoicing.invoice_cancelled',
        tenant_id: context.tenant_id,
        occurred_at: new Date().toISOString(),
        actor: { user_id: context.user_id },
        data: {
          invoice_id: input.invoice_id,
          invoice_number: invoice.invoice_number,
          job_id: invoice.job_id,
          client_id: invoice.client_id,
          reason: input.reason,
        },
        schema: 'urn:jobbuilda:events:invoicing.invoice_cancelled:1',
      });

      return result.rows[0];
    } finally {
      span.end();
    }
  });
}
