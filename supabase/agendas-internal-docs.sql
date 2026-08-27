-- Weekly client agendas, monthly project briefs, company Internal Docs.
-- Team/admin only. Do not clone Confluence. Do not import the dead SEO wiki.

CREATE TABLE IF NOT EXISTS public.client_agendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  meeting_date DATE NOT NULL,
  title TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (client_id, meeting_date)
);

CREATE TABLE IF NOT EXISTS public.client_agenda_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_id UUID NOT NULL REFERENCES public.client_agendas(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  presenter TEXT,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_monthly_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  month_start DATE NOT NULL,
  campaign_name TEXT,
  jira_key TEXT,
  key_due_dates TEXT,
  goals TEXT,
  scope TEXT,
  channels JSONB DEFAULT '[]'::jsonb,
  next_steps TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (client_id, month_start)
);

CREATE TABLE IF NOT EXISTS public.internal_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  url TEXT,
  notes TEXT,
  collection TEXT DEFAULT 'videos',
  kind TEXT DEFAULT 'note' CHECK (kind IN ('loom', 'note')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS client_agendas_client_date_idx
  ON public.client_agendas (client_id, meeting_date DESC);
CREATE INDEX IF NOT EXISTS client_agenda_topics_agenda_idx
  ON public.client_agenda_topics (agenda_id, sort_order);
CREATE INDEX IF NOT EXISTS client_monthly_briefs_client_month_idx
  ON public.client_monthly_briefs (client_id, month_start DESC);
CREATE INDEX IF NOT EXISTS internal_docs_collection_idx
  ON public.internal_docs (collection, created_at DESC);

ALTER TABLE public.client_agendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_agenda_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_monthly_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_docs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team can view client agendas" ON public.client_agendas;
DROP POLICY IF EXISTS "Team can write client agendas" ON public.client_agendas;
DROP POLICY IF EXISTS "Team can update client agendas" ON public.client_agendas;
DROP POLICY IF EXISTS "Team can delete client agendas" ON public.client_agendas;
CREATE POLICY "Team can view client agendas" ON public.client_agendas
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );
CREATE POLICY "Team can write client agendas" ON public.client_agendas
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );
CREATE POLICY "Team can update client agendas" ON public.client_agendas
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );
CREATE POLICY "Team can delete client agendas" ON public.client_agendas
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );

DROP POLICY IF EXISTS "Team can view agenda topics" ON public.client_agenda_topics;
DROP POLICY IF EXISTS "Team can write agenda topics" ON public.client_agenda_topics;
DROP POLICY IF EXISTS "Team can update agenda topics" ON public.client_agenda_topics;
DROP POLICY IF EXISTS "Team can delete agenda topics" ON public.client_agenda_topics;
CREATE POLICY "Team can view agenda topics" ON public.client_agenda_topics
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );
CREATE POLICY "Team can write agenda topics" ON public.client_agenda_topics
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );
CREATE POLICY "Team can update agenda topics" ON public.client_agenda_topics
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );
CREATE POLICY "Team can delete agenda topics" ON public.client_agenda_topics
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );

DROP POLICY IF EXISTS "Team can view monthly briefs" ON public.client_monthly_briefs;
DROP POLICY IF EXISTS "Team can write monthly briefs" ON public.client_monthly_briefs;
DROP POLICY IF EXISTS "Team can update monthly briefs" ON public.client_monthly_briefs;
DROP POLICY IF EXISTS "Team can delete monthly briefs" ON public.client_monthly_briefs;
CREATE POLICY "Team can view monthly briefs" ON public.client_monthly_briefs
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );
CREATE POLICY "Team can write monthly briefs" ON public.client_monthly_briefs
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );
CREATE POLICY "Team can update monthly briefs" ON public.client_monthly_briefs
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );
CREATE POLICY "Team can delete monthly briefs" ON public.client_monthly_briefs
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );

DROP POLICY IF EXISTS "Team can view internal docs" ON public.internal_docs;
DROP POLICY IF EXISTS "Team can write internal docs" ON public.internal_docs;
DROP POLICY IF EXISTS "Team can update internal docs" ON public.internal_docs;
DROP POLICY IF EXISTS "Team can delete internal docs" ON public.internal_docs;
CREATE POLICY "Team can view internal docs" ON public.internal_docs
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );
CREATE POLICY "Team can write internal docs" ON public.internal_docs
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );
CREATE POLICY "Team can update internal docs" ON public.internal_docs
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );
CREATE POLICY "Team can delete internal docs" ON public.internal_docs
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );
