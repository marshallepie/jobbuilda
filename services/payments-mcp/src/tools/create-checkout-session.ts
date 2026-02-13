import { randomUUID } from 'crypto';
import { query } from '../lib/database.js';
import { stripe } from '../lib/stripe.js';
import { publish } from '../lib/event-bus.js';

interface AuthContext {
  tenant_id: string;
  user_id: string;
  scopes: string[];
}

interface CreateCheckoutSessionInput {
  invoice_id: string;
  amount: number;
  currency?: string;
  description?: string;
  client_id?: string;
  success_url: string;
  cancel_url: string;
  payment_method_types?: string[];
  expires_in_minutes?: number;
}

export async function createCheckoutSession(
  input: CreateCheckoutSessionInput,
  context: AuthContext
) {
  const {
    invoice_id,
    amount,
    currency = 'gbp',
    description,
    client_id,
    success_url,
    cancel_url,
    payment_method_types = ['card'],
    expires_in_minutes = 30,
  } = input;

  // Create Stripe checkout session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: payment_method_types as any,
    line_items: [
      {
        price_data: {
          currency,
          product_data: {
            name: description || `Invoice Payment`,
            description: `Payment for invoice ${invoice_id}`,
          },
          unit_amount: Math.round(amount * 100), // Convert to cents
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url,
    cancel_url,
    expires_at: Math.floor(Date.now() / 1000) + expires_in_minutes * 60,
    metadata: {
      tenant_id: context.tenant_id,
      invoice_id,
      created_by: context.user_id,
    },
  });

  // Store payment intent in database
  const intentId = randomUUID();
  const expiresAt = new Date(Date.now() + expires_in_minutes * 60 * 1000);

  const result = await query(
    `INSERT INTO payment_intents (
       id, tenant_id, invoice_id, stripe_payment_intent_id, stripe_checkout_session_id,
       amount, currency, status, client_id, description, payment_method_types,
       success_url, cancel_url, expires_at, created_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING *`,
    [
      intentId,
      context.tenant_id,
      invoice_id,
      session.payment_intent as string,
      session.id,
      amount,
      currency,
      'pending',
      client_id,
      description,
      payment_method_types,
      success_url,
      cancel_url,
      expiresAt,
      context.user_id,
    ]
  );

  const paymentIntent = result.rows[0];

  // Publish event
  await publish({
    id: randomUUID(),
    type: 'payment.checkout_session_created',
    tenant_id: context.tenant_id,
    occurred_at: new Date().toISOString(),
    actor: { user_id: context.user_id },
    data: {
      payment_intent_id: intentId,
      invoice_id,
      amount,
      currency,
      stripe_checkout_session_id: session.id,
      checkout_url: session.url,
    },
    schema: 'urn:jobbuilda:events:payment.checkout_session_created:1',
  });

  return {
    payment_intent: paymentIntent,
    checkout_url: session.url,
    stripe_session_id: session.id,
  };
}
