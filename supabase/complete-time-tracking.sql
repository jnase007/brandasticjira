-- ============================================
-- COMPLETE TIME TRACKING & ACTIVITY SYSTEM
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Add tagline column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS tagline TEXT;

-- 2. Make sure hourly_cost and target_hours exist on profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS hourly_cost DECIMAL(10,2) DEFAULT 50.00;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS target_hours_monthly INTEGER DEFAULT 160;

-- ============================================
-- TIME ENTRIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.time_entries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  description TEXT,
  minutes INTEGER NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  billable BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON public.time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_client_id ON public.time_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON public.time_entries(date);

-- Enable RLS
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- Time entries policies
DROP POLICY IF EXISTS "Team can view all time entries" ON public.time_entries;
CREATE POLICY "Team can view all time entries" ON public.time_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('team', 'admin')
    )
  );

DROP POLICY IF EXISTS "Team can manage time entries" ON public.time_entries;
CREATE POLICY "Team can manage time entries" ON public.time_entries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('team', 'admin')
    )
  );

-- ============================================
-- CLIENT RATES TABLE (hourly billing rates)
-- ============================================
CREATE TABLE IF NOT EXISTS public.client_rates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE UNIQUE NOT NULL,
  hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 75.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.client_rates ENABLE ROW LEVEL SECURITY;

-- Client rates policies
DROP POLICY IF EXISTS "Team can view client rates" ON public.client_rates;
CREATE POLICY "Team can view client rates" ON public.client_rates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('team', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can manage client rates" ON public.client_rates;
CREATE POLICY "Admins can manage client rates" ON public.client_rates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- ACTIVITY LOG TABLE (for real activity feed)
-- ============================================
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('ticket_created', 'ticket_updated', 'ticket_completed', 'comment_added', 'time_logged', 'client_created', 'board_created', 'status_changed', 'assigned')),
  entity_type TEXT, -- 'ticket', 'client', 'board', 'time_entry'
  entity_id UUID,
  entity_name TEXT, -- e.g., ticket title, client name
  metadata JSONB DEFAULT '{}', -- additional context
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON public.activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_type ON public.activity_log(activity_type);

-- Enable RLS
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Activity log policies
DROP POLICY IF EXISTS "Team can view activity log" ON public.activity_log;
CREATE POLICY "Team can view activity log" ON public.activity_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('team', 'admin')
    )
  );

DROP POLICY IF EXISTS "Team can insert activity log" ON public.activity_log;
CREATE POLICY "Team can insert activity log" ON public.activity_log
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('team', 'admin')
    )
  );

-- ============================================
-- TRIGGER: Auto-log time entries to activity
-- ============================================
CREATE OR REPLACE FUNCTION log_time_entry_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.activity_log (
    user_id,
    activity_type,
    entity_type,
    entity_id,
    entity_name,
    metadata
  ) VALUES (
    NEW.user_id,
    'time_logged',
    'time_entry',
    NEW.id,
    NEW.description,
    jsonb_build_object(
      'minutes', NEW.minutes,
      'client_id', NEW.client_id,
      'billable', NEW.billable
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_time_entry_created ON public.time_entries;
CREATE TRIGGER on_time_entry_created
  AFTER INSERT ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION log_time_entry_activity();

-- ============================================
-- TRIGGER: Auto-log ticket status changes
-- ============================================
CREATE OR REPLACE FUNCTION log_ticket_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Log status changes
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO public.activity_log (
      user_id,
      activity_type,
      entity_type,
      entity_id,
      entity_name,
      metadata
    ) VALUES (
      auth.uid(),
      CASE WHEN NEW.status = 'done' THEN 'ticket_completed' ELSE 'status_changed' END,
      'ticket',
      NEW.id,
      NEW.title,
      jsonb_build_object(
        'from_status', OLD.status,
        'to_status', NEW.status,
        'ticket_id', NEW.ticket_id
      )
    );
  END IF;
  
  -- Log new tickets
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_log (
      user_id,
      activity_type,
      entity_type,
      entity_id,
      entity_name,
      metadata
    ) VALUES (
      NEW.created_by,
      'ticket_created',
      'ticket',
      NEW.id,
      NEW.title,
      jsonb_build_object('ticket_id', NEW.ticket_id)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_ticket_change ON public.tickets;
CREATE TRIGGER on_ticket_change
  AFTER INSERT OR UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION log_ticket_activity();

-- ============================================
-- VIEW: My Activity Summary
-- ============================================
CREATE OR REPLACE VIEW public.my_activity_summary AS
SELECT 
  p.id as user_id,
  p.full_name,
  p.avatar_url,
  p.tagline,
  COALESCE(SUM(te.minutes), 0)::INTEGER as total_minutes_this_month,
  COALESCE(SUM(CASE WHEN te.billable THEN te.minutes ELSE 0 END), 0)::INTEGER as billable_minutes_this_month,
  COUNT(DISTINCT te.id)::INTEGER as entries_this_month,
  COUNT(DISTINCT te.client_id)::INTEGER as clients_worked_this_month
FROM public.profiles p
LEFT JOIN public.time_entries te ON te.user_id = p.id
  AND te.date >= DATE_TRUNC('month', CURRENT_DATE)
  AND te.date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
WHERE p.role IN ('team', 'admin')
GROUP BY p.id, p.full_name, p.avatar_url, p.tagline;

-- ============================================
-- DONE! ✅
-- ============================================
SELECT 'Time tracking & activity system ready!' as status;
