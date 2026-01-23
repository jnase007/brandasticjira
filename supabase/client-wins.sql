-- =====================================================
-- CLIENT WINS SCHEMA
-- Track client successes and achievements
-- =====================================================

-- Create the client_wins table
CREATE TABLE IF NOT EXISTS public.client_wins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_client_wins_client ON public.client_wins(client_id);
CREATE INDEX IF NOT EXISTS idx_client_wins_user ON public.client_wins(user_id);
CREATE INDEX IF NOT EXISTS idx_client_wins_created ON public.client_wins(created_at DESC);

-- Enable RLS
ALTER TABLE public.client_wins ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Client wins viewable by all authenticated" ON public.client_wins;
CREATE POLICY "Client wins viewable by all authenticated" ON public.client_wins
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can create client wins" ON public.client_wins;
CREATE POLICY "Users can create client wins" ON public.client_wins
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own wins" ON public.client_wins;
CREATE POLICY "Users can update own wins" ON public.client_wins
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own wins" ON public.client_wins;
CREATE POLICY "Users can delete own wins" ON public.client_wins
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_wins TO authenticated;

-- =====================================================
-- TRIGGER: Log win to activity feed
-- =====================================================
CREATE OR REPLACE FUNCTION log_client_win_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_user_name TEXT;
  v_client_name TEXT;
BEGIN
  SELECT full_name INTO v_user_name FROM public.profiles WHERE id = NEW.user_id;
  SELECT name INTO v_client_name FROM public.clients WHERE id = NEW.client_id;
  
  INSERT INTO public.activity_log (
    activity_type,
    entity_type,
    entity_id,
    entity_name,
    user_id,
    metadata
  ) VALUES (
    'client_win_added',
    'client',
    NEW.client_id,
    v_client_name,
    NEW.user_id,
    jsonb_build_object(
      'win_id', NEW.id,
      'win_title', NEW.title,
      'category', NEW.category,
      'user_name', v_user_name
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_client_win ON public.client_wins;
CREATE TRIGGER trigger_log_client_win
  AFTER INSERT ON public.client_wins
  FOR EACH ROW
  EXECUTE FUNCTION log_client_win_activity();

-- =====================================================
-- DONE - Run this in Supabase SQL Editor
-- =====================================================
