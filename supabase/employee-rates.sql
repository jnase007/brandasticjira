-- ============================================
-- EMPLOYEE HOURLY RATES
-- Add cost_rate to profiles for profitability tracking
-- ============================================

-- Add cost_rate column to profiles (employee hourly cost)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS cost_rate DECIMAL(10,2) DEFAULT 50.00;

-- Add job_title column for better organization
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS job_title TEXT;

-- Add department column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS department TEXT;

-- Comment explaining the field
COMMENT ON COLUMN public.profiles.cost_rate IS 'Employee hourly cost rate for profitability calculations';
COMMENT ON COLUMN public.profiles.job_title IS 'Employee job title (e.g., Marketing Manager, SEO Specialist)';
COMMENT ON COLUMN public.profiles.department IS 'Employee department (e.g., Marketing, Development, Design)';

-- ============================================
-- PROFITABILITY VIEW
-- Calculate project and client profitability
-- ============================================

-- Drop if exists to recreate
DROP VIEW IF EXISTS public.project_profitability;

CREATE OR REPLACE VIEW public.project_profitability AS
SELECT 
  c.id as client_id,
  c.name as client_name,
  c.color as client_color,
  c.monthly_hours,
  
  -- Get billing rate (what we charge the client)
  COALESCE(chr.rate_per_hour, 175.00) as billing_rate,
  
  -- Calculate total hours worked
  COALESCE(SUM(
    CASE 
      WHEN te.end_time IS NOT NULL THEN 
        EXTRACT(EPOCH FROM (te.end_time - te.start_time)) / 3600.0
      ELSE 0 
    END
  ), 0) as total_hours,
  
  -- Calculate billable hours
  COALESCE(SUM(
    CASE 
      WHEN te.end_time IS NOT NULL AND te.billable = true THEN 
        EXTRACT(EPOCH FROM (te.end_time - te.start_time)) / 3600.0
      ELSE 0 
    END
  ), 0) as billable_hours,
  
  -- Revenue (billable hours × billing rate)
  COALESCE(SUM(
    CASE 
      WHEN te.end_time IS NOT NULL AND te.billable = true THEN 
        EXTRACT(EPOCH FROM (te.end_time - te.start_time)) / 3600.0
      ELSE 0 
    END
  ), 0) * COALESCE(chr.rate_per_hour, 175.00) as revenue,
  
  -- Cost (all hours × employee cost rates)
  COALESCE(SUM(
    CASE 
      WHEN te.end_time IS NOT NULL THEN 
        (EXTRACT(EPOCH FROM (te.end_time - te.start_time)) / 3600.0) * COALESCE(p.cost_rate, 50.00)
      ELSE 0 
    END
  ), 0) as cost,
  
  -- Profit (revenue - cost)
  (
    COALESCE(SUM(
      CASE 
        WHEN te.end_time IS NOT NULL AND te.billable = true THEN 
          EXTRACT(EPOCH FROM (te.end_time - te.start_time)) / 3600.0
        ELSE 0 
      END
    ), 0) * COALESCE(chr.rate_per_hour, 175.00)
  ) - (
    COALESCE(SUM(
      CASE 
        WHEN te.end_time IS NOT NULL THEN 
          (EXTRACT(EPOCH FROM (te.end_time - te.start_time)) / 3600.0) * COALESCE(p.cost_rate, 50.00)
        ELSE 0 
      END
    ), 0)
  ) as profit,
  
  -- Time period
  DATE_TRUNC('month', CURRENT_DATE) as period_start,
  DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day' as period_end

FROM public.clients c
LEFT JOIN public.time_entries te ON te.client_id = c.id 
  AND te.start_time >= DATE_TRUNC('month', CURRENT_DATE)
  AND te.start_time < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
LEFT JOIN public.profiles p ON te.user_id = p.id
LEFT JOIN public.client_hourly_rates chr ON chr.client_id = c.id
  AND chr.effective_date <= CURRENT_DATE
WHERE c.is_active = true
GROUP BY c.id, c.name, c.color, c.monthly_hours, chr.rate_per_hour;

-- ============================================
-- EMPLOYEE PROFITABILITY VIEW
-- See each employee's contribution to profitability
-- ============================================

DROP VIEW IF EXISTS public.employee_profitability;

CREATE OR REPLACE VIEW public.employee_profitability AS
SELECT 
  p.id as employee_id,
  p.full_name as employee_name,
  p.avatar_url,
  p.job_title,
  p.department,
  p.cost_rate,
  
  -- Total hours worked this month
  COALESCE(SUM(
    CASE 
      WHEN te.end_time IS NOT NULL THEN 
        EXTRACT(EPOCH FROM (te.end_time - te.start_time)) / 3600.0
      ELSE 0 
    END
  ), 0) as total_hours,
  
  -- Billable hours
  COALESCE(SUM(
    CASE 
      WHEN te.end_time IS NOT NULL AND te.billable = true THEN 
        EXTRACT(EPOCH FROM (te.end_time - te.start_time)) / 3600.0
      ELSE 0 
    END
  ), 0) as billable_hours,
  
  -- Total cost (hours × cost rate)
  COALESCE(SUM(
    CASE 
      WHEN te.end_time IS NOT NULL THEN 
        EXTRACT(EPOCH FROM (te.end_time - te.start_time)) / 3600.0
      ELSE 0 
    END
  ), 0) * COALESCE(p.cost_rate, 50.00) as total_cost,
  
  -- Revenue generated (billable hours × client billing rate)
  COALESCE(SUM(
    CASE 
      WHEN te.end_time IS NOT NULL AND te.billable = true THEN 
        (EXTRACT(EPOCH FROM (te.end_time - te.start_time)) / 3600.0) * COALESCE(chr.rate_per_hour, 175.00)
      ELSE 0 
    END
  ), 0) as revenue_generated,
  
  -- Number of clients worked on
  COUNT(DISTINCT te.client_id) as clients_worked,
  
  -- Utilization rate (billable hours / total hours)
  CASE 
    WHEN COALESCE(SUM(
      CASE 
        WHEN te.end_time IS NOT NULL THEN 
          EXTRACT(EPOCH FROM (te.end_time - te.start_time)) / 3600.0
        ELSE 0 
      END
    ), 0) > 0 THEN
      ROUND((
        COALESCE(SUM(
          CASE 
            WHEN te.end_time IS NOT NULL AND te.billable = true THEN 
              EXTRACT(EPOCH FROM (te.end_time - te.start_time)) / 3600.0
            ELSE 0 
          END
        ), 0) / 
        COALESCE(SUM(
          CASE 
            WHEN te.end_time IS NOT NULL THEN 
              EXTRACT(EPOCH FROM (te.end_time - te.start_time)) / 3600.0
            ELSE 0 
          END
        ), 1)
      ) * 100, 1)
    ELSE 0
  END as utilization_rate

FROM public.profiles p
LEFT JOIN public.time_entries te ON te.user_id = p.id 
  AND te.start_time >= DATE_TRUNC('month', CURRENT_DATE)
  AND te.start_time < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
LEFT JOIN public.client_hourly_rates chr ON chr.client_id = te.client_id
  AND chr.effective_date <= CURRENT_DATE
WHERE p.role IN ('team', 'admin')
GROUP BY p.id, p.full_name, p.avatar_url, p.job_title, p.department, p.cost_rate;

-- Grant access to views
GRANT SELECT ON public.project_profitability TO authenticated;
GRANT SELECT ON public.employee_profitability TO authenticated;
