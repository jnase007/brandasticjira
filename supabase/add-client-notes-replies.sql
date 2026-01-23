-- ============================================
-- ADD REPLIES TO CLIENT NOTES
-- Run in Supabase SQL Editor
-- ============================================

ALTER TABLE public.client_notes
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.client_notes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_client_notes_parent_id ON public.client_notes(parent_id);

SELECT 'client_notes replies enabled' AS status;
