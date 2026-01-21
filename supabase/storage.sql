-- ============================================
-- BRANDASTIC PM - Storage Configuration
-- Run this in your Supabase SQL Editor
-- ============================================

-- Create storage bucket for attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', false)
ON CONFLICT DO NOTHING;

-- Create storage bucket for avatars (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT DO NOTHING;

-- Create storage bucket for client logos (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT DO NOTHING;

-- ============================================
-- STORAGE POLICIES
-- ============================================

-- Attachments: Team members can upload/download
CREATE POLICY "Team members can upload attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'attachments' AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('team', 'admin')
  )
);

CREATE POLICY "Team members can view attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'attachments' AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('team', 'admin')
  )
);

CREATE POLICY "Clients can view their attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'attachments' AND
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'client'
    -- Object path format: client_id/ticket_id/filename
    AND (storage.foldername(name))[1] = p.client_id::text
  )
);

CREATE POLICY "Team members can delete attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'attachments' AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('team', 'admin')
  )
);

-- Avatars: Anyone authenticated can upload their own
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Avatars are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Logos: Admins can manage, everyone can view
CREATE POLICY "Logos are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'logos');

CREATE POLICY "Admins can manage logos"
ON storage.objects FOR ALL
USING (
  bucket_id = 'logos' AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);
