-- ============================================
-- FIX: Ad Spend Table + User Favorites
-- Run this in your Supabase SQL Editor
-- ============================================

-- ============================================
-- AD SPEND TABLE (for platform budgets)
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

-- Indexes for ad_spend
CREATE INDEX IF NOT EXISTS idx_ad_spend_client ON public.ad_spend(client_id);
CREATE INDEX IF NOT EXISTS idx_ad_spend_year_month ON public.ad_spend(year, month);

-- RLS for ad_spend
ALTER TABLE public.ad_spend ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Team members can view all ad spend" ON public.ad_spend;
DROP POLICY IF EXISTS "Team members can manage ad spend" ON public.ad_spend;

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
-- USER FAVORITE CLIENTS TABLE
-- (so starred clients persist across sessions)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_favorite_clients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, client_id)
);

-- Indexes for user_favorite_clients
CREATE INDEX IF NOT EXISTS idx_user_favorite_clients_user ON public.user_favorite_clients(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorite_clients_client ON public.user_favorite_clients(client_id);

-- RLS for user_favorite_clients
ALTER TABLE public.user_favorite_clients ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own favorites" ON public.user_favorite_clients;
DROP POLICY IF EXISTS "Users can manage their own favorites" ON public.user_favorite_clients;

-- Users can only see and manage their own favorites
CREATE POLICY "Users can view their own favorites" ON public.user_favorite_clients
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own favorites" ON public.user_favorite_clients
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- UPDATE TRIGGER (if not exists)
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to ad_spend if not exists
DROP TRIGGER IF EXISTS update_ad_spend_updated_at ON public.ad_spend;
CREATE TRIGGER update_ad_spend_updated_at
  BEFORE UPDATE ON public.ad_spend
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- DONE! Both tables are now ready.
-- ============================================
