-- Add is_ai column to profiles to identify AI assistants
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_ai BOOLEAN DEFAULT false;

-- Update any existing AI team members (adjust names as needed)
-- UPDATE profiles SET is_ai = true WHERE full_name ILIKE '%bot%' OR full_name ILIKE '%ai%';

-- Verify
SELECT id, full_name, email, is_ai FROM profiles ORDER BY full_name;
