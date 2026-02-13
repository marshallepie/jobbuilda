import { query } from '../lib/database.js';

interface AuthContext {
  tenant_id: string;
  user_id: string;
  scopes: string[];
}

export async function handlePaymentIntentResource(uri: string, context?: AuthContext) {
  if (!context) {
    throw new Error('Authentication context required');
  }

  const uriPattern = /^res:\/\/payments\/payment-intents(?:\/(.+))?$/;
  const match = uri.match(uriPattern);

  if (!match) {
    throw new Error(`Invalid URI pattern: ${uri}`);
  }

  const intentId = match[1];

  if (intentId) {
    // Get single payment intent
    const result = await query(
      `SELECT
         pi.id,
         pi.tenant_id,
         pi.invoice_id,
         pi.stripe_payment_intent_id,
         pi.stripe_checkout_session_id,
         pi.amount,
         pi.currency,
         pi.status,
         pi.client_id,
         pi.description,
         pi.payment_method_types,
         pi.success_url,
         pi.cancel_url,
         pi.created_at,
         pi.updated_at,
         pi.expires_at,
         pi.paid_at,
         pi.created_by
       FROM payment_intents pi
       WHERE pi.id = $1 AND pi.tenant_id = $2`,
      [intentId, context.tenant_id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Payment intent not found: ${intentId}`);
    }

    return result.rows[0];
  } else {
    // List all payment intents
    const result = await query(
      `SELECT
         pi.id,
         pi.invoice_id,
         pi.stripe_payment_intent_id,
         pi.stripe_checkout_session_id,
         pi.amount,
         pi.currency,
         pi.status,
         pi.client_id,
         pi.description,
         pi.created_at,
         pi.expires_at,
         pi.paid_at
       FROM payment_intents pi
       WHERE pi.tenant_id = $1
       ORDER BY pi.created_at DESC`,
      [context.tenant_id]
    );

    return result.rows;
  }
}
