-- ============================================
-- CREATE CLIENT HOURS SUMMARY VIEW
-- Run this if the dashboard is showing blank/timeout
-- ============================================

-- Drop and recreate the view
DROP VIEW IF EXISTS public.client_hours_summary;

CREATE OR REPLACE VIEW public.client_hours_summary AS
SELECT 
  c.id AS client_id,
  c.name AS client_name,
  c.monthly_hours,
  c.color,
  COALESCE(SUM(te.duration_minutes), 0)::INTEGER AS minutes_used,
  ROUND(COALESCE(SUM(te.duration_minutes), 0) / 60.0, 2) AS hours_used,
  c.monthly_hours - ROUND(COALESCE(SUM(te.duration_minutes), 0) / 60.0, 2) AS hours_remaining,
  CASE 
    WHEN c.monthly_hours > 0 
    THEN ROUND((COALESCE(SUM(te.duration_minutes), 0) / 60.0 / c.monthly_hours) * 100, 1)
    ELSE 0 
  END AS usage_percentage
FROM public.clients c
LEFT JOIN public.time_entries te ON te.client_id = c.id
  AND te.start_time >= DATE_TRUNC('month', CURRENT_DATE)
  AND te.start_time < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
WHERE c.is_active = true
GROUP BY c.id, c.name, c.monthly_hours, c.color;

-- Grant access to the view
GRANT SELECT ON public.client_hours_summary TO authenticated;
GRANT SELECT ON public.client_hours_summary TO anon;

-- Verify it works
SELECT * FROM public.client_hours_summary LIMIT 5;
