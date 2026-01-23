-- ============================================
-- BACKFILL TIME ENTRIES (minutes/date)
-- Run in Supabase SQL Editor
-- ============================================

UPDATE public.time_entries
SET
  minutes = COALESCE(minutes, duration_minutes, 0),
  date = COALESCE(date, (start_time::date))
WHERE minutes IS NULL OR date IS NULL;

SELECT 'Time entries backfill complete' AS status;
