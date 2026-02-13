-- Seed data for payments-mcp (development/testing)

-- Insert payment intent for Invoice 1 (already sent, awaiting payment)
INSERT INTO payment_intents (id, tenant_id, invoice_id, stripe_payment_intent_id, stripe_checkout_session_id, amount, currency, status, client_id, description, success_url, cancel_url, expires_at, created_by, created_at)
VALUES
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'pi_fake_001', 'cs_fake_001', 1743.90, 'gbp', 'succeeded', '00000000-0000-0000-0001-000000000001', 'Payment for INV-20260212-001', 'https://portal.jobbuilda.com/payment/success', 'https://portal.jobbuilda.com/payment/cancel', NOW() + INTERVAL '30 minutes', '00000000-0000-0000-0000-000000000101', NOW() - INTERVAL '2 hours');

-- Mark payment intent as paid
UPDATE payment_intents
SET status = 'succeeded',
    paid_at = NOW() - INTERVAL '1 hour'
WHERE id = 'a0000000-0000-0000-0000-000000000001';

-- Insert successful payment transaction for Invoice 1
INSERT INTO payment_transactions (id, tenant_id, payment_intent_id, invoice_id, stripe_payment_intent_id, stripe_charge_id, amount, currency, status, payment_method_type, payment_method_last4, payment_method_brand, description, receipt_url, stripe_event_id, created_at)
VALUES
  ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'pi_fake_001', 'ch_fake_001', 1743.90, 'gbp', 'succeeded', 'card', '4242', 'visa', 'Payment for INV-20260212-001', 'https://stripe.com/receipts/fake_001', 'evt_fake_001', NOW() - INTERVAL '1 hour');

-- Reconcile the transaction
UPDATE payment_transactions
SET reconciled = TRUE,
    reconciled_at = NOW() - INTERVAL '30 minutes',
    reconciled_by = '00000000-0000-0000-0000-000000000101'
WHERE id = 'b0000000-0000-0000-0000-000000000001';

-- Insert pending payment intent for Invoice 2 (draft invoice)
INSERT INTO payment_intents (id, tenant_id, invoice_id, stripe_payment_intent_id, stripe_checkout_session_id, amount, currency, status, client_id, description, success_url, cancel_url, expires_at, created_by, created_at)
VALUES
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000002', 'pi_fake_002', 'cs_fake_002', 1139.40, 'gbp', 'pending', '00000000-0000-0000-0001-000000000002', 'Payment for INV-20260213-001', 'https://portal.jobbuilda.com/payment/success', 'https://portal.jobbuilda.com/payment/cancel', NOW() + INTERVAL '1 day', '00000000-0000-0000-0000-000000000101', NOW());

-- Verification queries
SELECT 'Payment intents created:' as status, COUNT(*) as count FROM payment_intents;
SELECT 'Payment transactions created:' as status, COUNT(*) as count FROM payment_transactions;

-- Show payment intents summary
SELECT
  pi.id,
  pi.invoice_id,
  pi.stripe_checkout_session_id,
  pi.amount,
  pi.currency,
  pi.status,
  pi.paid_at,
  pi.expires_at
FROM payment_intents pi
ORDER BY pi.created_at DESC;

-- Show payment transactions summary
SELECT
  pt.id,
  pt.invoice_id,
  pt.stripe_charge_id,
  pt.amount,
  pt.currency,
  pt.status,
  pt.payment_method_brand,
  pt.payment_method_last4,
  pt.reconciled,
  pt.created_at
FROM payment_transactions pt
ORDER BY pt.created_at DESC;
