-- ============================================
-- FIX: Images Bucket Storage Policies
-- Run this in your Supabase SQL Editor
-- ============================================

-- First, ensure the images bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Images are publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "Team members can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Team members can update images" ON storage.objects;
DROP POLICY IF EXISTS "Team members can delete images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage images" ON storage.objects;

-- Allow anyone to view images (public bucket)
CREATE POLICY "Images are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'images');

-- Allow team members and admins to upload images
CREATE POLICY "Team members can upload images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'images' AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('team', 'admin')
  )
);

-- Allow team members and admins to update images
CREATE POLICY "Team members can update images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'images' AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('team', 'admin')
  )
);

-- Allow team members and admins to delete images
CREATE POLICY "Team members can delete images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'images' AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('team', 'admin')
  )
);

-- Verify the bucket is set up correctly
SELECT id, name, public FROM storage.buckets WHERE id = 'images';
