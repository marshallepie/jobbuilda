-- ============================================
-- Fix Jobs Table - Add Missing Columns
-- ============================================
-- Run this in Supabase SQL Editor
-- ============================================

-- Add notes column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'jobs' AND column_name = 'notes'
    ) THEN
        ALTER TABLE jobs ADD COLUMN notes TEXT;
        RAISE NOTICE 'Added notes column to jobs table';
    ELSE
        RAISE NOTICE 'notes column already exists';
    END IF;
END $$;

-- Check if electrical work columns exist (from migration 002)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'jobs' AND column_name = 'electrical_work_type'
    ) THEN
        ALTER TABLE jobs ADD COLUMN electrical_work_type VARCHAR(50);
        RAISE NOTICE 'Added electrical_work_type column to jobs table';
    ELSE
        RAISE NOTICE 'electrical_work_type column already exists';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'jobs' AND column_name = 'creates_new_circuits'
    ) THEN
        ALTER TABLE jobs ADD COLUMN creates_new_circuits BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added creates_new_circuits column to jobs table';
    ELSE
        RAISE NOTICE 'creates_new_circuits column already exists';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'jobs' AND column_name = 'circuit_details'
    ) THEN
        ALTER TABLE jobs ADD COLUMN circuit_details JSONB;
        RAISE NOTICE 'Added circuit_details column to jobs table';
    ELSE
        RAISE NOTICE 'circuit_details column already exists';
    END IF;
END $$;

-- Verify all columns exist
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'jobs'
  AND column_name IN ('notes', 'electrical_work_type', 'creates_new_circuits', 'circuit_details')
ORDER BY column_name;
