-- ============================================
-- 100X FEATURES SCHEMA
-- Kudos, Weekly Goals, and more!
-- ============================================

-- ============================================
-- 1. KUDOS TABLE
-- Team appreciation/shoutouts
-- ============================================
CREATE TABLE IF NOT EXISTS public.kudos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('thanks', 'amazing', 'helpful', 'creative', 'rockstar', 'champion')),
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_kudos_sender ON public.kudos(sender_id);
CREATE INDEX IF NOT EXISTS idx_kudos_receiver ON public.kudos(receiver_id);
CREATE INDEX IF NOT EXISTS idx_kudos_created ON public.kudos(created_at DESC);

-- RLS
ALTER TABLE public.kudos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view kudos" ON public.kudos;
CREATE POLICY "Everyone can view kudos" ON public.kudos
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Team can give kudos" ON public.kudos;
CREATE POLICY "Team can give kudos" ON public.kudos
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );

DROP POLICY IF EXISTS "Users can delete own kudos" ON public.kudos;
CREATE POLICY "Users can delete own kudos" ON public.kudos
  FOR DELETE USING (sender_id = auth.uid());

-- ============================================
-- 2. WEEKLY GOALS TABLE
-- Personal weekly goals tracking
-- ============================================
CREATE TABLE IF NOT EXISTS public.weekly_goals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  week_start TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_weekly_goals_user ON public.weekly_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_goals_week ON public.weekly_goals(week_start);

-- RLS
ALTER TABLE public.weekly_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own goals" ON public.weekly_goals;
CREATE POLICY "Users manage own goals" ON public.weekly_goals
  FOR ALL USING (user_id = auth.uid());

-- ============================================
-- 3. NOTIFICATIONS TABLE
-- In-app notifications
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('kudos', 'mention', 'assignment', 'comment', 'achievement', 'system')),
  title TEXT NOT NULL,
  message TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id) WHERE read = false;

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own notifications" ON public.notifications;
CREATE POLICY "Users see own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
CREATE POLICY "System can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- ============================================
-- 4. TRIGGER: Create notification on kudos
-- ============================================
CREATE OR REPLACE FUNCTION notify_on_kudos()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, data)
  SELECT
    NEW.receiver_id,
    'kudos',
    '🎉 You received kudos!',
    (SELECT full_name FROM public.profiles WHERE id = NEW.sender_id) || ' gave you kudos!',
    jsonb_build_object('kudos_id', NEW.id, 'type', NEW.type, 'sender_id', NEW.sender_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_kudos_notification ON public.kudos;
CREATE TRIGGER trigger_kudos_notification
  AFTER INSERT ON public.kudos
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_kudos();

-- ============================================
-- 5. TRIGGER: Create notification on assignment
-- ============================================
CREATE OR REPLACE FUNCTION notify_on_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify if assigned_to changed and is not null
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
      NEW.assigned_to,
      'assignment',
      '📋 New ticket assigned',
      'You were assigned: ' || NEW.title,
      jsonb_build_object('ticket_id', NEW.id, 'board_id', NEW.board_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_assignment_notification ON public.tickets;
CREATE TRIGGER trigger_assignment_notification
  AFTER UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_assignment();

-- ============================================
-- DONE
-- ============================================
SELECT '100x features schema created!' as status;
