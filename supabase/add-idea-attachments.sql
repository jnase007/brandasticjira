-- ============================================
-- ADD ATTACHMENTS TO IDEAS
-- Run this in Supabase SQL Editor
-- ============================================

-- Create idea_attachments table
CREATE TABLE IF NOT EXISTS public.idea_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID REFERENCES public.ideas(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT, -- 'image', 'document', 'other'
  file_size INTEGER, -- in bytes
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.idea_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Team can view attachments" ON public.idea_attachments
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Team can upload attachments" ON public.idea_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );

CREATE POLICY "Uploaders and admins can delete attachments" ON public.idea_attachments
  FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Create index
CREATE INDEX IF NOT EXISTS idx_idea_attachments_idea ON public.idea_attachments(idea_id);

-- Create storage bucket for idea attachments (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('idea-attachments', 'idea-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for idea-attachments bucket
CREATE POLICY "Team can upload idea attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'idea-attachments' AND
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
);

CREATE POLICY "Anyone can view idea attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'idea-attachments');

CREATE POLICY "Uploaders and admins can delete idea attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'idea-attachments' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
);

SELECT 'Idea attachments table and storage created!' as status;
