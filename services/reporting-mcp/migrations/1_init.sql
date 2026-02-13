-- reporting-mcp schema
-- Aggregates data from events for financial reporting

-- Report snapshots (cached reports for performance)
CREATE TABLE report_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  report_type TEXT NOT NULL,
    -- 'profit_loss', 'vat_return', 'invoice_summary', 'payment_summary', 'job_summary'

  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Report data (JSON)
  data JSONB NOT NULL,

  -- Metadata
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by UUID NOT NULL,

  -- Cache control
  valid_until TIMESTAMPTZ,
  invalidated BOOLEAN DEFAULT FALSE,

  UNIQUE (tenant_id, report_type, period_start, period_end)
);

CREATE INDEX idx_report_snapshots_tenant ON report_snapshots(tenant_id);
CREATE INDEX idx_report_snapshots_type ON report_snapshots(report_type);
CREATE INDEX idx_report_snapshots_period ON report_snapshots(period_start, period_end);
CREATE INDEX idx_report_snapshots_valid ON report_snapshots(valid_until) WHERE NOT invalidated;

-- Event-sourced financial data (materialized from events)
CREATE TABLE financial_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  event_id UUID NOT NULL UNIQUE,

  -- Event data
  occurred_at TIMESTAMPTZ NOT NULL,
  entity_type TEXT NOT NULL,
    -- 'invoice', 'payment', 'job', 'quote', 'material', 'variation'
  entity_id UUID NOT NULL,

  -- Financial impact
  amount_ex_vat DECIMAL(10, 2),
  vat_amount DECIMAL(10, 2),
  amount_inc_vat DECIMAL(10, 2),

  -- Categorization
  category TEXT NOT NULL,
    -- 'revenue', 'cost', 'payment_received', 'refund'
  subcategory TEXT,

  -- Links
  job_id UUID,
  client_id UUID,

  -- Raw event data
  raw_event JSONB NOT NULL,

  -- Processing
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_financial_events_tenant ON financial_events(tenant_id);
CREATE INDEX idx_financial_events_occurred ON financial_events(occurred_at);
CREATE INDEX idx_financial_events_entity ON financial_events(entity_type, entity_id);
CREATE INDEX idx_financial_events_category ON financial_events(category);
CREATE INDEX idx_financial_events_job ON financial_events(job_id);
CREATE INDEX idx_financial_events_client ON financial_events(client_id);

-- VAT returns (HMRC MTD)
CREATE TABLE vat_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Box values (HMRC VAT100)
  box1_vat_due_sales DECIMAL(10, 2) NOT NULL DEFAULT 0,
  box2_vat_due_acquisitions DECIMAL(10, 2) NOT NULL DEFAULT 0,
  box3_total_vat_due DECIMAL(10, 2) NOT NULL DEFAULT 0,
  box4_vat_reclaimed DECIMAL(10, 2) NOT NULL DEFAULT 0,
  box5_net_vat_due DECIMAL(10, 2) NOT NULL DEFAULT 0,
  box6_total_value_sales_ex_vat DECIMAL(10, 2) NOT NULL DEFAULT 0,
  box7_total_value_purchases_ex_vat DECIMAL(10, 2) NOT NULL DEFAULT 0,
  box8_total_value_supplies_ex_vat DECIMAL(10, 2) NOT NULL DEFAULT 0,
  box9_total_value_acquisitions_ex_vat DECIMAL(10, 2) NOT NULL DEFAULT 0,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft',
    -- draft, submitted, accepted, error

  -- HMRC submission
  hmrc_submission_id TEXT,
  submitted_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL,

  UNIQUE (tenant_id, period_start, period_end)
);

CREATE INDEX idx_vat_returns_tenant ON vat_returns(tenant_id);
CREATE INDEX idx_vat_returns_period ON vat_returns(period_start, period_end);
CREATE INDEX idx_vat_returns_status ON vat_returns(status);

-- Export requests (async report generation)
CREATE TABLE export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Export details
  export_type TEXT NOT NULL,
    -- 'profit_loss_pdf', 'vat_return_pdf', 'invoice_csv', 'payment_csv', 'job_summary_pdf'
  format TEXT NOT NULL,
    -- 'pdf', 'csv', 'xlsx'

  -- Parameters
  period_start DATE,
  period_end DATE,
  filters JSONB,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending',
    -- pending, processing, completed, failed

  -- Result
  file_url TEXT,
  file_size INTEGER,
  error_message TEXT,

  -- Timestamps
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  requested_by UUID NOT NULL
);

CREATE INDEX idx_export_requests_tenant ON export_requests(tenant_id);
CREATE INDEX idx_export_requests_status ON export_requests(status);
CREATE INDEX idx_export_requests_requested ON export_requests(requested_at);

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

CREATE TRIGGER vat_returns_updated_at BEFORE UPDATE ON vat_returns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
