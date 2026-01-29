-- Admin Dashboard Features Schema
-- Notes, Announcements, and Goal Tracking

-- ============================================
-- ADMIN NOTES (Personal reminders for admins)
-- ============================================
CREATE TABLE IF NOT EXISTS public.admin_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  color TEXT DEFAULT 'yellow', -- yellow, blue, green, red, purple
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage their notes" 
  ON public.admin_notes FOR ALL TO authenticated
  USING (
    created_by = auth.uid() AND 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_notes TO authenticated;

-- ============================================
-- TEAM ANNOUNCEMENTS (Broadcast to team)
-- ============================================
CREATE TABLE IF NOT EXISTS public.team_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'info', -- info, success, warning, celebration
  is_pinned BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ, -- Optional expiration
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.team_announcements ENABLE ROW LEVEL SECURITY;

-- Everyone can read active announcements
CREATE POLICY "Everyone can read announcements" 
  ON public.team_announcements FOR SELECT TO authenticated
  USING (is_active = true);

-- Only admins can manage announcements
CREATE POLICY "Admins can manage announcements" 
  ON public.team_announcements FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_announcements TO authenticated;

-- ============================================
-- GOAL STREAKS (Track consecutive days/weeks)
-- ============================================
CREATE TABLE IF NOT EXISTS public.goal_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  streak_type TEXT NOT NULL, -- billable_target, revenue_goal, client_retention
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  last_achieved_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.goal_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read streaks" 
  ON public.goal_streaks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage streaks" 
  ON public.goal_streaks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

GRANT SELECT, INSERT, UPDATE ON public.goal_streaks TO authenticated;

-- Insert default streaks
INSERT INTO public.goal_streaks (streak_type, current_streak, best_streak) VALUES
  ('billable_target', 0, 0),
  ('revenue_goal', 0, 0),
  ('client_retention', 0, 0)
ON CONFLICT DO NOTHING;

-- ============================================
-- ADMIN METRICS HISTORY (For comparisons)
-- ============================================
CREATE TABLE IF NOT EXISTS public.admin_metrics_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date DATE NOT NULL,
  monthly_revenue NUMERIC DEFAULT 0,
  active_clients INTEGER DEFAULT 0,
  team_members INTEGER DEFAULT 0,
  billable_hours NUMERIC DEFAULT 0,
  billable_percentage NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(metric_date)
);

ALTER TABLE public.admin_metrics_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can access metrics history" 
  ON public.admin_metrics_history FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

GRANT SELECT, INSERT, UPDATE ON public.admin_metrics_history TO authenticated;

-- ============================================
-- Update triggers
-- ============================================
CREATE OR REPLACE FUNCTION update_admin_notes_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS admin_notes_updated_at ON public.admin_notes;
CREATE TRIGGER admin_notes_updated_at
  BEFORE UPDATE ON public.admin_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_notes_timestamp();

DROP TRIGGER IF EXISTS team_announcements_updated_at ON public.team_announcements;
CREATE TRIGGER team_announcements_updated_at
  BEFORE UPDATE ON public.team_announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_notes_timestamp();
