-- ============================================
-- BRANDASTIC JIRA - COMPLETE DATABASE SETUP
-- Run this ONCE to set up all required tables
-- ============================================

-- ============================================
-- 1. PROFILES TABLE UPDATES
-- ============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tagline TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS work_start_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_birthday BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_age BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hourly_cost DECIMAL(10,2) DEFAULT 50.00;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS target_hours_monthly INTEGER DEFAULT 160;

-- ============================================
-- 2. CLIENTS TABLE (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  color TEXT DEFAULT '#F7931E',
  logo_url TEXT,
  monthly_hours INTEGER DEFAULT 20,
  account_services TEXT[],
  contact_email TEXT,
  contact_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Drop old restrictive constraint if exists
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_monthly_hours_check;

-- RLS for clients
DROP POLICY IF EXISTS "Team can view clients" ON clients;
CREATE POLICY "Team can view clients" ON clients FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Team can manage clients" ON clients;
CREATE POLICY "Team can manage clients" ON clients FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 3. BOARDS TABLE (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE boards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team can view boards" ON boards;
CREATE POLICY "Team can view boards" ON boards FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Team can manage boards" ON boards;
CREATE POLICY "Team can manage boards" ON boards FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 4. TICKETS TABLE (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo',
  priority TEXT DEFAULT 'medium',
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  position INTEGER DEFAULT 0,
  estimated_hours DECIMAL(10,2),
  due_date DATE,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team can view tickets" ON tickets;
CREATE POLICY "Team can view tickets" ON tickets FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Team can manage tickets" ON tickets;
CREATE POLICY "Team can manage tickets" ON tickets FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 5. TIME ENTRIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  is_running BOOLEAN DEFAULT false,
  is_billable BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all time entries" ON time_entries;
CREATE POLICY "Users can view all time entries" ON time_entries FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert their own time entries" ON time_entries;
CREATE POLICY "Users can insert their own time entries" ON time_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own time entries" ON time_entries;
CREATE POLICY "Users can update their own time entries" ON time_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own time entries" ON time_entries;
CREATE POLICY "Users can delete their own time entries" ON time_entries FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_client_id ON time_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_start_time ON time_entries(start_time);

-- ============================================
-- 6. COMMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team can view comments" ON comments;
CREATE POLICY "Team can view comments" ON comments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Team can manage comments" ON comments;
CREATE POLICY "Team can manage comments" ON comments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 7. CLIENT HOURLY RATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS client_hourly_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  rate_per_hour DECIMAL(10,2) NOT NULL DEFAULT 175.00,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, effective_date)
);

ALTER TABLE client_hourly_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team can view rates" ON client_hourly_rates;
CREATE POLICY "Team can view rates" ON client_hourly_rates FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Team can manage rates" ON client_hourly_rates;
CREATE POLICY "Team can manage rates" ON client_hourly_rates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 8. CLIENT HOURS SUMMARY VIEW
-- ============================================
DROP VIEW IF EXISTS client_hours_summary;
CREATE VIEW client_hours_summary AS
SELECT 
  c.id as client_id,
  c.name as client_name,
  c.monthly_hours,
  COALESCE(SUM(te.duration_minutes) / 60.0, 0) as hours_used,
  c.monthly_hours - COALESCE(SUM(te.duration_minutes) / 60.0, 0) as hours_remaining
FROM clients c
LEFT JOIN time_entries te ON te.client_id = c.id 
  AND te.start_time >= date_trunc('month', CURRENT_DATE)
  AND te.start_time < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
WHERE c.is_active = true
GROUP BY c.id, c.name, c.monthly_hours;

-- ============================================
-- 9. GAMIFICATION STATS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_gamification_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  xp INTEGER DEFAULT 0,
  total_xp INTEGER DEFAULT 0,
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

ALTER TABLE user_gamification_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all stats" ON user_gamification_stats;
CREATE POLICY "Users can view all stats" ON user_gamification_stats FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can manage own stats" ON user_gamification_stats;
CREATE POLICY "Users can manage own stats" ON user_gamification_stats FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 10. WEEKLY GOALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS weekly_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  week_start TIMESTAMPTZ NOT NULL,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE weekly_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own goals" ON weekly_goals;
CREATE POLICY "Users can view own goals" ON weekly_goals FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own goals" ON weekly_goals;
CREATE POLICY "Users can manage own goals" ON weekly_goals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 11. KUDOS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS kudos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE kudos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team can view kudos" ON kudos;
CREATE POLICY "Team can view kudos" ON kudos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can send kudos" ON kudos;
CREATE POLICY "Users can send kudos" ON kudos FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

-- ============================================
-- 12. ACTIVITY LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  entity_name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team can view activity" ON activity_log;
CREATE POLICY "Team can view activity" ON activity_log FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "System can insert activity" ON activity_log;
CREATE POLICY "System can insert activity" ON activity_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);

