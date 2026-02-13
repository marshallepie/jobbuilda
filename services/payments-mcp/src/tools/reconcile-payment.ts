import { query } from '../lib/database.js';
import { publish } from '../lib/event-bus.js';
import { randomUUID } from 'crypto';

interface AuthContext {
  tenant_id: string;
  user_id: string;
  scopes: string[];
}

interface ReconcilePaymentInput {
  transaction_id: string;
}

export async function reconcilePayment(input: ReconcilePaymentInput, context: AuthContext) {
  const { transaction_id } = input;

  // Get transaction
  const transactionResult = await query(
    `SELECT * FROM payment_transactions
     WHERE id = $1 AND tenant_id = $2`,
    [transaction_id, context.tenant_id]
  );

  if (transactionResult.rows.length === 0) {
    throw new Error(`Payment transaction not found: ${transaction_id}`);
  }

  const transaction = transactionResult.rows[0];

  if (transaction.reconciled) {
    throw new Error('Payment transaction is already reconciled');
  }

  if (transaction.status !== 'succeeded') {
    throw new Error('Can only reconcile succeeded payments');
  }

  // Mark as reconciled
  const result = await query(
    `UPDATE payment_transactions
     SET reconciled = TRUE,
         reconciled_at = NOW(),
         reconciled_by = $1
     WHERE id = $2 AND tenant_id = $3
     RETURNING *`,
    [context.user_id, transaction_id, context.tenant_id]
  );

  const reconciledTransaction = result.rows[0];

  // Publish event
  await publish({
    id: randomUUID(),
    type: 'payment.reconciled',
    tenant_id: context.tenant_id,
    occurred_at: new Date().toISOString(),
    actor: { user_id: context.user_id },
    data: {
      transaction_id,
      invoice_id: transaction.invoice_id,
      amount: parseFloat(transaction.amount),
      reconciled_by: context.user_id,
    },
    schema: 'urn:jobbuilda:events:payment.reconciled:1',
  });

  return {
    success: true,
    transaction: reconciledTransaction,
    message: 'Payment reconciled successfully',
  };
}
