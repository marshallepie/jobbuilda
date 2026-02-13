-- payments-mcp schema
-- Handles Stripe payment processing and reconciliation

-- Payment intents (Stripe checkout sessions)
CREATE TABLE payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  invoice_id UUID NOT NULL,

  -- Stripe details
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_checkout_session_id TEXT UNIQUE,

  -- Payment details
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'gbp',
  status TEXT NOT NULL DEFAULT 'pending',
    -- pending: created but not paid
    -- processing: payment in progress
    -- succeeded: payment successful
    -- failed: payment failed
    -- cancelled: cancelled before payment

  -- Links
  client_id UUID,

  -- Metadata
  description TEXT,
  payment_method_types TEXT[] DEFAULT ARRAY['card'],

  -- URLs
  success_url TEXT,
  cancel_url TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,

  -- Audit
  created_by UUID NOT NULL
);

CREATE INDEX idx_payment_intents_tenant ON payment_intents(tenant_id);
CREATE INDEX idx_payment_intents_invoice ON payment_intents(invoice_id);
CREATE INDEX idx_payment_intents_status ON payment_intents(status);
CREATE INDEX idx_payment_intents_stripe_intent ON payment_intents(stripe_payment_intent_id);
CREATE INDEX idx_payment_intents_stripe_session ON payment_intents(stripe_checkout_session_id);

-- Payment transactions (actual payments)
CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  payment_intent_id UUID REFERENCES payment_intents(id),
  invoice_id UUID NOT NULL,

  -- Stripe details
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,

  -- Transaction details
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'gbp',
  status TEXT NOT NULL DEFAULT 'pending',
    -- pending, succeeded, failed, refunded

  -- Payment method
  payment_method_type TEXT,
  payment_method_last4 TEXT,
  payment_method_brand TEXT,

  -- Reconciliation
  reconciled BOOLEAN DEFAULT FALSE,
  reconciled_at TIMESTAMPTZ,
  reconciled_by UUID,

  -- Metadata
  description TEXT,
  receipt_url TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Stripe webhook data
  stripe_event_id TEXT,
  stripe_metadata JSONB
);

CREATE INDEX idx_payment_transactions_tenant ON payment_transactions(tenant_id);
CREATE INDEX idx_payment_transactions_intent ON payment_transactions(payment_intent_id);
CREATE INDEX idx_payment_transactions_invoice ON payment_transactions(invoice_id);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX idx_payment_transactions_reconciled ON payment_transactions(reconciled);
CREATE INDEX idx_payment_transactions_stripe_intent ON payment_transactions(stripe_payment_intent_id);

-- Refunds
CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  payment_transaction_id UUID NOT NULL REFERENCES payment_transactions(id),
  invoice_id UUID NOT NULL,

  -- Stripe details
  stripe_refund_id TEXT UNIQUE,

  -- Refund details
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'gbp',
  status TEXT NOT NULL DEFAULT 'pending',
    -- pending, succeeded, failed, cancelled
  reason TEXT,
    -- duplicate, fraudulent, requested_by_customer, other

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,

  -- Audit
  created_by UUID NOT NULL,

  -- Metadata
  notes TEXT,
  stripe_metadata JSONB
);

CREATE INDEX idx_refunds_tenant ON refunds(tenant_id);
CREATE INDEX idx_refunds_transaction ON refunds(payment_transaction_id);
CREATE INDEX idx_refunds_invoice ON refunds(invoice_id);
CREATE INDEX idx_refunds_status ON refunds(status);

-- Event outbox for NATS publishing
CREATE TABLE event_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  tenant_id UUID NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE INDEX idx_event_outbox_published ON event_outbox(published_at) WHERE published_at IS NULL;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_intents_updated_at BEFORE UPDATE ON payment_intents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER payment_transactions_updated_at BEFORE UPDATE ON payment_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER refunds_updated_at BEFORE UPDATE ON refunds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
