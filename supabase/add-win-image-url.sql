-- =====================================================
-- ADD IMAGE_URL TO CLIENT_WINS
-- Allows team to upload screenshots for their wins
-- =====================================================

-- Add image_url column if it doesn't exist
ALTER TABLE public.client_wins 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- =====================================================
-- DONE - Run this in Supabase SQL Editor
-- =====================================================
