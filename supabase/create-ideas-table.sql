-- ============================================
-- CREATE IDEAS TABLE FOR TEAM BRAINSTORMING
-- Run this in Supabase SQL Editor
-- ============================================

-- Create ideas table
CREATE TABLE IF NOT EXISTS public.ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general' CHECK (category IN ('feature', 'improvement', 'bug-fix', 'process', 'marketing', 'general')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'planned', 'in-progress', 'completed', 'rejected')),
  submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  votes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create idea_votes table to track who voted
CREATE TABLE IF NOT EXISTS public.idea_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID REFERENCES public.ideas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  vote_type TEXT DEFAULT 'up' CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(idea_id, user_id)
);

-- Create idea_comments table
CREATE TABLE IF NOT EXISTS public.idea_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID REFERENCES public.ideas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idea_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idea_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ideas
CREATE POLICY "Team can view all ideas" ON public.ideas
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Team can create ideas" ON public.ideas
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );

CREATE POLICY "Users can update own ideas or admins can update any" ON public.ideas
  FOR UPDATE TO authenticated
  USING (
    submitted_by = auth.uid() OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete ideas" ON public.ideas
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- RLS Policies for idea_votes
CREATE POLICY "Team can view votes" ON public.idea_votes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Team can vote" ON public.idea_votes
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );

CREATE POLICY "Users can change their vote" ON public.idea_votes
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can remove their vote" ON public.idea_votes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for idea_comments
CREATE POLICY "Team can view comments" ON public.idea_comments
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Team can add comments" ON public.idea_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );

CREATE POLICY "Users can delete own comments" ON public.idea_comments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ideas_status ON public.ideas(status);
CREATE INDEX IF NOT EXISTS idx_ideas_category ON public.ideas(category);
CREATE INDEX IF NOT EXISTS idx_ideas_votes ON public.ideas(votes DESC);
CREATE INDEX IF NOT EXISTS idx_ideas_created ON public.ideas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_idea_votes_idea ON public.idea_votes(idea_id);
CREATE INDEX IF NOT EXISTS idx_idea_comments_idea ON public.idea_comments(idea_id);

-- Function to update vote count
CREATE OR REPLACE FUNCTION update_idea_votes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE ideas 
    SET votes = votes + CASE WHEN NEW.vote_type = 'up' THEN 1 ELSE -1 END
    WHERE id = NEW.idea_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE ideas 
    SET votes = votes - CASE WHEN OLD.vote_type = 'up' THEN 1 ELSE -1 END
    WHERE id = OLD.idea_id;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE ideas 
    SET votes = votes 
      - CASE WHEN OLD.vote_type = 'up' THEN 1 ELSE -1 END
      + CASE WHEN NEW.vote_type = 'up' THEN 1 ELSE -1 END
    WHERE id = NEW.idea_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for vote count
DROP TRIGGER IF EXISTS trigger_update_idea_votes ON public.idea_votes;
CREATE TRIGGER trigger_update_idea_votes
  AFTER INSERT OR UPDATE OR DELETE ON public.idea_votes
  FOR EACH ROW EXECUTE FUNCTION update_idea_votes();

-- Verify
SELECT 'Ideas tables created successfully!' as status;
