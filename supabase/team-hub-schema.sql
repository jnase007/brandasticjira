-- ============================================
-- TEAM HUB SCHEMA - Additional Tables
-- Run this in your Supabase SQL Editor
-- ============================================

-- ============================================
-- UPDATE CLIENTS TABLE - Add new fields
-- ============================================
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS renewal_date DATE,
ADD COLUMN IF NOT EXISTS account_services TEXT[];

-- ============================================
-- TEAM ASSIGNMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.client_team_assignments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('marketing_manager', 'account_specialist', 'marketing_coordinator', 'paid_media', 'seo', 'design')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT, -- Fallback if user doesn't have account yet
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, role)
);

-- ============================================
-- AD SPEND TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.ad_spend (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'google', 'google_ppc', 'meta', 'tiktok', 'twitter', 'spotify', 'programmatic', 'linkedin', 'other')),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  actuals DECIMAL(12,2) DEFAULT 0,
  budget DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, platform, year, month)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_client_team_assignments_client ON public.client_team_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_ad_spend_client ON public.ad_spend(client_id);
CREATE INDEX IF NOT EXISTS idx_ad_spend_year_month ON public.ad_spend(year, month);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.client_team_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_spend ENABLE ROW LEVEL SECURITY;

-- Team assignments policies
CREATE POLICY "Team members can view all assignments" ON public.client_team_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('team', 'admin')
    )
  );

CREATE POLICY "Team members can manage assignments" ON public.client_team_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('team', 'admin')
    )
  );

-- Ad spend policies
CREATE POLICY "Team members can view all ad spend" ON public.ad_spend
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('team', 'admin')
    )
  );

CREATE POLICY "Team members can manage ad spend" ON public.ad_spend
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('team', 'admin')
    )
  );

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER update_client_team_assignments_updated_at
  BEFORE UPDATE ON public.client_team_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_ad_spend_updated_at
  BEFORE UPDATE ON public.ad_spend
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- VIEWS FOR EASY QUERYING
-- ============================================

-- Client roster view with team assignments
CREATE OR REPLACE VIEW public.client_roster AS
SELECT 
  c.id,
  c.name,
  c.slug,
  c.color,
  c.monthly_hours,
  c.renewal_date,
  c.account_services,
  c.is_active,
  (SELECT user_name FROM public.client_team_assignments WHERE client_id = c.id AND role = 'marketing_manager' LIMIT 1) as marketing_manager,
  (SELECT user_name FROM public.client_team_assignments WHERE client_id = c.id AND role = 'account_specialist' LIMIT 1) as account_specialist,
  (SELECT user_name FROM public.client_team_assignments WHERE client_id = c.id AND role = 'marketing_coordinator' LIMIT 1) as marketing_coordinator,
  (SELECT user_name FROM public.client_team_assignments WHERE client_id = c.id AND role = 'paid_media' LIMIT 1) as paid_media,
  (SELECT user_name FROM public.client_team_assignments WHERE client_id = c.id AND role = 'seo' LIMIT 1) as seo,
  (SELECT user_name FROM public.client_team_assignments WHERE client_id = c.id AND role = 'design' LIMIT 1) as design
FROM public.clients c
WHERE c.is_active = true
ORDER BY c.name;
