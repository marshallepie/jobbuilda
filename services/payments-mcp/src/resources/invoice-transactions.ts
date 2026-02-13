import { query } from '../lib/database.js';

interface AuthContext {
  tenant_id: string;
  user_id: string;
  scopes: string[];
}

export async function handleInvoiceTransactionsResource(uri: string, context?: AuthContext) {
  if (!context) {
    throw new Error('Authentication context required');
  }

  const uriPattern = /^res:\/\/payments\/invoice-transactions\/(.+)$/;
  const match = uri.match(uriPattern);

  if (!match) {
    throw new Error(`Invalid URI pattern: ${uri}`);
  }

  const invoiceId = match[1];

  // Get all transactions for an invoice
  const result = await query(
    `SELECT
       pt.id,
       pt.payment_intent_id,
       pt.stripe_payment_intent_id,
       pt.stripe_charge_id,
       pt.amount,
       pt.currency,
       pt.status,
       pt.payment_method_type,
       pt.payment_method_last4,
       pt.payment_method_brand,
       pt.reconciled,
       pt.reconciled_at,
       pt.receipt_url,
       pt.created_at
     FROM payment_transactions pt
     WHERE pt.invoice_id = $1 AND pt.tenant_id = $2
     ORDER BY pt.created_at DESC`,
    [invoiceId, context.tenant_id]
  );

  return result.rows;
}
