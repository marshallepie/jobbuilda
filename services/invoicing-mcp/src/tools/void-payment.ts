import { query } from '../lib/database.js';
import type { AuthContext } from '@jobbuilda/contracts';

interface VoidPaymentInput {
  invoice_id: string;
}

export async function voidPayment(input: VoidPaymentInput, context: AuthContext): Promise<any> {
  // Fetch invoice
  const invoiceResult = await query(
    `SELECT * FROM invoices WHERE id = $1::uuid AND tenant_id = $2::uuid`,
    [input.invoice_id, context.tenant_id]
  );

  if (invoiceResult.rows.length === 0) {
    throw new Error('Invoice not found');
  }

  const invoice = invoiceResult.rows[0];

  if (parseFloat(invoice.amount_paid) <= 0) {
    throw new Error('Invoice has no recorded payments to void');
  }

  // Delete all payment records for this invoice
  await query(
    `DELETE FROM invoice_payments WHERE invoice_id = $1::uuid`,
    [input.invoice_id]
  );

  // Reset payment fields; restore status to sent (if previously sent) or draft
  const revertStatus = invoice.sent_at ? 'sent' : 'draft';

  const updatedResult = await query(
    `UPDATE invoices
     SET amount_paid = 0,
         amount_due  = total_inc_vat,
         paid_at     = NULL,
         status      = $2,
         updated_at  = NOW()
     WHERE id = $1::uuid AND tenant_id = $3::uuid
     RETURNING *`,
    [input.invoice_id, revertStatus, context.tenant_id]
  );

  return updatedResult.rows[0];
}
