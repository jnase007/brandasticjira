-- ============================================
-- MAKE JUSTIN@BRANDASTIC.COM AN ADMIN
-- Run this in your Supabase SQL Editor
-- ============================================

-- Update Justin's role to admin
UPDATE public.profiles 
SET role = 'admin'
WHERE email = 'justin@brandastic.com';

-- Verify the update
SELECT id, email, full_name, role 
FROM public.profiles 
WHERE email = 'justin@brandastic.com';

-- Show all users and their roles
SELECT id, email, full_name, role, created_at 
FROM public.profiles 
ORDER BY role, full_name;
