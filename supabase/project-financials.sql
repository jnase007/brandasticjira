-- ============================================
-- PROJECT FINANCIALS SCHEMA
-- Budget tracking, break-even analysis, overhead costs
-- ============================================

-- Add project budget fields to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS project_budget DECIMAL(12,2) DEFAULT 0;

ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS project_start_date DATE;

ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS project_end_date DATE;

ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS overhead_percentage DECIMAL(5,2) DEFAULT 20.00;

COMMENT ON COLUMN public.clients.project_budget IS 'Total budget for the project/client engagement';
COMMENT ON COLUMN public.clients.project_start_date IS 'Project start date';
COMMENT ON COLUMN public.clients.project_end_date IS 'Project end date';
COMMENT ON COLUMN public.clients.overhead_percentage IS 'Overhead percentage to add to labor costs (default 20%)';

-- ============================================
-- COMPANY SETTINGS FOR GLOBAL OVERHEAD
-- ============================================

CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default overhead percentage
INSERT INTO public.company_settings (setting_key, setting_value, description)
VALUES 
  ('default_overhead_percentage', '20', 'Default overhead percentage for labor cost calculations'),
  ('default_billing_rate', '175', 'Default hourly billing rate for new clients'),
  ('default_employee_cost_rate', '50', 'Default employee hourly cost rate')
