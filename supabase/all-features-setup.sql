-- ============================================
-- ALL FEATURES SETUP
-- Run this ONCE to set up all new features!
-- ============================================

-- ============================================
-- 1. PROFILES TABLE UPDATES
-- ============================================
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS tagline TEXT,
ADD COLUMN IF NOT EXISTS birthday DATE,
ADD COLUMN IF NOT EXISTS work_start_date DATE,
ADD COLUMN IF NOT EXISTS show_birthday BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_age BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS hourly_cost DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS target_hours_monthly INTEGER DEFAULT 160;

-- ============================================
-- 2. KUDOS TABLE
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

DROP POLICY IF EXISTS "Authenticated users can give kudos" ON public.kudos;
CREATE POLICY "Authenticated users can give kudos" ON public.kudos
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can delete own kudos" ON public.kudos;
CREATE POLICY "Users can delete own kudos" ON public.kudos
  FOR DELETE USING (sender_id = auth.uid());

-- ============================================
-- 3. WEEKLY GOALS TABLE
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
-- 4. NOTIFICATIONS TABLE
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

DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
CREATE POLICY "Authenticated users can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- ============================================
-- 5. UPCOMING CELEBRATIONS VIEW
-- ============================================
CREATE OR REPLACE VIEW public.upcoming_celebrations AS
WITH celebrations AS (
  SELECT 
    p.id as user_id,
    p.full_name,
    p.avatar_url,
    p.birthday,
    p.work_start_date,
    COALESCE(p.show_birthday, true) as show_birthday,
    COALESCE(p.show_age, false) as show_age,
    -- Calculate next birthday
    CASE 
      WHEN p.birthday IS NOT NULL THEN
        CASE 
          WHEN (EXTRACT(month FROM p.birthday) * 100 + EXTRACT(day FROM p.birthday)) >= 
               (EXTRACT(month FROM CURRENT_DATE) * 100 + EXTRACT(day FROM CURRENT_DATE))
          THEN make_date(EXTRACT(year FROM CURRENT_DATE)::int, 
                         EXTRACT(month FROM p.birthday)::int, 
                         EXTRACT(day FROM p.birthday)::int)
          ELSE make_date((EXTRACT(year FROM CURRENT_DATE) + 1)::int, 
                         EXTRACT(month FROM p.birthday)::int, 
                         EXTRACT(day FROM p.birthday)::int)
        END
    END as next_birthday,
    -- Calculate next work anniversary
    CASE 
      WHEN p.work_start_date IS NOT NULL THEN
        CASE 
          WHEN (EXTRACT(month FROM p.work_start_date) * 100 + EXTRACT(day FROM p.work_start_date)) >= 
               (EXTRACT(month FROM CURRENT_DATE) * 100 + EXTRACT(day FROM CURRENT_DATE))
          THEN make_date(EXTRACT(year FROM CURRENT_DATE)::int, 
                         EXTRACT(month FROM p.work_start_date)::int, 
                         EXTRACT(day FROM p.work_start_date)::int)
          ELSE make_date((EXTRACT(year FROM CURRENT_DATE) + 1)::int, 
                         EXTRACT(month FROM p.work_start_date)::int, 
                         EXTRACT(day FROM p.work_start_date)::int)
        END
    END as next_anniversary,
    -- Years at company
    CASE 
      WHEN p.work_start_date IS NOT NULL 
      THEN EXTRACT(year FROM age(CURRENT_DATE, p.work_start_date))::int
    END as years_at_company,
    -- Age (if allowed to show)
    CASE 
      WHEN p.birthday IS NOT NULL AND COALESCE(p.show_age, false) = true
      THEN EXTRACT(year FROM age(CURRENT_DATE, p.birthday))::int
    END as age
  FROM public.profiles p
  WHERE p.role IN ('team', 'admin')
)
SELECT 
  *,
  -- Days until next birthday
  CASE WHEN next_birthday IS NOT NULL 
    THEN (next_birthday - CURRENT_DATE)::int
  END as days_until_birthday,
  -- Days until next anniversary
  CASE WHEN next_anniversary IS NOT NULL 
    THEN (next_anniversary - CURRENT_DATE)::int 
  END as days_until_anniversary,
  -- Is birthday today?
  CASE WHEN next_birthday = CURRENT_DATE THEN true ELSE false END as is_birthday_today,
  -- Is anniversary today?
  CASE WHEN next_anniversary = CURRENT_DATE THEN true ELSE false END as is_anniversary_today
FROM celebrations;

-- ============================================
-- 6. TRIGGER: Create notification on kudos
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
-- DONE!
-- ============================================
SELECT 'All features set up successfully! ✅' as status;
