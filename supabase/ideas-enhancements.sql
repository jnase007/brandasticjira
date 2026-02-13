-- ============================================
-- IDEAS PAGE 10X ENHANCEMENTS
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. IDEA COMMENTS (Threaded Discussions)
-- ============================================
CREATE TABLE IF NOT EXISTS public.idea_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID REFERENCES public.ideas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES public.idea_comments(id) ON DELETE CASCADE, -- For threading
  content TEXT NOT NULL,
  mentions UUID[] DEFAULT '{}', -- Array of mentioned user IDs
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.idea_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view comments" ON public.idea_comments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Team can create comments" ON public.idea_comments
  FOR INSERT TO authenticated 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own comments" ON public.idea_comments
  FOR UPDATE TO authenticated 
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own comments" ON public.idea_comments
  FOR DELETE TO authenticated 
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_idea_comments_idea ON public.idea_comments(idea_id);
CREATE INDEX IF NOT EXISTS idx_idea_comments_parent ON public.idea_comments(parent_id);

-- ============================================
-- 2. QUICK REACTIONS (🔥💡👀❤️🎯)
-- ============================================
CREATE TABLE IF NOT EXISTS public.idea_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID REFERENCES public.ideas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL CHECK (reaction IN ('fire', 'lightbulb', 'eyes', 'heart', 'target')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(idea_id, user_id, reaction)
);

ALTER TABLE public.idea_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view reactions" ON public.idea_reactions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Team can add reactions" ON public.idea_reactions
  FOR INSERT TO authenticated 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove own reactions" ON public.idea_reactions
  FOR DELETE TO authenticated 
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_idea_reactions_idea ON public.idea_reactions(idea_id);

-- ============================================
-- 3. CHAMPIONS (Publicly back an idea)
-- ============================================
CREATE TABLE IF NOT EXISTS public.idea_champions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID REFERENCES public.ideas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT, -- Optional: why they're championing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(idea_id, user_id)
);

ALTER TABLE public.idea_champions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view champions" ON public.idea_champions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Team can champion ideas" ON public.idea_champions
  FOR INSERT TO authenticated 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can unchampion" ON public.idea_champions
  FOR DELETE TO authenticated 
  USING (user_id = auth.uid());

-- ============================================
-- 4. ENHANCE IDEAS TABLE (Owner, Progress, Tags)
-- ============================================
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100);
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS linked_ticket_id UUID;
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS implementation_notes TEXT;

-- ============================================
-- 5. COMMENT COUNT FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION get_idea_comment_count(idea_uuid UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM idea_comments WHERE idea_id = idea_uuid;
$$ LANGUAGE SQL STABLE;

-- ============================================
-- VERIFY
-- ============================================
SELECT 'Ideas enhancements complete!' as status;
