-- Verify job_items table exists
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name IN ('job_items', 'time_entries')
ORDER BY table_name, ordinal_position;

-- Count rows in tables
SELECT 'job_items' as table_name, COUNT(*) as row_count FROM job_items
UNION ALL
SELECT 'time_entries' as table_name, COUNT(*) as row_count FROM time_entries;