ON CONFLICT (setting_key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can modify settings
CREATE POLICY "Admin can manage settings"
ON public.company_settings FOR ALL
USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

-- Everyone can read settings
CREATE POLICY "All authenticated can read settings"
ON public.company_settings FOR SELECT
USING (auth.role() = 'authenticated');

-- ============================================
-- ENHANCED PROJECT FINANCIALS VIEW
-- With overhead and break-even calculations
-- ============================================

DROP VIEW IF EXISTS public.project_financials;

CREATE OR REPLACE VIEW public.project_financials AS
WITH time_data AS (
  SELECT 
    c.id as client_id,
    c.name as client_name,
    c.color as client_color,
    c.logo_url,
    c.engagement_type,
    c.project_budget,
    c.project_start_date,
    c.project_end_date,
    c.monthly_hours,
    COALESCE(c.overhead_percentage, 20.00) as overhead_percentage,
    COALESCE(chr.rate_per_hour, 175.00) as billing_rate,
    
    -- Calculate dates
    COALESCE(c.project_start_date, DATE_TRUNC('month', MIN(te.start_time))::DATE) as actual_start,
    COALESCE(c.project_end_date, DATE_TRUNC('month', CURRENT_DATE + INTERVAL '3 months')::DATE) as actual_end,
    
    -- Total hours worked (all time)
    COALESCE(SUM(te.minutes) / 60.0, 0) as total_hours,
    
    -- Billable hours (all time)
    COALESCE(SUM(CASE WHEN te.billable = true THEN te.minutes ELSE 0 END) / 60.0, 0) as billable_hours,
    
    -- Labor cost (hours × employee cost rates)
    COALESCE(SUM((te.minutes / 60.0) * COALESCE(p.cost_rate, 50.00)), 0) as labor_cost,
    
    -- Revenue (billable hours × billing rate)
    COALESCE(SUM(CASE WHEN te.billable = true THEN (te.minutes / 60.0) * COALESCE(chr.rate_per_hour, 175.00) ELSE 0 END), 0) as revenue,
    
    -- This month's data
    COALESCE(SUM(CASE 
      WHEN te.date >= DATE_TRUNC('month', CURRENT_DATE) 
      THEN te.minutes ELSE 0 
    END) / 60.0, 0) as this_month_hours,
    
    COALESCE(SUM(CASE 
      WHEN te.date >= DATE_TRUNC('month', CURRENT_DATE) AND te.billable = true
      THEN (te.minutes / 60.0) * COALESCE(chr.rate_per_hour, 175.00) ELSE 0 
    END), 0) as this_month_revenue

  FROM public.clients c
  LEFT JOIN public.time_entries te ON te.client_id = c.id
  LEFT JOIN public.profiles p ON te.user_id = p.id
  LEFT JOIN public.client_hourly_rates chr ON chr.client_id = c.id
    AND chr.effective_date <= CURRENT_DATE
  WHERE c.is_active = true
  GROUP BY c.id, c.name, c.color, c.logo_url, c.engagement_type, 
           c.project_budget, c.project_start_date, c.project_end_date,
           c.monthly_hours, c.overhead_percentage, chr.rate_per_hour
)
SELECT 
  *,
  
  -- Total cost (labor + overhead)
  labor_cost * (1 + overhead_percentage / 100) as total_cost,
  
  -- Profit (revenue - total cost)
  revenue - (labor_cost * (1 + overhead_percentage / 100)) as profit,
  
  -- Profit margin percentage
  CASE 
    WHEN revenue > 0 THEN 
      ROUND(((revenue - (labor_cost * (1 + overhead_percentage / 100))) / revenue) * 100, 1)
    ELSE 0 
  END as profit_margin,
  
  -- Budget remaining
  CASE 
    WHEN project_budget > 0 THEN 
      project_budget - revenue 
    ELSE 0 
  END as budget_remaining,
  
  -- Budget used percentage
  CASE 
    WHEN project_budget > 0 THEN 
      ROUND((revenue / project_budget) * 100, 1)
    ELSE 0 
  END as budget_used_percentage,
  
  -- Days in project
  CASE 
    WHEN actual_end > actual_start THEN 
      actual_end - actual_start 
    ELSE 0 
  END as total_days,
  
  -- Days elapsed
  CASE 
    WHEN CURRENT_DATE > actual_start THEN 
      LEAST(CURRENT_DATE - actual_start, actual_end - actual_start)
    ELSE 0 
  END as days_elapsed,
  
  -- Days remaining
  CASE 
    WHEN actual_end > CURRENT_DATE THEN 
      actual_end - CURRENT_DATE 
    ELSE 0 
  END as days_remaining,
  
  -- Schedule percentage
  CASE 
    WHEN (actual_end - actual_start) > 0 THEN 
      ROUND((LEAST(CURRENT_DATE - actual_start, actual_end - actual_start)::NUMERIC / (actual_end - actual_start)::NUMERIC) * 100, 1)
    ELSE 0 
  END as schedule_percentage,
  
  -- Break-even point (where revenue covers costs)
  CASE 
    WHEN billing_rate > (labor_cost * (1 + overhead_percentage / 100) / NULLIF(billable_hours, 0)) THEN
      'Profitable'
    WHEN billable_hours > 0 THEN
      'Below Break-even'
    ELSE
      'No Data'
  END as break_even_status,
  
  -- Hours needed to break even on budget
  CASE 
    WHEN billing_rate > 0 AND project_budget > 0 THEN 
      ROUND(project_budget / billing_rate, 1)
    ELSE 0 
  END as budget_hours_target

FROM time_data;

-- Grant access
GRANT SELECT ON public.project_financials TO authenticated;

-- ============================================
-- MONTHLY BURN RATE VIEW
-- Track spending over time
-- ============================================

DROP VIEW IF EXISTS public.monthly_burn_rate;

CREATE OR REPLACE VIEW public.monthly_burn_rate AS
SELECT 
  c.id as client_id,
  c.name as client_name,
  DATE_TRUNC('month', te.date)::DATE as month,
  
  -- Hours
  COALESCE(SUM(te.minutes) / 60.0, 0) as hours_worked,
  COALESCE(SUM(CASE WHEN te.billable THEN te.minutes ELSE 0 END) / 60.0, 0) as billable_hours,
  
  -- Revenue
  COALESCE(SUM(CASE WHEN te.billable THEN (te.minutes / 60.0) * COALESCE(chr.rate_per_hour, 175.00) ELSE 0 END), 0) as revenue,
  
  -- Labor cost
  COALESCE(SUM((te.minutes / 60.0) * COALESCE(p.cost_rate, 50.00)), 0) as labor_cost,
  
  -- Total cost with overhead
  COALESCE(SUM((te.minutes / 60.0) * COALESCE(p.cost_rate, 50.00)), 0) * 
    (1 + COALESCE(c.overhead_percentage, 20.00) / 100) as total_cost,
  
  -- Profit
  COALESCE(SUM(CASE WHEN te.billable THEN (te.minutes / 60.0) * COALESCE(chr.rate_per_hour, 175.00) ELSE 0 END), 0) -
  (COALESCE(SUM((te.minutes / 60.0) * COALESCE(p.cost_rate, 50.00)), 0) * 
    (1 + COALESCE(c.overhead_percentage, 20.00) / 100)) as profit

FROM public.clients c
INNER JOIN public.time_entries te ON te.client_id = c.id
LEFT JOIN public.profiles p ON te.user_id = p.id
LEFT JOIN public.client_hourly_rates chr ON chr.client_id = c.id
  AND chr.effective_date <= te.date
WHERE c.is_active = true
GROUP BY c.id, c.name, DATE_TRUNC('month', te.date), c.overhead_percentage, chr.rate_per_hour
ORDER BY c.name, month;

GRANT SELECT ON public.monthly_burn_rate TO authenticated;
