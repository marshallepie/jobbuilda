import { randomUUID } from 'crypto';
import { query } from '../lib/database.js';
import { stripe } from '../lib/stripe.js';
import { publish } from '../lib/event-bus.js';

interface AuthContext {
  tenant_id: string;
  user_id: string;
  scopes: string[];
}

interface CreateRefundInput {
  transaction_id: string;
  amount?: number; // If not provided, refund full amount
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer' | 'other';
  notes?: string;
}

export async function createRefund(input: CreateRefundInput, context: AuthContext) {
  const { transaction_id, amount, reason = 'requested_by_customer', notes } = input;

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

  if (transaction.status !== 'succeeded') {
    throw new Error('Can only refund succeeded payments');
  }

  if (!transaction.stripe_charge_id) {
    throw new Error('No Stripe charge ID found for this transaction');
  }

  // Determine refund amount
  const refundAmount = amount || parseFloat(transaction.amount);
  const transactionAmount = parseFloat(transaction.amount);

  if (refundAmount > transactionAmount) {
    throw new Error(`Refund amount ${refundAmount} exceeds transaction amount ${transactionAmount}`);
  }

  // Create Stripe refund
  const stripeRefund = await stripe.refunds.create({
    charge: transaction.stripe_charge_id,
    amount: Math.round(refundAmount * 100), // Convert to cents
    reason: reason as any,
    metadata: {
      tenant_id: context.tenant_id,
      transaction_id,
      invoice_id: transaction.invoice_id,
      created_by: context.user_id,
    },
  });

  // Store refund in database
  const refundId = randomUUID();
  const result = await query(
    `INSERT INTO refunds (
       id, tenant_id, payment_transaction_id, invoice_id, stripe_refund_id,
       amount, currency, status, reason, notes, created_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      refundId,
      context.tenant_id,
      transaction_id,
      transaction.invoice_id,
      stripeRefund.id,
      refundAmount,
      transaction.currency,
      stripeRefund.status,
      reason,
      notes,
      context.user_id,
    ]
  );

  const refund = result.rows[0];

  // If refund succeeded immediately, mark as processed
  if (stripeRefund.status === 'succeeded') {
    await query(
      `UPDATE refunds
       SET status = 'succeeded', processed_at = NOW()
       WHERE id = $1`,
      [refundId]
    );
  }

  // Publish event
  await publish({
    id: randomUUID(),
    type: 'payment.refund_created',
    tenant_id: context.tenant_id,
    occurred_at: new Date().toISOString(),
    actor: { user_id: context.user_id },
    data: {
      refund_id: refundId,
      transaction_id,
      invoice_id: transaction.invoice_id,
      amount: refundAmount,
      currency: transaction.currency,
      reason,
      stripe_refund_id: stripeRefund.id,
    },
    schema: 'urn:jobbuilda:events:payment.refund_created:1',
  });

  return {
    refund,
    stripe_refund: {
      id: stripeRefund.id,
      status: stripeRefund.status,
      amount: stripeRefund.amount / 100,
      currency: stripeRefund.currency,
    },
  };
}
