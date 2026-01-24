-- ============================================
-- ADD TITLE FIELD TO PROFILES
-- Run this in Supabase SQL Editor
-- ============================================

-- Add title column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS title TEXT;

-- Verify it worked
SELECT id, email, full_name, title, role 
FROM profiles 
ORDER BY full_name 
LIMIT 20;
