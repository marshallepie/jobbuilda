-- Create update_updated_at_column function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create payment_accounts table (Stripe Connect accounts for each tenant)
CREATE TABLE IF NOT EXISTS payment_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE,
  stripe_account_id VARCHAR(255) UNIQUE,
  account_type VARCHAR(50) DEFAULT 'express',
  charges_enabled BOOLEAN DEFAULT false,
  payouts_enabled BOOLEAN DEFAULT false,
  details_submitted BOOLEAN DEFAULT false,
  default_currency VARCHAR(3) DEFAULT 'gbp',
  country VARCHAR(2) DEFAULT 'GB',
  business_name VARCHAR(255),
  business_url VARCHAR(255),
  support_email VARCHAR(255),
  support_phone VARCHAR(50),
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_completed_at TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'pending',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT payment_accounts_type_check CHECK (account_type IN ('express', 'standard', 'custom')),
  CONSTRAINT payment_accounts_status_check CHECK (status IN ('pending', 'active', 'restricted', 'disabled'))
);

-- Create payment_intents table
CREATE TABLE IF NOT EXISTS payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  invoice_id UUID NOT NULL,
  stripe_payment_intent_id VARCHAR(255) UNIQUE,
  stripe_checkout_session_id VARCHAR(255) UNIQUE,
  amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'gbp',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  client_id UUID,
  description TEXT,
  payment_method_types TEXT[],
  success_url TEXT,
  cancel_url TEXT,
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT payment_intents_status_check CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'expired'))
);

-- Create payment_transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  payment_intent_id UUID REFERENCES payment_intents(id) ON DELETE SET NULL,
  invoice_id UUID NOT NULL,
  stripe_charge_id VARCHAR(255) UNIQUE,
  stripe_payment_intent_id VARCHAR(255),
  amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'gbp',
  fee NUMERIC(10, 2) DEFAULT 0.00,
  net_amount NUMERIC(10, 2),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  payment_method VARCHAR(50),
  payment_method_details JSONB,
  client_id UUID,
  description TEXT,
  receipt_url TEXT,
  refunded BOOLEAN DEFAULT false,
  refund_amount NUMERIC(10, 2) DEFAULT 0.00,
  failure_code VARCHAR(100),
  failure_message TEXT,
  metadata JSONB,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT payment_transactions_status_check CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded'))
);

-- Create refunds table
CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  payment_transaction_id UUID NOT NULL REFERENCES payment_transactions(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL,
  stripe_refund_id VARCHAR(255) UNIQUE,
  amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'gbp',
  reason VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  failure_reason TEXT,
  receipt_number VARCHAR(255),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT refunds_status_check CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled')),
  CONSTRAINT refunds_reason_check CHECK (reason IN ('duplicate', 'fraudulent', 'requested_by_customer', 'other'))
);

-- Create stripe_webhooks table (for idempotency and audit trail)
CREATE TABLE IF NOT EXISTS stripe_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  tenant_id UUID,
  processed BOOLEAN DEFAULT false,
  payload JSONB NOT NULL,
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Create indexes for payment_accounts
CREATE INDEX IF NOT EXISTS idx_payment_accounts_tenant_id ON payment_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_accounts_stripe_account_id ON payment_accounts(stripe_account_id);
CREATE INDEX IF NOT EXISTS idx_payment_accounts_status ON payment_accounts(status);

-- Create indexes for payment_intents
CREATE INDEX IF NOT EXISTS idx_payment_intents_tenant_id ON payment_intents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_invoice_id ON payment_intents(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_stripe_payment_intent_id ON payment_intents(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON payment_intents(status);
CREATE INDEX IF NOT EXISTS idx_payment_intents_created_at ON payment_intents(created_at DESC);

-- Create indexes for payment_transactions
CREATE INDEX IF NOT EXISTS idx_payment_transactions_tenant_id ON payment_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_invoice_id ON payment_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment_intent_id ON payment_transactions(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_stripe_charge_id ON payment_transactions(stripe_charge_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_client_id ON payment_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at DESC);

-- Create indexes for refunds
CREATE INDEX IF NOT EXISTS idx_refunds_tenant_id ON refunds(tenant_id);
CREATE INDEX IF NOT EXISTS idx_refunds_payment_transaction_id ON refunds(payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_refunds_invoice_id ON refunds(invoice_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);

-- Create indexes for stripe_webhooks
CREATE INDEX IF NOT EXISTS idx_stripe_webhooks_event_id ON stripe_webhooks(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhooks_tenant_id ON stripe_webhooks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhooks_processed ON stripe_webhooks(processed);
CREATE INDEX IF NOT EXISTS idx_stripe_webhooks_event_type ON stripe_webhooks(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_webhooks_received_at ON stripe_webhooks(received_at DESC);

-- Add updated_at triggers
CREATE TRIGGER update_payment_accounts_updated_at
  BEFORE UPDATE ON payment_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_intents_updated_at
  BEFORE UPDATE ON payment_intents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
