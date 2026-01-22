-- ============================================
-- CLIENT PORTAL SCHEMA
-- ============================================

-- ============================================
-- 1. CLIENT REQUESTS TABLE
-- Tracks things we need from clients
-- ============================================
CREATE TABLE IF NOT EXISTS public.client_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'general' CHECK (type IN ('approval', 'assets', 'feedback', 'content', 'payment', 'meeting', 'general')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'completed')),
  due_date DATE,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. CLIENT MESSAGES TABLE
-- Communication thread with clients
-- ============================================
CREATE TABLE IF NOT EXISTS public.client_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  request_id UUID REFERENCES public.client_requests(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  message TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  is_from_client BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. CLIENT MONTHLY RECAPS TABLE
-- Monthly summaries for clients
-- ============================================
CREATE TABLE IF NOT EXISTS public.client_monthly_recaps (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  summary TEXT,
  highlights JSONB DEFAULT '[]'::jsonb,
  metrics JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, year, month)
);

-- ============================================
-- 4. CLIENT PROJECT SHOWCASE
-- Portfolio/showcase items for clients
-- ============================================
CREATE TABLE IF NOT EXISTS public.client_projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  image_url TEXT,
  gallery JSONB DEFAULT '[]'::jsonb,
  metrics JSONB DEFAULT '{}'::jsonb,
  url TEXT,
  completed_date DATE,
  is_featured BOOLEAN DEFAULT false,
  is_visible_to_client BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. EMAIL NOTIFICATIONS LOG
-- Track emails sent to clients
-- ============================================
CREATE TABLE IF NOT EXISTS public.email_notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('request', 'reminder', 'recap', 'welcome', 'general')),
  related_id UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_client_requests_client ON public.client_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_client_requests_status ON public.client_requests(status);
CREATE INDEX IF NOT EXISTS idx_client_messages_client ON public.client_messages(client_id);
CREATE INDEX IF NOT EXISTS idx_client_messages_request ON public.client_messages(request_id);
CREATE INDEX IF NOT EXISTS idx_client_recaps_client ON public.client_monthly_recaps(client_id);
CREATE INDEX IF NOT EXISTS idx_client_projects_client ON public.client_projects(client_id);

-- ============================================
-- ENABLE RLS
-- ============================================
ALTER TABLE public.client_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_monthly_recaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES - CLIENT REQUESTS
-- ============================================
DROP POLICY IF EXISTS "Team can manage all requests" ON public.client_requests;
CREATE POLICY "Team can manage all requests" ON public.client_requests FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
);

DROP POLICY IF EXISTS "Clients can view their requests" ON public.client_requests;
CREATE POLICY "Clients can view their requests" ON public.client_requests FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'client' AND client_id = client_requests.client_id
  )
);

DROP POLICY IF EXISTS "Clients can update their requests" ON public.client_requests;
CREATE POLICY "Clients can update their requests" ON public.client_requests FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'client' AND client_id = client_requests.client_id
  )
);

-- ============================================
-- RLS POLICIES - CLIENT MESSAGES
-- ============================================
DROP POLICY IF EXISTS "Team can manage all messages" ON public.client_messages;
CREATE POLICY "Team can manage all messages" ON public.client_messages FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
);

DROP POLICY IF EXISTS "Clients can view their messages" ON public.client_messages;
CREATE POLICY "Clients can view their messages" ON public.client_messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'client' AND client_id = client_messages.client_id
  )
);

DROP POLICY IF EXISTS "Clients can send messages" ON public.client_messages;
CREATE POLICY "Clients can send messages" ON public.client_messages FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'client' AND client_id = client_messages.client_id
  )
);

-- ============================================
-- RLS POLICIES - MONTHLY RECAPS
-- ============================================
DROP POLICY IF EXISTS "Team can manage recaps" ON public.client_monthly_recaps;
CREATE POLICY "Team can manage recaps" ON public.client_monthly_recaps FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
);

DROP POLICY IF EXISTS "Clients can view published recaps" ON public.client_monthly_recaps;
CREATE POLICY "Clients can view published recaps" ON public.client_monthly_recaps FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'client' AND client_id = client_monthly_recaps.client_id
  ) AND status = 'published'
);

-- ============================================
-- RLS POLICIES - PROJECT SHOWCASE
-- ============================================
DROP POLICY IF EXISTS "Team can manage projects" ON public.client_projects;
CREATE POLICY "Team can manage projects" ON public.client_projects FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
);

DROP POLICY IF EXISTS "Clients can view their projects" ON public.client_projects;
CREATE POLICY "Clients can view their projects" ON public.client_projects FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'client' AND client_id = client_projects.client_id
  ) AND is_visible_to_client = true
);

-- ============================================
-- RLS POLICIES - EMAIL NOTIFICATIONS
-- ============================================
DROP POLICY IF EXISTS "Team can manage emails" ON public.email_notifications;
CREATE POLICY "Team can manage emails" ON public.email_notifications FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
);

-- ============================================
-- TRIGGERS
-- ============================================
DROP TRIGGER IF EXISTS update_client_requests_updated_at ON public.client_requests;
CREATE TRIGGER update_client_requests_updated_at BEFORE UPDATE ON public.client_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_client_recaps_updated_at ON public.client_monthly_recaps;
CREATE TRIGGER update_client_recaps_updated_at BEFORE UPDATE ON public.client_monthly_recaps FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_client_projects_updated_at ON public.client_projects;
CREATE TRIGGER update_client_projects_updated_at BEFORE UPDATE ON public.client_projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- DONE
-- ============================================
SELECT 'Client portal schema created!' as status;
