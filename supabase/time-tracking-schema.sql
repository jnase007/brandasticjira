-- ============================================
-- TIME TRACKING & PROFITABILITY SCHEMA
-- Run this in your Supabase SQL Editor
-- ============================================

-- Add employee rate and target fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS hourly_cost DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS target_hours_monthly INTEGER DEFAULT 120,
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS start_date DATE;

-- Client billing rates (what we charge clients)
CREATE TABLE IF NOT EXISTS public.client_rates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 75,
  effective_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, effective_date)
);

-- Time entries table (detailed time tracking)
CREATE TABLE IF NOT EXISTS public.time_entries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  board_id UUID REFERENCES public.boards(id) ON DELETE SET NULL,
  description TEXT,
  minutes INTEGER NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  billable BOOLEAN DEFAULT true,
  invoiced BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_time_entries_user ON public.time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_client ON public.time_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON public.time_entries(date);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_date ON public.time_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_client_rates_client ON public.client_rates(client_id);

-- Enable RLS
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_rates ENABLE ROW LEVEL SECURITY;

-- Time entries policies
CREATE POLICY "Team can view all time entries" ON public.time_entries
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );

CREATE POLICY "Users can insert own time entries" ON public.time_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own time entries" ON public.time_entries
  FOR UPDATE USING (auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete time entries" ON public.time_entries
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Client rates policies (admin only for management)
CREATE POLICY "Team can view client rates" ON public.client_rates
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );

CREATE POLICY "Admins can manage client rates" ON public.client_rates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Updated at triggers
CREATE TRIGGER update_time_entries_updated_at
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_client_rates_updated_at
  BEFORE UPDATE ON public.client_rates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- VIEWS FOR ANALYTICS
-- ============================================

-- Monthly time summary per user
CREATE OR REPLACE VIEW public.monthly_time_summary AS
SELECT 
  te.user_id,
  p.full_name,
  p.hourly_cost,
  p.target_hours_monthly,
  te.client_id,
  c.name as client_name,
  DATE_TRUNC('month', te.date) as month,
  SUM(te.minutes) as total_minutes,
  SUM(te.minutes) / 60.0 as total_hours,
  SUM(CASE WHEN te.billable THEN te.minutes ELSE 0 END) / 60.0 as billable_hours,
  SUM(CASE WHEN NOT te.billable THEN te.minutes ELSE 0 END) / 60.0 as non_billable_hours
FROM public.time_entries te
JOIN public.profiles p ON p.id = te.user_id
LEFT JOIN public.clients c ON c.id = te.client_id
GROUP BY te.user_id, p.full_name, p.hourly_cost, p.target_hours_monthly, 
         te.client_id, c.name, DATE_TRUNC('month', te.date);

-- Employee efficiency view
CREATE OR REPLACE VIEW public.employee_efficiency AS
SELECT 
  p.id as user_id,
  p.full_name,
  p.hourly_cost,
  p.target_hours_monthly,
  p.avatar_url,
  p.role,
  DATE_TRUNC('month', COALESCE(te.date, CURRENT_DATE)) as month,
  COALESCE(SUM(te.minutes) / 60.0, 0) as tracked_hours,
  CASE 
    WHEN p.target_hours_monthly > 0 
    THEN ROUND((COALESCE(SUM(te.minutes) / 60.0, 0) / p.target_hours_monthly * 100)::numeric, 1)
    ELSE 0 
  END as efficiency_ratio,
  COALESCE(SUM(te.minutes) / 60.0, 0) * p.hourly_cost as cost,
  COALESCE(SUM(CASE WHEN te.billable THEN te.minutes ELSE 0 END) / 60.0, 0) as billable_hours
FROM public.profiles p
LEFT JOIN public.time_entries te ON te.user_id = p.id 
  AND DATE_TRUNC('month', te.date) = DATE_TRUNC('month', CURRENT_DATE)
WHERE p.role IN ('team', 'admin')
GROUP BY p.id, p.full_name, p.hourly_cost, p.target_hours_monthly, p.avatar_url, p.role,
         DATE_TRUNC('month', COALESCE(te.date, CURRENT_DATE));

-- Client profitability view
CREATE OR REPLACE VIEW public.client_profitability AS
SELECT 
  c.id as client_id,
  c.name as client_name,
  c.color,
  c.monthly_hours as budgeted_hours,
  cr.hourly_rate as billing_rate,
  DATE_TRUNC('month', COALESCE(te.date, CURRENT_DATE)) as month,
  COALESCE(SUM(te.minutes) / 60.0, 0) as hours_worked,
  COALESCE(SUM(CASE WHEN te.billable THEN te.minutes ELSE 0 END) / 60.0, 0) as billable_hours,
  COALESCE(SUM(CASE WHEN te.billable THEN te.minutes ELSE 0 END) / 60.0, 0) * COALESCE(cr.hourly_rate, 75) as revenue,
  COALESCE(SUM(te.minutes / 60.0 * p.hourly_cost), 0) as cost,
  (COALESCE(SUM(CASE WHEN te.billable THEN te.minutes ELSE 0 END) / 60.0, 0) * COALESCE(cr.hourly_rate, 75)) - 
  COALESCE(SUM(te.minutes / 60.0 * p.hourly_cost), 0) as profit,
  CASE 
    WHEN COALESCE(SUM(CASE WHEN te.billable THEN te.minutes ELSE 0 END) / 60.0, 0) * COALESCE(cr.hourly_rate, 75) > 0
    THEN ROUND((
      ((COALESCE(SUM(CASE WHEN te.billable THEN te.minutes ELSE 0 END) / 60.0, 0) * COALESCE(cr.hourly_rate, 75)) - 
       COALESCE(SUM(te.minutes / 60.0 * p.hourly_cost), 0)) /
      (COALESCE(SUM(CASE WHEN te.billable THEN te.minutes ELSE 0 END) / 60.0, 0) * COALESCE(cr.hourly_rate, 75)) * 100
    )::numeric, 1)
    ELSE 0
  END as profit_margin
FROM public.clients c
LEFT JOIN public.client_rates cr ON cr.client_id = c.id
LEFT JOIN public.time_entries te ON te.client_id = c.id
LEFT JOIN public.profiles p ON p.id = te.user_id
WHERE c.is_active = true
GROUP BY c.id, c.name, c.color, c.monthly_hours, cr.hourly_rate,
         DATE_TRUNC('month', COALESCE(te.date, CURRENT_DATE));
