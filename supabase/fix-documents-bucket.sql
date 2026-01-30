-- ============================================
-- FIX DOCUMENTS BUCKET - Allow All File Types
-- Run this in your Supabase SQL Editor
-- ============================================

-- First, try to update the existing bucket to allow all MIME types
UPDATE storage.buckets 
SET allowed_mime_types = NULL  -- NULL means all types are allowed
WHERE id = 'documents';

-- If the bucket doesn't exist, create it (public for easier access)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents', 
  'documents', 
  true,  -- Public bucket for task attachments
  52428800,  -- 50MB limit
  NULL  -- NULL means all types allowed
)
ON CONFLICT (id) DO UPDATE SET 
  allowed_mime_types = NULL,
  file_size_limit = 52428800;

-- Create the images bucket too (for avatar uploads, client logos, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images', 
  'images', 
  true,  -- Public bucket
  10485760,  -- 10MB limit
  NULL  -- Allow all image types
)
ON CONFLICT (id) DO UPDATE SET 
  allowed_mime_types = NULL,
  file_size_limit = 10485760;

-- ============================================
-- DROP EXISTING POLICIES (ignore errors if they don't exist)
-- ============================================
DROP POLICY IF EXISTS "Public documents access" ON storage.objects;
DROP POLICY IF EXISTS "Team can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Team can update documents" ON storage.objects;
DROP POLICY IF EXISTS "Team can delete documents" ON storage.objects;
DROP POLICY IF EXISTS "Public images access" ON storage.objects;
DROP POLICY IF EXISTS "Team can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Team can update images" ON storage.objects;
DROP POLICY IF EXISTS "Team can delete images" ON storage.objects;

-- ============================================
-- DOCUMENTS BUCKET POLICIES
-- ============================================

-- Anyone can view documents (needed for signed URLs to work)
CREATE POLICY "Public documents access"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents');

-- Authenticated users can upload to documents
CREATE POLICY "Team can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' AND
  auth.role() = 'authenticated'
);

-- Authenticated users can update their uploads
CREATE POLICY "Team can update documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documents' AND
  auth.role() = 'authenticated'
);

-- Authenticated users can delete documents
CREATE POLICY "Team can delete documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' AND
  auth.role() = 'authenticated'
);

-- ============================================
-- IMAGES BUCKET POLICIES
-- ============================================

-- Anyone can view images (public bucket)
CREATE POLICY "Public images access"
ON storage.objects FOR SELECT
USING (bucket_id = 'images');

-- Authenticated users can upload images
CREATE POLICY "Team can upload images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'images' AND
  auth.role() = 'authenticated'
);

-- Authenticated users can update images
CREATE POLICY "Team can update images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'images' AND
  auth.role() = 'authenticated'
);

-- Authenticated users can delete images
CREATE POLICY "Team can delete images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'images' AND
  auth.role() = 'authenticated'
);

-- ============================================
-- VERIFY
-- ============================================
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id IN ('documents', 'images');
