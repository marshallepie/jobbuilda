import { query } from '../lib/database.js';

interface AuthContext {
  tenant_id: string;
  user_id: string;
  scopes: string[];
}

export async function handlePaymentTransactionResource(uri: string, context?: AuthContext) {
  if (!context) {
    throw new Error('Authentication context required');
  }

  const uriPattern = /^res:\/\/payments\/transactions(?:\/(.+))?$/;
  const match = uri.match(uriPattern);

  if (!match) {
    throw new Error(`Invalid URI pattern: ${uri}`);
  }

  const transactionId = match[1];

  if (transactionId) {
    // Get single transaction
    const result = await query(
      `SELECT
         pt.id,
         pt.tenant_id,
         pt.payment_intent_id,
         pt.invoice_id,
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
         pt.reconciled_by,
         pt.description,
         pt.receipt_url,
         pt.created_at,
         pt.updated_at,
         pt.stripe_event_id
       FROM payment_transactions pt
       WHERE pt.id = $1 AND pt.tenant_id = $2`,
      [transactionId, context.tenant_id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Payment transaction not found: ${transactionId}`);
    }

    return result.rows[0];
  } else {
    // List all transactions
    const result = await query(
      `SELECT
         pt.id,
         pt.invoice_id,
         pt.stripe_payment_intent_id,
         pt.stripe_charge_id,
         pt.amount,
         pt.currency,
         pt.status,
         pt.payment_method_type,
         pt.payment_method_brand,
         pt.reconciled,
         pt.created_at
       FROM payment_transactions pt
       WHERE pt.tenant_id = $1
       ORDER BY pt.created_at DESC`,
      [context.tenant_id]
    );

    return result.rows;
  }
}
