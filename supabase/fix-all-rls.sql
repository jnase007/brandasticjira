-- ============================================
-- FIX ALL RLS POLICIES
-- Run this to ensure all team members can access data
-- ============================================

-- ============================================
-- 1. PROFILES - Allow authenticated users to read all profiles
-- ============================================
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- 2. CLIENTS - Team can manage
-- ============================================
DROP POLICY IF EXISTS "Team members can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Team members can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Team members can update clients" ON public.clients;
DROP POLICY IF EXISTS "Team members can delete clients" ON public.clients;
DROP POLICY IF EXISTS "Clients can view own record" ON public.clients;
DROP POLICY IF EXISTS "Admins can manage clients" ON public.clients;

CREATE POLICY "Anyone authenticated can view clients" ON public.clients
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team can insert clients" ON public.clients
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );

CREATE POLICY "Team can update clients" ON public.clients
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );

CREATE POLICY "Admin can delete clients" ON public.clients
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 3. BOARDS - Team can manage
-- ============================================
DROP POLICY IF EXISTS "Team members can view all boards" ON public.boards;
DROP POLICY IF EXISTS "Team members can insert boards" ON public.boards;
DROP POLICY IF EXISTS "Team members can update boards" ON public.boards;
DROP POLICY IF EXISTS "Team members can delete boards" ON public.boards;
DROP POLICY IF EXISTS "Clients can view their boards" ON public.boards;

CREATE POLICY "Anyone authenticated can view boards" ON public.boards
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team can insert boards" ON public.boards
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );

CREATE POLICY "Team can update boards" ON public.boards
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );

CREATE POLICY "Team can delete boards" ON public.boards
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );

-- ============================================
-- 4. TICKETS - Team can manage
-- ============================================
DROP POLICY IF EXISTS "Team members can view all tickets" ON public.tickets;
DROP POLICY IF EXISTS "Team members can insert tickets" ON public.tickets;
DROP POLICY IF EXISTS "Team members can update tickets" ON public.tickets;
DROP POLICY IF EXISTS "Team members can delete tickets" ON public.tickets;
DROP POLICY IF EXISTS "Clients can view their tickets" ON public.tickets;

CREATE POLICY "Anyone authenticated can view tickets" ON public.tickets
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team can insert tickets" ON public.tickets
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );

CREATE POLICY "Team can update tickets" ON public.tickets
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );

CREATE POLICY "Team can delete tickets" ON public.tickets
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );

-- ============================================
-- 5. TIME ENTRIES - Team can manage
-- ============================================
DROP POLICY IF EXISTS "Team members can view all time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Team members can manage time entries" ON public.time_entries;

CREATE POLICY "Anyone authenticated can view time entries" ON public.time_entries
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team can manage time entries" ON public.time_entries
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );

-- ============================================
-- 6. COMMENTS - Authenticated users can manage
-- ============================================
DROP POLICY IF EXISTS "Users can view comments on accessible tickets" ON public.comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.comments;
DROP POLICY IF EXISTS "Users can update own comments" ON public.comments;

CREATE POLICY "Anyone authenticated can view comments" ON public.comments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can create comments" ON public.comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments" ON public.comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON public.comments
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 7. TICKET COUNTERS - Team can manage
-- ============================================
DROP POLICY IF EXISTS "Team members can manage counters" ON public.ticket_counters;

CREATE POLICY "Team can manage counters" ON public.ticket_counters
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('team', 'admin'))
  );

-- ============================================
-- VERIFY
-- ============================================
SELECT 'RLS policies updated successfully!' AS status;
