-- ============================================
-- A-LA-CARTE / OUT-OF-SCOPE PROJECTS
-- Track billable projects outside of retainers
-- ============================================

-- Add billing type to tickets
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS billing_type TEXT DEFAULT 'retainer';

-- Add estimated and actual billing amounts
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS estimated_amount DECIMAL(12,2);

ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS actual_amount DECIMAL(12,2);

-- Add is_billable flag (for quick filtering)
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS is_billable BOOLEAN DEFAULT true;

-- Comments
COMMENT ON COLUMN public.tickets.billing_type IS 'retainer = included in monthly, alacarte = billed separately, internal = not billed';
COMMENT ON COLUMN public.tickets.estimated_amount IS 'Estimated billing amount for a-la-carte projects';
COMMENT ON COLUMN public.tickets.actual_amount IS 'Actual billed amount for a-la-carte projects';
COMMENT ON COLUMN public.tickets.is_billable IS 'Whether this ticket is billable to the client';

-- ============================================
-- A-LA-CARTE REVENUE VIEW
-- Track revenue from out-of-scope projects
-- ============================================

DROP VIEW IF EXISTS public.alacarte_revenue;

CREATE OR REPLACE VIEW public.alacarte_revenue AS
SELECT 
  c.id as client_id,
  c.name as client_name,
  c.logo_url,
  
  -- Count of a-la-carte tickets
  COUNT(CASE WHEN t.billing_type = 'alacarte' THEN 1 END) as alacarte_count,
  
  -- Estimated revenue
  COALESCE(SUM(CASE WHEN t.billing_type = 'alacarte' THEN t.estimated_amount END), 0) as estimated_revenue,
  
  -- Actual revenue (billed)
  COALESCE(SUM(CASE WHEN t.billing_type = 'alacarte' AND t.status = 'closed' THEN COALESCE(t.actual_amount, t.estimated_amount) END), 0) as actual_revenue,
  
  -- Pending revenue (not yet closed)
  COALESCE(SUM(CASE WHEN t.billing_type = 'alacarte' AND t.status != 'closed' THEN t.estimated_amount END), 0) as pending_revenue,
  
  -- This month
  COALESCE(SUM(CASE 
    WHEN t.billing_type = 'alacarte' 
    AND t.created_at >= DATE_TRUNC('month', CURRENT_DATE)
    THEN t.estimated_amount 
  END), 0) as this_month_estimated,
  
  COALESCE(SUM(CASE 
    WHEN t.billing_type = 'alacarte' 
    AND t.status = 'closed'
    AND t.updated_at >= DATE_TRUNC('month', CURRENT_DATE)
    THEN COALESCE(t.actual_amount, t.estimated_amount) 
  END), 0) as this_month_actual

FROM public.clients c
LEFT JOIN public.tickets t ON t.client_id = c.id
WHERE c.is_active = true
GROUP BY c.id, c.name, c.logo_url;

GRANT SELECT ON public.alacarte_revenue TO authenticated;

-- ============================================
-- MONTHLY A-LA-CARTE SUMMARY
-- For reports and trends
-- ============================================

DROP VIEW IF EXISTS public.monthly_alacarte_summary;

CREATE OR REPLACE VIEW public.monthly_alacarte_summary AS
SELECT 
  DATE_TRUNC('month', t.created_at)::DATE as month,
  c.id as client_id,
  c.name as client_name,
  
  COUNT(*) as project_count,
  COALESCE(SUM(t.estimated_amount), 0) as total_estimated,
  COALESCE(SUM(CASE WHEN t.status = 'closed' THEN COALESCE(t.actual_amount, t.estimated_amount) END), 0) as total_billed

FROM public.tickets t
JOIN public.clients c ON t.client_id = c.id
WHERE t.billing_type = 'alacarte'
GROUP BY DATE_TRUNC('month', t.created_at), c.id, c.name
ORDER BY month DESC, total_estimated DESC;

GRANT SELECT ON public.monthly_alacarte_summary TO authenticated;
