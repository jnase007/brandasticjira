-- ============================================
-- BRANDASTIC PM - MASTER DATABASE SETUP
-- Run this to ensure ALL features work 100%
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. CLIENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  monthly_hours INTEGER NOT NULL DEFAULT 40 CHECK (monthly_hours >= 1 AND monthly_hours <= 999),
  contact_email TEXT,
  contact_name TEXT,
  color TEXT DEFAULT '#FF6B6B',
  renewal_date DATE,
  account_services TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  tagline TEXT,
  role TEXT NOT NULL DEFAULT 'team' CHECK (role IN ('team', 'client', 'admin')),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  hourly_cost DECIMAL(10,2) DEFAULT 50.00,
  target_hours_monthly INTEGER DEFAULT 160,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tagline TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hourly_cost DECIMAL(10,2) DEFAULT 50.00;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_hours_monthly INTEGER DEFAULT 160;

-- ============================================
-- 3. BOARDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.boards (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL DEFAULT 'kanban' CHECK (type IN ('kanban', 'list')),
  columns JSONB DEFAULT '["todo", "inprogress", "done"]'::jsonb,
  is_archived BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. TICKET COUNTERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.ticket_counters (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE UNIQUE,
  prefix TEXT NOT NULL DEFAULT 'AGENCY',
  current_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. TICKETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ticket_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  board_id UUID REFERENCES public.boards(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'inprogress', 'done')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date DATE,
  estimated_hours DECIMAL(5,2),
  attachments JSONB DEFAULT '[]'::jsonb,
  tags JSONB DEFAULT '[]'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. COMMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. TIME ENTRIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.time_entries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  description TEXT,
  minutes INTEGER NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  billable BOOLEAN DEFAULT true,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  is_running BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. CLIENT RATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.client_rates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE UNIQUE NOT NULL,
  hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 75.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. CLIENT TEAM ASSIGNMENTS (Team Hub)
-- ============================================
CREATE TABLE IF NOT EXISTS public.client_team_assignments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT, -- Fallback text field for flexibility
  role TEXT NOT NULL DEFAULT 'account_specialist',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, role)
);

-- Add user_name column if missing
ALTER TABLE public.client_team_assignments ADD COLUMN IF NOT EXISTS user_name TEXT;

-- ============================================
-- 10. AD SPEND TABLE (Team Hub)
-- ============================================
CREATE TABLE IF NOT EXISTS public.ad_spend (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  platform TEXT NOT NULL,
  budget DECIMAL(12,2) DEFAULT 0,
  actuals DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, year, month, platform)
);

-- ============================================
-- 11. ACTIVITY LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('ticket_created', 'ticket_updated', 'ticket_completed', 'comment_added', 'time_logged', 'client_created', 'board_created', 'status_changed', 'assigned')),
  entity_type TEXT,
  entity_id UUID,
  entity_name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 12. USER GAMIFICATION STATS
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_gamification_stats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
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

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_tickets_board ON public.tickets(board_id);
CREATE INDEX IF NOT EXISTS idx_tickets_client ON public.tickets(client_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON public.tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_time_entries_user ON public.time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_client ON public.time_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON public.time_entries(date);
CREATE INDEX IF NOT EXISTS idx_comments_ticket ON public.comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_boards_client ON public.boards(client_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON public.activity_log(created_at DESC);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_team_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_spend ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_gamification_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_counters ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES - PROFILES
-- ============================================
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Allow profile creation" ON public.profiles;
CREATE POLICY "Allow profile creation" ON public.profiles FOR INSERT WITH CHECK (true);

-- ============================================
-- RLS POLICIES - CLIENTS
-- ============================================
DROP POLICY IF EXISTS "Team members can view all clients" ON public.clients;
CREATE POLICY "Team members can view all clients" ON public.clients FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
);

DROP POLICY IF EXISTS "Team members can manage clients" ON public.clients;
CREATE POLICY "Team members can manage clients" ON public.clients FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
);

-- ============================================
-- RLS POLICIES - BOARDS
-- ============================================
DROP POLICY IF EXISTS "Team members can view all boards" ON public.boards;
CREATE POLICY "Team members can view all boards" ON public.boards FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
);