-- ============================================
-- 13. UPCOMING CELEBRATIONS VIEW
-- ============================================
DROP VIEW IF EXISTS upcoming_celebrations;
CREATE VIEW upcoming_celebrations AS
SELECT 
  p.id as user_id,
  p.full_name,
  p.avatar_url,
  p.birthday,
  p.work_start_date,
  p.show_birthday,
  -- Calculate next birthday
  CASE 
    WHEN p.birthday IS NOT NULL AND p.show_birthday = true THEN
      CASE 
        WHEN (p.birthday + (EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM p.birthday))::int * INTERVAL '1 year')::date >= CURRENT_DATE 
        THEN (p.birthday + (EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM p.birthday))::int * INTERVAL '1 year')::date
        ELSE (p.birthday + (EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM p.birthday) + 1)::int * INTERVAL '1 year')::date
      END
    ELSE NULL
  END as next_birthday,
  -- Calculate next anniversary
  CASE 
    WHEN p.work_start_date IS NOT NULL THEN
      CASE 
        WHEN (p.work_start_date + (EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM p.work_start_date))::int * INTERVAL '1 year')::date >= CURRENT_DATE 
        THEN (p.work_start_date + (EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM p.work_start_date))::int * INTERVAL '1 year')::date
        ELSE (p.work_start_date + (EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM p.work_start_date) + 1)::int * INTERVAL '1 year')::date
      END
    ELSE NULL
  END as next_anniversary,
  -- Years at company
  CASE 
    WHEN p.work_start_date IS NOT NULL 
    THEN EXTRACT(YEAR FROM age(CURRENT_DATE, p.work_start_date))::int
    ELSE NULL
  END as years_at_company,
  -- Days until birthday
  CASE 
    WHEN p.birthday IS NOT NULL AND p.show_birthday = true THEN
      CASE 
        WHEN (p.birthday + (EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM p.birthday))::int * INTERVAL '1 year')::date >= CURRENT_DATE 
        THEN ((p.birthday + (EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM p.birthday))::int * INTERVAL '1 year')::date - CURRENT_DATE)
        ELSE ((p.birthday + (EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM p.birthday) + 1)::int * INTERVAL '1 year')::date - CURRENT_DATE)
      END
    ELSE NULL
  END as days_until_birthday,
  -- Days until anniversary
  CASE 
    WHEN p.work_start_date IS NOT NULL THEN
      CASE 
        WHEN (p.work_start_date + (EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM p.work_start_date))::int * INTERVAL '1 year')::date >= CURRENT_DATE 
        THEN ((p.work_start_date + (EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM p.work_start_date))::int * INTERVAL '1 year')::date - CURRENT_DATE)
        ELSE ((p.work_start_date + (EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM p.work_start_date) + 1)::int * INTERVAL '1 year')::date - CURRENT_DATE)
      END
    ELSE NULL
  END as days_until_anniversary,
  -- Is birthday today
  (p.birthday IS NOT NULL AND p.show_birthday = true AND 
   EXTRACT(MONTH FROM p.birthday) = EXTRACT(MONTH FROM CURRENT_DATE) AND 
   EXTRACT(DAY FROM p.birthday) = EXTRACT(DAY FROM CURRENT_DATE)) as is_birthday_today,
  -- Is anniversary today
  (p.work_start_date IS NOT NULL AND 
   EXTRACT(MONTH FROM p.work_start_date) = EXTRACT(MONTH FROM CURRENT_DATE) AND 
   EXTRACT(DAY FROM p.work_start_date) = EXTRACT(DAY FROM CURRENT_DATE)) as is_anniversary_today
FROM profiles p
WHERE p.role IN ('team', 'admin');

-- ============================================
-- 14. NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can create notifications" ON notifications;
CREATE POLICY "System can create notifications" ON notifications FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, is_read, created_at DESC);

-- ============================================
-- 15. MAKE JUSTIN ADMIN
-- ============================================
UPDATE profiles SET role = 'admin' WHERE email = 'justin@brandastic.com';

-- ============================================
-- DONE! All tables created successfully.
-- ============================================
SELECT 'SUCCESS: All tables and views created!' as status;
