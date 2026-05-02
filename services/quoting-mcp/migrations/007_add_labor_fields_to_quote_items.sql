-- Store labor breakdown fields on quote items so PDF/preview can show hrs × rate correctly
ALTER TABLE quote_items
  ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS labor_rate NUMERIC(10,2);