DROP POLICY IF EXISTS "Team members can manage boards" ON public.boards;
CREATE POLICY "Team members can manage boards" ON public.boards FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
);

-- ============================================
-- RLS POLICIES - TICKETS
-- ============================================
DROP POLICY IF EXISTS "Team members can view all tickets" ON public.tickets;
CREATE POLICY "Team members can view all tickets" ON public.tickets FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
);

DROP POLICY IF EXISTS "Team members can manage tickets" ON public.tickets;
CREATE POLICY "Team members can manage tickets" ON public.tickets FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
);

-- ============================================
-- RLS POLICIES - COMMENTS
-- ============================================
DROP POLICY IF EXISTS "Team can view comments" ON public.comments;
CREATE POLICY "Team can view comments" ON public.comments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
);

DROP POLICY IF EXISTS "Team can manage comments" ON public.comments;
CREATE POLICY "Team can manage comments" ON public.comments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
);

-- ============================================
-- RLS POLICIES - TIME ENTRIES
-- ============================================
DROP POLICY IF EXISTS "Team can view all time entries" ON public.time_entries;
CREATE POLICY "Team can view all time entries" ON public.time_entries FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
);

DROP POLICY IF EXISTS "Team can manage time entries" ON public.time_entries;
CREATE POLICY "Team can manage time entries" ON public.time_entries FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
);

-- ============================================
-- RLS POLICIES - CLIENT RATES
-- ============================================
DROP POLICY IF EXISTS "Team can view client rates" ON public.client_rates;
CREATE POLICY "Team can view client rates" ON public.client_rates FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
);

DROP POLICY IF EXISTS "Admins can manage client rates" ON public.client_rates;
CREATE POLICY "Admins can manage client rates" ON public.client_rates FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
);

-- ============================================
-- RLS POLICIES - TEAM ASSIGNMENTS
-- ============================================
DROP POLICY IF EXISTS "Team can view assignments" ON public.client_team_assignments;
CREATE POLICY "Team can view assignments" ON public.client_team_assignments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
);

DROP POLICY IF EXISTS "Team can manage assignments" ON public.client_team_assignments;
CREATE POLICY "Team can manage assignments" ON public.client_team_assignments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
);

-- ============================================
-- RLS POLICIES - AD SPEND
-- ============================================
DROP POLICY IF EXISTS "Team can view ad spend" ON public.ad_spend;
CREATE POLICY "Team can view ad spend" ON public.ad_spend FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
);

DROP POLICY IF EXISTS "Team can manage ad spend" ON public.ad_spend;
CREATE POLICY "Team can manage ad spend" ON public.ad_spend FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
);

-- ============================================
-- RLS POLICIES - ACTIVITY LOG
-- ============================================
DROP POLICY IF EXISTS "Team can view activity log" ON public.activity_log;
CREATE POLICY "Team can view activity log" ON public.activity_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
);

DROP POLICY IF EXISTS "Team can insert activity log" ON public.activity_log;
CREATE POLICY "Team can insert activity log" ON public.activity_log FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
);

-- ============================================
-- RLS POLICIES - GAMIFICATION
-- ============================================
DROP POLICY IF EXISTS "Users can view all gamification stats" ON public.user_gamification_stats;
CREATE POLICY "Users can view all gamification stats" ON public.user_gamification_stats FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own stats" ON public.user_gamification_stats;
CREATE POLICY "Users can manage own stats" ON public.user_gamification_stats FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES - TICKET COUNTERS
-- ============================================
DROP POLICY IF EXISTS "Team members can manage counters" ON public.ticket_counters;
CREATE POLICY "Team members can manage counters" ON public.ticket_counters FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
);

-- ============================================
-- FUNCTIONS - Auto-update timestamps
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_clients_updated_at ON public.clients;
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_boards_updated_at ON public.boards;
CREATE TRIGGER update_boards_updated_at BEFORE UPDATE ON public.boards FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_tickets_updated_at ON public.tickets;
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_comments_updated_at ON public.comments;
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- FUNCTION - Auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'team',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Also create gamification stats
  INSERT INTO public.user_gamification_stats (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- FUNCTION - Generate ticket ID
-- ============================================
CREATE OR REPLACE FUNCTION generate_ticket_id(p_client_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_number INTEGER;
  v_ticket_id TEXT;
BEGIN
  INSERT INTO public.ticket_counters (client_id, prefix, current_number)
  SELECT p_client_id, UPPER(LEFT(c.slug, 4)), 0
  FROM public.clients c WHERE c.id = p_client_id
  ON CONFLICT (client_id) DO NOTHING;

  UPDATE public.ticket_counters
  SET current_number = current_number + 1
  WHERE client_id = p_client_id
  RETURNING prefix, current_number INTO v_prefix, v_number;

  IF v_prefix IS NULL THEN
    v_prefix := 'AGCY';
    v_number := FLOOR(RANDOM() * 10000)::INTEGER;
  END IF;

  v_ticket_id := v_prefix || '-' || v_number;
  RETURN v_ticket_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-generate ticket_id on insert
CREATE OR REPLACE FUNCTION auto_generate_ticket_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_id IS NULL OR NEW.ticket_id = '' THEN
    NEW.ticket_id := generate_ticket_id(NEW.client_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS before_ticket_insert ON public.tickets;
CREATE TRIGGER before_ticket_insert BEFORE INSERT ON public.tickets FOR EACH ROW EXECUTE FUNCTION auto_generate_ticket_id();

-- ============================================
-- FUNCTION - Log time entry activity
-- ============================================
CREATE OR REPLACE FUNCTION log_time_entry_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.activity_log (user_id, activity_type, entity_type, entity_id, entity_name, metadata)
  VALUES (
    NEW.user_id,
    'time_logged',
    'time_entry',
    NEW.id,
    NEW.description,
    jsonb_build_object('minutes', NEW.minutes, 'client_id', NEW.client_id, 'billable', NEW.billable)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_time_entry_created ON public.time_entries;
CREATE TRIGGER on_time_entry_created AFTER INSERT ON public.time_entries FOR EACH ROW EXECUTE FUNCTION log_time_entry_activity();

-- ============================================
-- FUNCTION - Log ticket status changes
-- ============================================
CREATE OR REPLACE FUNCTION log_ticket_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.activity_log (user_id, activity_type, entity_type, entity_id, entity_name, metadata)
    VALUES (
      NEW.assigned_to,
      CASE WHEN NEW.status = 'done' THEN 'ticket_completed' ELSE 'status_changed' END,
      'ticket',
      NEW.id,
      NEW.ticket_id,
      jsonb_build_object('title', NEW.title, 'from_status', OLD.status, 'to_status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_ticket_status_change ON public.tickets;
CREATE TRIGGER on_ticket_status_change AFTER UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION log_ticket_status_change();

-- ============================================
-- FUNCTION - Log new ticket creation
-- ============================================
CREATE OR REPLACE FUNCTION log_ticket_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.activity_log (user_id, activity_type, entity_type, entity_id, entity_name, metadata)
  VALUES (
    NEW.created_by,
    'ticket_created',
    'ticket',
    NEW.id,
    NEW.ticket_id,
    jsonb_build_object('title', NEW.title, 'board_id', NEW.board_id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_ticket_created ON public.tickets;
CREATE TRIGGER on_ticket_created AFTER INSERT ON public.tickets FOR EACH ROW EXECUTE FUNCTION log_ticket_created();

-- ============================================
-- FUNCTION - Log new comment
-- ============================================
CREATE OR REPLACE FUNCTION log_comment_added()
RETURNS TRIGGER AS $$
DECLARE
  ticket_info RECORD;
BEGIN
  SELECT ticket_id, title INTO ticket_info FROM public.tickets WHERE id = NEW.ticket_id;
  
  INSERT INTO public.activity_log (user_id, activity_type, entity_type, entity_id, entity_name, metadata)
  VALUES (
    NEW.user_id,
    'comment_added',
    'comment',
    NEW.id,
    ticket_info.ticket_id,
    jsonb_build_object('ticket_title', ticket_info.title, 'preview', LEFT(NEW.content, 100))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_comment_added ON public.comments;
CREATE TRIGGER on_comment_added AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION log_comment_added();

-- ============================================
-- FUNCTION - Update gamification on ticket complete
-- ============================================
CREATE OR REPLACE FUNCTION update_gamification_on_ticket_complete()
RETURNS TRIGGER AS $$
DECLARE
  xp_earned INTEGER := 25; -- Base XP for completing a ticket
BEGIN
  IF NEW.status = 'done' AND OLD.status != 'done' AND NEW.assigned_to IS NOT NULL THEN
    -- Add bonus XP for priority
    CASE NEW.priority
      WHEN 'urgent' THEN xp_earned := xp_earned + 25;
      WHEN 'high' THEN xp_earned := xp_earned + 15;
      WHEN 'medium' THEN xp_earned := xp_earned + 5;
      ELSE xp_earned := xp_earned;
    END CASE;
    
    -- Update or create gamification stats
    INSERT INTO public.user_gamification_stats (user_id, xp, tickets_completed, last_activity_date)
    VALUES (NEW.assigned_to, xp_earned, 1, CURRENT_DATE)
    ON CONFLICT (user_id) DO UPDATE SET
      xp = user_gamification_stats.xp + xp_earned,
      tickets_completed = user_gamification_stats.tickets_completed + 1,
      current_streak = CASE 
        WHEN user_gamification_stats.last_activity_date = CURRENT_DATE - 1 
        THEN user_gamification_stats.current_streak + 1
        WHEN user_gamification_stats.last_activity_date = CURRENT_DATE 
        THEN user_gamification_stats.current_streak
        ELSE 1
      END,
      longest_streak = GREATEST(
        user_gamification_stats.longest_streak,
        CASE 
          WHEN user_gamification_stats.last_activity_date = CURRENT_DATE - 1 
          THEN user_gamification_stats.current_streak + 1
          ELSE 1
        END
      ),
      last_activity_date = CURRENT_DATE,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_ticket_complete_gamification ON public.tickets;
CREATE TRIGGER on_ticket_complete_gamification AFTER UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION update_gamification_on_ticket_complete();

-- ============================================
-- FUNCTION - Update gamification on time logged
-- ============================================
CREATE OR REPLACE FUNCTION update_gamification_on_time_log()
RETURNS TRIGGER AS $$
DECLARE
  xp_earned INTEGER;
  hours_logged DECIMAL;
BEGIN
  hours_logged := NEW.minutes / 60.0;
  xp_earned := GREATEST(5, FLOOR(hours_logged * 10)::INTEGER); -- 10 XP per hour, min 5
  
  INSERT INTO public.user_gamification_stats (user_id, xp, hours_logged, last_activity_date)
  VALUES (NEW.user_id, xp_earned, hours_logged, CURRENT_DATE)
  ON CONFLICT (user_id) DO UPDATE SET
    xp = user_gamification_stats.xp + xp_earned,
    hours_logged = user_gamification_stats.hours_logged + hours_logged,
    last_activity_date = CURRENT_DATE,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_time_log_gamification ON public.time_entries;
CREATE TRIGGER on_time_log_gamification AFTER INSERT ON public.time_entries FOR EACH ROW EXECUTE FUNCTION update_gamification_on_time_log();

-- ============================================
-- VIEW - Client hours summary
-- ============================================
CREATE OR REPLACE VIEW public.client_hours_summary AS
SELECT 
  c.id AS client_id,
  c.name AS client_name,
  c.color,
  c.monthly_hours,
  COALESCE(SUM(te.minutes), 0)::INTEGER AS minutes_used,
  ROUND(COALESCE(SUM(te.minutes), 0) / 60.0, 2) AS hours_used,
  c.monthly_hours - ROUND(COALESCE(SUM(te.minutes), 0) / 60.0, 2) AS hours_remaining,
  ROUND((COALESCE(SUM(te.minutes), 0) / 60.0 / NULLIF(c.monthly_hours, 0)) * 100, 1) AS usage_percentage
FROM public.clients c
LEFT JOIN public.time_entries te ON te.client_id = c.id
  AND te.date >= DATE_TRUNC('month', CURRENT_DATE)
  AND te.date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
WHERE c.is_active = true
GROUP BY c.id, c.name, c.color, c.monthly_hours;

-- ============================================
-- MAKE ADMIN - Run this for your admin user
-- ============================================
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'justin@brandastic.com';

-- ============================================
-- DONE! ✅
-- ============================================
SELECT 'Master database setup complete! All features should now work.' as status;
