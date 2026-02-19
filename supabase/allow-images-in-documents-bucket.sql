-- Allow images (and all file types) in the documents bucket used for ticket attachments.
-- Run this in the Supabase Dashboard → SQL Editor.
-- This fixes "mime type image/png is not supported" when adding images as attachments.

UPDATE storage.buckets
SET allowed_mime_types = NULL   -- NULL = allow all MIME types (images, PDFs, etc.)
WHERE id = 'documents';

-- Verify (optional): should show allowed_mime_types = NULL for documents
-- SELECT id, name, allowed_mime_types FROM storage.buckets WHERE id = 'documents';
