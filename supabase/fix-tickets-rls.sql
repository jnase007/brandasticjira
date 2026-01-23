-- ============================================
-- FIX TICKETS RLS POLICIES
-- Run this in Supabase SQL Editor if you're getting "Ticket not found" errors
-- ============================================

-- Enable RLS on tickets
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Drop all existing ticket policies to start fresh
DROP POLICY IF EXISTS "Team can view tickets" ON public.tickets;
DROP POLICY IF EXISTS "Team can manage tickets" ON public.tickets;
DROP POLICY IF EXISTS "Team members can view all tickets" ON public.tickets;
DROP POLICY IF EXISTS "Team members can manage tickets" ON public.tickets;
DROP POLICY IF EXISTS "Anyone authenticated can view tickets" ON public.tickets;
DROP POLICY IF EXISTS "Team can insert tickets" ON public.tickets;
DROP POLICY IF EXISTS "Team can update tickets" ON public.tickets;
DROP POLICY IF EXISTS "Team can delete tickets" ON public.tickets;
DROP POLICY IF EXISTS "Clients can view their tickets" ON public.tickets;
DROP POLICY IF EXISTS "Team members can insert tickets" ON public.tickets;
DROP POLICY IF EXISTS "Team members can update tickets" ON public.tickets;
DROP POLICY IF EXISTS "Team members can delete tickets" ON public.tickets;
DROP POLICY IF EXISTS "Users can manage tickets" ON public.tickets;

-- Create simple, permissive policies for all authenticated users
-- SELECT: Anyone authenticated can view any ticket
CREATE POLICY "tickets_select_all" ON public.tickets
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: Anyone authenticated can create tickets
CREATE POLICY "tickets_insert_all" ON public.tickets
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- UPDATE: Anyone authenticated can update tickets
CREATE POLICY "tickets_update_all" ON public.tickets
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE: Anyone authenticated can delete tickets
CREATE POLICY "tickets_delete_all" ON public.tickets
  FOR DELETE TO authenticated
  USING (true);

-- ============================================
-- ALSO FIX BOARDS RLS (tickets depend on boards)
-- ============================================
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team can view boards" ON public.boards;
DROP POLICY IF EXISTS "Team can manage boards" ON public.boards;
DROP POLICY IF EXISTS "boards_select_all" ON public.boards;
DROP POLICY IF EXISTS "boards_insert_all" ON public.boards;
DROP POLICY IF EXISTS "boards_update_all" ON public.boards;
DROP POLICY IF EXISTS "boards_delete_all" ON public.boards;

CREATE POLICY "boards_select_all" ON public.boards
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "boards_insert_all" ON public.boards
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "boards_update_all" ON public.boards
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "boards_delete_all" ON public.boards
  FOR DELETE TO authenticated
  USING (true);

-- ============================================
-- ALSO FIX CLIENTS RLS (tickets depend on clients)
-- ============================================
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_select_all" ON public.clients;
DROP POLICY IF EXISTS "clients_insert_all" ON public.clients;
DROP POLICY IF EXISTS "clients_update_all" ON public.clients;
DROP POLICY IF EXISTS "clients_delete_all" ON public.clients;
DROP POLICY IF EXISTS "Team members can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Users can manage clients" ON public.clients;

CREATE POLICY "clients_select_all" ON public.clients
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "clients_insert_all" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "clients_update_all" ON public.clients
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "clients_delete_all" ON public.clients
  FOR DELETE TO authenticated
  USING (true);

-- ============================================
-- VERIFY
-- ============================================
SELECT 'RLS policies fixed!' as status;

-- List all policies for verification
SELECT tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename IN ('tickets', 'boards', 'clients')
ORDER BY tablename, policyname;
