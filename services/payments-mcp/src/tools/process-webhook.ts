import { randomUUID } from 'crypto';
import { query } from '../lib/database.js';
import { publish } from '../lib/event-bus.js';
import Stripe from 'stripe';

interface AuthContext {
  tenant_id: string;
  user_id: string;
  scopes: string[];
}

interface ProcessWebhookInput {
  event_type: string;
  stripe_event_id: string;
  data: any;
}

export async function processWebhook(input: ProcessWebhookInput, context: AuthContext) {
  const { event_type, stripe_event_id, data } = input;

  // Handle payment_intent.succeeded
  if (event_type === 'payment_intent.succeeded') {
    const paymentIntent = data.object as Stripe.PaymentIntent;
    const tenantId = paymentIntent.metadata?.tenant_id;
    const invoiceId = paymentIntent.metadata?.invoice_id;

    if (!tenantId || !invoiceId) {
      throw new Error('Missing tenant_id or invoice_id in payment intent metadata');
    }

    // Update payment intent status
    await query(
      `UPDATE payment_intents
       SET status = 'succeeded', paid_at = NOW()
       WHERE stripe_payment_intent_id = $1 AND tenant_id = $2`,
      [paymentIntent.id, tenantId]
    );

    // Get latest charge
    const charge = paymentIntent.latest_charge as Stripe.Charge;

    // Create payment transaction
    const transactionId = randomUUID();
    const result = await query(
      `INSERT INTO payment_transactions (
         id, tenant_id, payment_intent_id, invoice_id, stripe_payment_intent_id,
         stripe_charge_id, amount, currency, status, payment_method_type,
         payment_method_last4, payment_method_brand, description, receipt_url,
         stripe_event_id, stripe_metadata
       )
       SELECT
         $1, $2, pi.id, $3, $4, $5, $6, $7, 'succeeded', $8, $9, $10, $11, $12, $13, $14
       FROM payment_intents pi
       WHERE pi.stripe_payment_intent_id = $4 AND pi.tenant_id = $2
       RETURNING *`,
      [
        transactionId,
        tenantId,
        invoiceId,
        paymentIntent.id,
        charge?.id,
        paymentIntent.amount / 100, // Convert from cents
        paymentIntent.currency,
        charge?.payment_method_details?.type,
        charge?.payment_method_details?.card?.last4,
        charge?.payment_method_details?.card?.brand,
        paymentIntent.description,
        charge?.receipt_url,
        stripe_event_id,
        JSON.stringify(paymentIntent.metadata),
      ]
    );

    const transaction = result.rows[0];

    // Publish event
    await publish({
      id: randomUUID(),
      type: 'payment.succeeded',
      tenant_id: tenantId,
      occurred_at: new Date().toISOString(),
      actor: { user_id: paymentIntent.metadata?.created_by || 'system' },
      data: {
        transaction_id: transactionId,
        invoice_id: invoiceId,
        amount: transaction.amount,
        currency: transaction.currency,
        stripe_payment_intent_id: paymentIntent.id,
        payment_method: {
          type: transaction.payment_method_type,
          last4: transaction.payment_method_last4,
          brand: transaction.payment_method_brand,
        },
      },
      schema: 'urn:jobbuilda:events:payment.succeeded:1',
    });

    return {
      status: 'processed',
      transaction_id: transactionId,
      message: 'Payment succeeded and transaction recorded',
    };
  }

  // Handle checkout.session.completed
  if (event_type === 'checkout.session.completed') {
    const session = data.object as Stripe.Checkout.Session;
    const tenantId = session.metadata?.tenant_id;

    if (!tenantId) {
      throw new Error('Missing tenant_id in session metadata');
    }

    await query(
      `UPDATE payment_intents
       SET status = 'processing'
       WHERE stripe_checkout_session_id = $1 AND tenant_id = $2`,
      [session.id, tenantId]
    );

    return {
      status: 'processed',
      message: 'Checkout session completed, awaiting payment confirmation',
    };
  }

  // Handle checkout.session.expired
  if (event_type === 'checkout.session.expired') {
    const session = data.object as Stripe.Checkout.Session;
    const tenantId = session.metadata?.tenant_id;

    if (!tenantId) {
      throw new Error('Missing tenant_id in session metadata');
    }

    await query(
      `UPDATE payment_intents
       SET status = 'cancelled'
       WHERE stripe_checkout_session_id = $1 AND tenant_id = $2`,
      [session.id, tenantId]
    );

    return {
      status: 'processed',
      message: 'Checkout session expired',
    };
  }

  // Handle payment_intent.payment_failed
  if (event_type === 'payment_intent.payment_failed') {
    const paymentIntent = data.object as Stripe.PaymentIntent;
    const tenantId = paymentIntent.metadata?.tenant_id;

    if (!tenantId) {
      throw new Error('Missing tenant_id in payment intent metadata');
    }

    await query(
      `UPDATE payment_intents
       SET status = 'failed'
       WHERE stripe_payment_intent_id = $1 AND tenant_id = $2`,
      [paymentIntent.id, tenantId]
    );

    return {
      status: 'processed',
      message: 'Payment failed',
    };
  }

  return {
    status: 'ignored',
    message: `Event type ${event_type} not handled`,
  };
}
