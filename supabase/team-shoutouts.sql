-- =====================================================
-- TEAM SHOUTOUTS SCHEMA
-- Allows team members to appreciate and recognize each other
-- =====================================================

-- Create the shoutouts table
CREATE TABLE IF NOT EXISTS public.team_shoutouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  category TEXT DEFAULT 'appreciation',
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Prevent self-shoutouts
  CONSTRAINT no_self_shoutout CHECK (from_user_id != to_user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_shoutouts_to_user ON public.team_shoutouts(to_user_id);
CREATE INDEX IF NOT EXISTS idx_shoutouts_from_user ON public.team_shoutouts(from_user_id);
CREATE INDEX IF NOT EXISTS idx_shoutouts_created_at ON public.team_shoutouts(created_at DESC);

-- Enable RLS
ALTER TABLE public.team_shoutouts ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Shoutouts viewable by all authenticated" ON public.team_shoutouts;
CREATE POLICY "Shoutouts viewable by all authenticated" ON public.team_shoutouts
  FOR SELECT TO authenticated
  USING (is_public = true OR from_user_id = auth.uid() OR to_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create shoutouts" ON public.team_shoutouts;
CREATE POLICY "Users can create shoutouts" ON public.team_shoutouts
  FOR INSERT TO authenticated
  WITH CHECK (from_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own shoutouts" ON public.team_shoutouts;
CREATE POLICY "Users can delete own shoutouts" ON public.team_shoutouts
  FOR DELETE TO authenticated
  USING (from_user_id = auth.uid());

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON public.team_shoutouts TO authenticated;

-- =====================================================
-- TRIGGER: Log shoutout to activity feed
-- =====================================================
CREATE OR REPLACE FUNCTION log_shoutout_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_from_name TEXT;
  v_to_name TEXT;
BEGIN
  SELECT full_name INTO v_from_name FROM public.profiles WHERE id = NEW.from_user_id;
  SELECT full_name INTO v_to_name FROM public.profiles WHERE id = NEW.to_user_id;
  
  INSERT INTO public.activity_log (
    activity_type,
    entity_type,
    entity_id,
    entity_name,
    user_id,
    metadata
  ) VALUES (
    'shoutout_given',
    'shoutout',
    NEW.id,
    v_to_name,
    NEW.from_user_id,
    jsonb_build_object(
      'to_user_id', NEW.to_user_id,
      'to_name', v_to_name,
      'from_name', v_from_name,
      'category', NEW.category,
      'message_preview', LEFT(NEW.message, 50)
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_shoutout ON public.team_shoutouts;
CREATE TRIGGER trigger_log_shoutout
  AFTER INSERT ON public.team_shoutouts
  FOR EACH ROW
  EXECUTE FUNCTION log_shoutout_activity();

-- =====================================================
-- DONE - Run this in Supabase SQL Editor
-- =====================================================
