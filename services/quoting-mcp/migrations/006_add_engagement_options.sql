-- Add engagement options and digital project fields to quotes
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS engagement_type VARCHAR(20) NOT NULL DEFAULT 'option_a',
  ADD COLUMN IF NOT EXISTS option_b_percent NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS option_c_equity_percent NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS option_b_label TEXT,
  ADD COLUMN IF NOT EXISTS option_c_label TEXT,
  ADD COLUMN IF NOT EXISTS engagement_selected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS engagement_selected_by VARCHAR(10),
  ADD COLUMN IF NOT EXISTS is_digital BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS digital_site TEXT,
  ADD COLUMN IF NOT EXISTS project_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE quotes
  ADD CONSTRAINT quotes_engagement_type_check
    CHECK (engagement_type IN ('option_a', 'option_b', 'option_c'));

ALTER TABLE quotes
  ADD CONSTRAINT quotes_engagement_selected_by_check
    CHECK (engagement_selected_by IN ('client', 'admin') OR engagement_selected_by IS NULL);
