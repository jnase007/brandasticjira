-- =====================================================
-- DIAGNOSTIC: Check Time Entries Table
-- Run this in Supabase SQL Editor to see your data
-- =====================================================

-- 1. Check what columns exist on time_entries
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'time_entries'
ORDER BY ordinal_position;

-- 2. Count total time entries
SELECT COUNT(*) as total_entries FROM time_entries;

-- 3. See recent time entries with key fields
SELECT 
  id,
  user_id,
  ticket_id,
  minutes,
  duration_minutes,
  date,
  start_time,
  end_time,
  is_running,
  billable,
  description,
  created_at
FROM time_entries
ORDER BY created_at DESC
LIMIT 10;

-- 4. Check entries for current month (January 2026)
SELECT 
  id,
  minutes,
  date,
  start_time,
  created_at,
  description
FROM time_entries
WHERE (date >= '2026-01-01' OR start_time >= '2026-01-01' OR created_at >= '2026-01-01')
ORDER BY created_at DESC
LIMIT 20;

-- 5. Sum total minutes for current user this month
SELECT 
  user_id,
  SUM(COALESCE(minutes, duration_minutes, 0)) as total_minutes,
  COUNT(*) as entry_count
FROM time_entries
WHERE date >= '2026-01-01' OR start_time >= '2026-01-01' OR created_at >= '2026-01-01'
GROUP BY user_id;
