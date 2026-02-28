import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { trace } from '@opentelemetry/api';
import type { AuthContext } from '@jobbuilda/contracts';
import { randomUUID } from 'crypto';

const tracer = trace.getTracer('invoicing-mcp');

interface SendInvoiceInput {
  invoice_id: string;
}

export async function sendInvoice(
  input: SendInvoiceInput,
  context: AuthContext
): Promise<any> {
  return tracer.startActiveSpan('tool.send_invoice', async (span) => {
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

      if (invoice.status !== 'draft') {
        throw new Error(`Cannot send invoice with status: ${invoice.status}`);
      }

      // Update invoice status to sent
      const result = await query(
        `UPDATE invoices
        SET status = 'sent',
            sent_at = NOW(),
            updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2
        RETURNING *`,
        [input.invoice_id, context.tenant_id]
      );

      // Publish event
      await publishEvent({
        id: randomUUID(),
        type: 'invoicing.invoice_sent',
        tenant_id: context.tenant_id,
        occurred_at: new Date().toISOString(),
        actor: { user_id: context.user_id },
        data: {
          invoice_id: input.invoice_id,
          invoice_number: invoice.invoice_number,
          job_id: invoice.job_id,
          client_id: invoice.client_id,
          total_inc_vat: parseFloat(invoice.total_inc_vat),
          due_date: invoice.due_date,
        },
        schema: 'urn:jobbuilda:events:invoicing.invoice_sent:1',
      });

      return result.rows[0];
    } finally {
      span.end();
    }
  });
}
