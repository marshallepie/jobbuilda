import { query } from '../lib/database.js';
import { publishEvent } from '../lib/event-bus.js';
import { trace } from '@opentelemetry/api';
import type { AuthContext } from '@jobbuilda/contracts';
import { randomUUID } from 'crypto';

const tracer = trace.getTracer('invoicing-mcp');

interface RecordPaymentInput {
  invoice_id: string;
  amount: number;
  payment_date?: string;
  payment_method?: string;
  payment_reference?: string;
  notes?: string;
}

export async function recordPayment(
  input: RecordPaymentInput,
  context: AuthContext
): Promise<any> {
  return tracer.startActiveSpan('tool.record_payment', async (span) => {
    try {
      span.setAttributes({
        'tenant.id': context.tenant_id,
        'invoice.id': input.invoice_id,
        'payment.amount': input.amount,
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

      if (invoice.status === 'cancelled') {
        throw new Error('Cannot record payment for cancelled invoice');
      }

      const newAmountPaid = parseFloat(invoice.amount_paid) + input.amount;
      const totalIncVat = parseFloat(invoice.total_inc_vat);
      const newAmountDue = totalIncVat - newAmountPaid;

      // Determine new status
      let newStatus = invoice.status;
      let paidAt = invoice.paid_at;

      if (newAmountDue <= 0.01) { // Account for floating point precision
        newStatus = 'paid';
        paidAt = input.payment_date || new Date().toISOString();
      } else if (invoice.status === 'draft') {
        newStatus = 'sent'; // Partial payment implies it was sent
      }

      // Update invoice
      const result = await query(
        `UPDATE invoices
        SET amount_paid = $1,
            amount_due = $2,
            status = $3,
            paid_at = $4,
            updated_at = NOW()
        WHERE id = $5 AND tenant_id = $6
        RETURNING *`,
        [
          newAmountPaid,
          newAmountDue,
          newStatus,
          paidAt,
          input.invoice_id,
          context.tenant_id,
        ]
      );

      // Publish event
      await publishEvent({
        id: randomUUID(),
        type: 'invoicing.payment_recorded',
        tenant_id: context.tenant_id,
        occurred_at: new Date().toISOString(),
        actor: { user_id: context.user_id },
        data: {
          invoice_id: input.invoice_id,
          invoice_number: invoice.invoice_number,
          job_id: invoice.job_id,
          client_id: invoice.client_id,
          payment_amount: input.amount,
          amount_paid: newAmountPaid,
          amount_due: newAmountDue,
          payment_method: input.payment_method,
          payment_reference: input.payment_reference,
          fully_paid: newAmountDue <= 0.01,
        },
        schema: 'urn:jobbuilda:events:invoicing.payment_recorded:1',
      });

      return result.rows[0];
    } finally {
      span.end();
    }
  });
}
