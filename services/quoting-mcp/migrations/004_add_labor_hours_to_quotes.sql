-- Add labor tracking fields to quote_items
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(10, 2);
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS labor_rate NUMERIC(10, 2);

-- Add comment explaining the labor calculation
COMMENT ON COLUMN quote_items.estimated_hours IS 'For labor items: estimated hours to complete this specific task';
COMMENT ON COLUMN quote_items.labor_rate IS 'For labor items: hourly rate (£/hour). Total labor cost = estimated_hours × labor_rate';
COMMENT ON COLUMN quote_items.unit_price_ex_vat IS 'For materials: unit price. For labor: calculated as estimated_hours × labor_rate. For other: custom price.';

-- Add quote revision tracking table
CREATE TABLE IF NOT EXISTS quote_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  change_description TEXT,
  previous_total NUMERIC(10, 2),
  new_total NUMERIC(10, 2),
  changed_by UUID NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT quote_revisions_unique UNIQUE (quote_id, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_quote_revisions_quote_id ON quote_revisions(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_revisions_changed_at ON quote_revisions(changed_at DESC);

-- Add approval tracking to quotes
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Function to create a revision record when quote totals change significantly
CREATE OR REPLACE FUNCTION track_quote_revision()
RETURNS TRIGGER AS $$
DECLARE
  rev_num INTEGER;
BEGIN
  -- Only track if total changed by more than £0.01
  IF ABS(NEW.total_inc_vat - OLD.total_inc_vat) > 0.01 THEN
    -- Get next revision number
    SELECT COALESCE(MAX(revision_number), 0) + 1 INTO rev_num
    FROM quote_revisions
    WHERE quote_id = NEW.id;

    -- Insert revision record
    INSERT INTO quote_revisions (
      tenant_id, quote_id, revision_number,
      previous_total, new_total, changed_by
    ) VALUES (
      NEW.tenant_id, NEW.id, rev_num,
      OLD.total_inc_vat, NEW.total_inc_vat, NEW.created_by
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_quote_revisions
  AFTER UPDATE OF total_inc_vat ON quotes
  FOR EACH ROW
  WHEN (OLD.total_inc_vat IS DISTINCT FROM NEW.total_inc_vat)
  EXECUTE FUNCTION track_quote_revision();
