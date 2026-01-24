-- ============================================
-- USER DEACTIVATION FEATURE
-- Run this in Supabase SQL Editor
-- ============================================

-- Add is_active column to profiles (if not exists)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);

-- Update existing profiles to be active
UPDATE profiles SET is_active = true WHERE is_active IS NULL;

-- Verify it worked
SELECT id, email, full_name, role, is_active 
FROM profiles 
ORDER BY is_active DESC, full_name 
LIMIT 20;
