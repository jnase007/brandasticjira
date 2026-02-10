-- ============================================
-- DIAGNOSE AUTH/PROFILE ISSUES
-- Run this in Supabase SQL Editor to find and fix issues
-- ============================================

-- 1. CHECK FOR USERS WITHOUT PROFILES
-- These users will have RLS issues (no data visible)
SELECT 
  u.id,
  u.email,
  u.created_at,
  u.raw_user_meta_data->>'provider' AS auth_provider,
  CASE WHEN p.id IS NULL THEN '❌ MISSING PROFILE' ELSE '✅ Has profile' END AS profile_status
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
ORDER BY u.created_at DESC
LIMIT 50;

-- 2. CHECK PROFILES ROLES
-- Users need role 'team' or 'admin' to access data
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  CASE 
    WHEN p.role IN ('team', 'admin') THEN '✅ Can access data'
    WHEN p.role = 'client' THEN '⚠️ Client role - limited access'
    ELSE '❌ Unknown role - RLS will block'
  END AS access_status
FROM public.profiles p
ORDER BY p.created_at DESC
LIMIT 50;

-- 3. FIX: CREATE MISSING PROFILES
-- This creates profiles for any users who don't have one
INSERT INTO public.profiles (id, email, full_name, role)
SELECT 
  u.id,
  u.email,
  COALESCE(
    u.raw_user_meta_data->>'full_name', 
    u.raw_user_meta_data->>'name', 
    split_part(u.email, '@', 1)
  ),
  'team'  -- Default to team role
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 4. VERIFY THE TRIGGER EXISTS
SELECT 
  t.tgname AS trigger_name,
  p.proname AS function_name,
  t.tgenabled AS enabled
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgname = 'on_auth_user_created';

-- 5. CHECK RLS POLICIES ON KEY TABLES
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('profiles', 'clients', 'boards', 'tickets', 'time_entries')
ORDER BY tablename, policyname;

-- ============================================
-- OPTIONAL FIXES (uncomment to run)
-- ============================================

-- FIX A: Ensure all Google OAuth users have 'team' role
-- UPDATE public.profiles 
-- SET role = 'team' 
-- WHERE role IS NULL OR role = '';

-- FIX B: Recreate the trigger if missing
/*
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'team'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
*/

-- FIX C: Make RLS more permissive for authenticated users
/*
-- This allows all authenticated users to access data (for debugging)
-- WARNING: This is permissive - only use temporarily

DROP POLICY IF EXISTS "temp_clients_access" ON public.clients;
CREATE POLICY "temp_clients_access" ON public.clients
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "temp_boards_access" ON public.boards;
CREATE POLICY "temp_boards_access" ON public.boards
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "temp_tickets_access" ON public.tickets;  
CREATE POLICY "temp_tickets_access" ON public.tickets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
*/
