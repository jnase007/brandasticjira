-- ============================================
-- BRANDASTIC PM - Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE (extends Supabase auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'team' CHECK (role IN ('team', 'client', 'admin')),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CLIENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  monthly_hours INTEGER NOT NULL DEFAULT 40 CHECK (monthly_hours >= 20 AND monthly_hours <= 60),
  contact_email TEXT,
  contact_name TEXT,
  color TEXT DEFAULT '#FF6B6B',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TICKET ID COUNTER TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.ticket_counters (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE UNIQUE,
  prefix TEXT NOT NULL DEFAULT 'AGENCY',
  current_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BOARDS/PROJECTS TABLE
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
-- TICKETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ticket_id TEXT UNIQUE NOT NULL, -- e.g., "AGENCY-123"
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
-- COMMENTS TABLE
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
-- TIME ENTRIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.time_entries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER, -- Calculated: EXTRACT(EPOCH FROM (end_time - start_time)) / 60
  notes TEXT,
  is_running BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_tickets_board ON public.tickets(board_id);
CREATE INDEX IF NOT EXISTS idx_tickets_client ON public.tickets(client_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON public.tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_time_entries_ticket ON public.time_entries(ticket_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user ON public.time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_client ON public.time_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_comments_ticket ON public.comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_boards_client ON public.boards(client_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_counters ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Clients policies
CREATE POLICY "Team members can view all clients" ON public.clients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('team', 'admin')
    )
  );

CREATE POLICY "Clients can view their own client record" ON public.clients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND client_id = clients.id
    )
  );

CREATE POLICY "Admins can manage clients" ON public.clients
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Boards policies
CREATE POLICY "Team members can view all boards" ON public.boards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('team', 'admin')
    )
  );

CREATE POLICY "Clients can view their boards" ON public.boards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND client_id = boards.client_id
    )
  );

CREATE POLICY "Team members can manage boards" ON public.boards
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('team', 'admin')
    )
  );

-- Tickets policies
CREATE POLICY "Team members can view all tickets" ON public.tickets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('team', 'admin')
    )
  );

CREATE POLICY "Clients can view their tickets" ON public.tickets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND client_id = tickets.client_id
    )
  );

CREATE POLICY "Team members can manage tickets" ON public.tickets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('team', 'admin')
    )
  );

-- Comments policies
CREATE POLICY "Users can view comments on accessible tickets" ON public.comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE t.id = comments.ticket_id
      AND (p.role IN ('team', 'admin') OR p.client_id = t.client_id)
    )
  );

CREATE POLICY "Authenticated users can create comments" ON public.comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments" ON public.comments
  FOR UPDATE USING (auth.uid() = user_id);

-- Time entries policies
CREATE POLICY "Team members can view all time entries" ON public.time_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('team', 'admin')
    )
  );

CREATE POLICY "Team members can manage time entries" ON public.time_entries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('team', 'admin')
    )
  );

-- Ticket counters policies
CREATE POLICY "Team members can manage counters" ON public.ticket_counters
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('team', 'admin')
    )
  );

-- ============================================
-- TRIGGERS & FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_boards_updated_at
  BEFORE UPDATE ON public.boards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'team')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Generate sequential ticket ID
CREATE OR REPLACE FUNCTION generate_ticket_id(p_client_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_number INTEGER;
  v_ticket_id TEXT;
BEGIN
  -- Get or create counter for client (short prefix: max 3 chars from slug)
  INSERT INTO public.ticket_counters (client_id, prefix, current_number)
  SELECT p_client_id, UPPER(LEFT(REGEXP_REPLACE(COALESCE(c.slug, c.name, ''), '[^a-zA-Z0-9]', '', 'g'), 3)), 0
  FROM public.clients c WHERE c.id = p_client_id
  ON CONFLICT (client_id) DO NOTHING;

  -- Increment and get the new number
  UPDATE public.ticket_counters
  SET current_number = current_number + 1
  WHERE client_id = p_client_id
  RETURNING prefix, current_number INTO v_prefix, v_number;

  IF v_prefix IS NULL THEN
    v_prefix := 'TKT';
    v_number := FLOOR(RANDOM() * 10000)::INTEGER;
  END IF;

  -- Short ticket numbers: always output max 3-char prefix (e.g. ADO-1, BRA-2)
  v_ticket_id := UPPER(LEFT(REGEXP_REPLACE(v_prefix, '[^a-zA-Z]', '', 'g'), 3)) || '-' || v_number;
  IF v_ticket_id LIKE '-%' THEN v_ticket_id := 'TKT-' || v_number; END IF;
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

CREATE TRIGGER before_ticket_insert
  BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION auto_generate_ticket_id();

-- Calculate time entry duration on end
CREATE OR REPLACE FUNCTION calculate_time_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.end_time IS NOT NULL AND NEW.start_time IS NOT NULL THEN
    NEW.duration_minutes := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60;
    NEW.is_running := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_time_entry_update
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION calculate_time_duration();

-- ============================================
-- VIEWS FOR REPORTING
-- ============================================

-- Client hours summary view
CREATE OR REPLACE VIEW public.client_hours_summary AS
SELECT 
  c.id AS client_id,
  c.name AS client_name,
  c.monthly_hours,
  COALESCE(SUM(te.duration_minutes), 0)::INTEGER AS minutes_used,
  ROUND(COALESCE(SUM(te.duration_minutes), 0) / 60.0, 2) AS hours_used,
  c.monthly_hours - ROUND(COALESCE(SUM(te.duration_minutes), 0) / 60.0, 2) AS hours_remaining,
  ROUND((COALESCE(SUM(te.duration_minutes), 0) / 60.0 / c.monthly_hours) * 100, 1) AS usage_percentage
FROM public.clients c
LEFT JOIN public.time_entries te ON te.client_id = c.id
  AND te.start_time >= DATE_TRUNC('month', CURRENT_DATE)
  AND te.start_time < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
WHERE c.is_active = true
GROUP BY c.id, c.name, c.monthly_hours;

-- ============================================
-- SEED DATA (Optional - remove in production)
-- ============================================

-- Insert sample clients
INSERT INTO public.clients (name, slug, monthly_hours, contact_email, color) VALUES
  ('Acme Corp', 'acme', 40, 'contact@acme.com', '#FF6B6B'),
  ('TechStart Inc', 'techstart', 30, 'hello@techstart.io', '#4ECDC4'),
  ('Bloom Agency', 'bloom', 60, 'team@bloom.agency', '#6C5CE7')
ON CONFLICT DO NOTHING;
