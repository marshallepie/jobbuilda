-- Fix time_entries table - add missing columns
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS date DATE;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS break_minutes INTEGER DEFAULT 0;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS is_overtime BOOLEAN DEFAULT FALSE;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS notes TEXT;

-- Update date from start_time if it's null
UPDATE time_entries SET date = start_time::date WHERE date IS NULL;

-- Verify columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'time_entries'
  AND column_name IN ('date', 'break_minutes', 'is_overtime', 'notes')
ORDER BY column_name;
