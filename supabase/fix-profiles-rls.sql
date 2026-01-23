-- ============================================
-- FIX PROFILES RLS POLICIES
-- Run this in Supabase SQL Editor to fix profile creation
-- ============================================

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;

-- Enable RLS (in case it's not enabled)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: Everyone can view all profiles (needed for team views, etc.)
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT 
  TO authenticated
  USING (true);

-- INSERT: Users can only insert their own profile (id must match auth.uid())
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- UPDATE: Users can only update their own profile
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================
-- ENSURE HANDLE_NEW_USER TRIGGER EXISTS
-- This auto-creates profiles when users sign up
-- ============================================

-- Create or replace the function
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
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
    avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url);
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log but don't fail the signup
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- ADD MISSING COLUMNS TO PROFILES (if not exist)
-- ============================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tagline TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS work_start_date DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_birthday BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_age BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hourly_cost DECIMAL(10,2) DEFAULT 50.00;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_hours_monthly INTEGER DEFAULT 160;

-- ============================================
-- CREATE PROFILE FOR EXISTING USERS WHO DON'T HAVE ONE
-- ============================================

INSERT INTO public.profiles (id, email, full_name, role)
SELECT 
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  'team'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SET JUSTIN AS ADMIN
-- ============================================

UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'justin@brandastic.com';

-- ============================================
-- VERIFY CHANGES
-- ============================================

SELECT 'Profiles RLS fixed!' as status;

-- Show current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'profiles';

-- Show profile count
SELECT COUNT(*) as profile_count FROM public.profiles;
