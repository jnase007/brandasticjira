-- ============================================
-- CREATE CLIENT MESSAGES TABLE (client_notes)
-- Run in Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS public.client_notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT,
  content TEXT NOT NULL,
  note_type TEXT DEFAULT 'note',
  parent_id UUID REFERENCES public.client_notes(id) ON DELETE CASCADE,
  is_pinned BOOLEAN DEFAULT false,
  is_internal BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_notes_client_id ON public.client_notes(client_id);
CREATE INDEX IF NOT EXISTS idx_client_notes_created_at ON public.client_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_notes_parent_id ON public.client_notes(parent_id);

ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_notes_all" ON public.client_notes;
CREATE POLICY "client_notes_all" ON public.client_notes
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

SELECT 'client_notes table created' AS status;
