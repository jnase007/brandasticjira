-- ============================================
-- FIX ADMIN ACCESS & PROFILE UPDATE PERMISSIONS
-- Run this in Supabase SQL Editor
-- ============================================

-- STEP 1: Check your current profile role
SELECT id, email, full_name, role, title 
FROM profiles 
WHERE email LIKE '%justin%' OR email LIKE '%brandastic%'
ORDER BY created_at;

-- STEP 2: Make sure you have admin role
-- Update this email to match yours if different
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'justin@brandastic.com';

-- STEP 3: Add policy for admins to update any profile
-- This allows admins to edit team member titles
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE 
  TO authenticated
  USING (
    -- User is admin
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    -- User is admin
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- STEP 4: Verify policies are in place
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

-- STEP 5: Show all profiles with their roles
SELECT id, email, full_name, role, title, is_active
FROM profiles 
ORDER BY 
  CASE role 
    WHEN 'admin' THEN 1 
    WHEN 'team' THEN 2 
    WHEN 'contractor' THEN 3
    WHEN 'client' THEN 4 
  END,
  full_name;
