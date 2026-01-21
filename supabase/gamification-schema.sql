-- ============================================
-- GAMIFICATION SCHEMA
-- Run this in your Supabase SQL Editor
-- ============================================

-- User gamification stats table
CREATE TABLE IF NOT EXISTS public.user_gamification (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  xp INTEGER DEFAULT 0,
  tickets_completed INTEGER DEFAULT 0,
  hours_logged DECIMAL(10,2) DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  achievements TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_user_gamification_xp ON public.user_gamification(xp DESC);
CREATE INDEX IF NOT EXISTS idx_user_gamification_user ON public.user_gamification(user_id);

-- Enable RLS
ALTER TABLE public.user_gamification ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view all gamification stats" ON public.user_gamification
  FOR SELECT USING (true);

CREATE POLICY "Users can update own gamification stats" ON public.user_gamification
  FOR ALL USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_gamification_updated_at
  BEFORE UPDATE ON public.user_gamification
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Initialize gamification for new users
CREATE OR REPLACE FUNCTION initialize_user_gamification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_gamification (user_id, achievements)
  VALUES (NEW.id, ARRAY['first_login'])
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created_init_gamification
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION initialize_user_gamification();

-- Leaderboard view
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT 
  ug.user_id,
  p.full_name,
  p.avatar_url,
  ug.xp,
  ug.tickets_completed,
  ug.hours_logged,
  ug.current_streak,
  ug.achievements,
  RANK() OVER (ORDER BY ug.xp DESC) as rank
FROM public.user_gamification ug
JOIN public.profiles p ON p.id = ug.user_id
WHERE p.role IN ('team', 'admin')
ORDER BY ug.xp DESC;
