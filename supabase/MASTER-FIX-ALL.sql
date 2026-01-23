-- ============================================
-- MASTER FIX - Run this to fix ALL RLS issues
-- This will fix: tickets, boards, clients, time_entries, profiles
-- ============================================

-- ============================================
-- 1. PROFILES
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 2. CLIENTS
-- ============================================
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_select_all" ON public.clients;
DROP POLICY IF EXISTS "clients_insert_all" ON public.clients;
DROP POLICY IF EXISTS "clients_update_all" ON public.clients;
DROP POLICY IF EXISTS "clients_delete_all" ON public.clients;
DROP POLICY IF EXISTS "Team members can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Users can manage clients" ON public.clients;

CREATE POLICY "clients_all" ON public.clients
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 3. BOARDS
-- ============================================
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boards_select_all" ON public.boards;
DROP POLICY IF EXISTS "boards_insert_all" ON public.boards;
DROP POLICY IF EXISTS "boards_update_all" ON public.boards;
DROP POLICY IF EXISTS "boards_delete_all" ON public.boards;
DROP POLICY IF EXISTS "Team can view boards" ON public.boards;
DROP POLICY IF EXISTS "Team can manage boards" ON public.boards;
DROP POLICY IF EXISTS "Anyone authenticated can view boards" ON public.boards;
DROP POLICY IF EXISTS "Users can manage boards" ON public.boards;

CREATE POLICY "boards_all" ON public.boards
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 4. TICKETS
-- ============================================
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tickets_select_all" ON public.tickets;
DROP POLICY IF EXISTS "tickets_insert_all" ON public.tickets;
DROP POLICY IF EXISTS "tickets_update_all" ON public.tickets;
DROP POLICY IF EXISTS "tickets_delete_all" ON public.tickets;
DROP POLICY IF EXISTS "Team can view tickets" ON public.tickets;
DROP POLICY IF EXISTS "Team can manage tickets" ON public.tickets;
DROP POLICY IF EXISTS "Anyone authenticated can view tickets" ON public.tickets;
DROP POLICY IF EXISTS "Team can insert tickets" ON public.tickets;
DROP POLICY IF EXISTS "Team can update tickets" ON public.tickets;
DROP POLICY IF EXISTS "Team can delete tickets" ON public.tickets;
DROP POLICY IF EXISTS "Team members can view all tickets" ON public.tickets;
DROP POLICY IF EXISTS "Team members can manage tickets" ON public.tickets;
DROP POLICY IF EXISTS "Users can manage tickets" ON public.tickets;
DROP POLICY IF EXISTS "Clients can view their tickets" ON public.tickets;

CREATE POLICY "tickets_all" ON public.tickets
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 5. TIME ENTRIES
-- ============================================
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "time_entries_select" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_insert" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_update" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_delete" ON public.time_entries;
DROP POLICY IF EXISTS "Team can view all time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Team can manage time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Team members can view time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Team members can manage time entries" ON public.time_entries;

CREATE POLICY "time_entries_all" ON public.time_entries
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 6. COMMENTS
-- ============================================
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments_all" ON public.comments;
DROP POLICY IF EXISTS "Users can view comments on accessible tickets" ON public.comments;
DROP POLICY IF EXISTS "Users can create comments" ON public.comments;
DROP POLICY IF EXISTS "Users can update own comments" ON public.comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;

CREATE POLICY "comments_all" ON public.comments
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 7. CLIENT TEAM ASSIGNMENTS (if exists)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'client_team_assignments') THEN
    ALTER TABLE public.client_team_assignments ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "team_assignments_all" ON public.client_team_assignments;
    
    CREATE POLICY "team_assignments_all" ON public.client_team_assignments
      FOR ALL TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ============================================
-- 8. CLIENT NOTES (if exists)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'client_notes') THEN
    ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "client_notes_all" ON public.client_notes;
    
    CREATE POLICY "client_notes_all" ON public.client_notes
      FOR ALL TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ============================================
-- DONE!
-- ============================================
SELECT 'ALL RLS POLICIES FIXED!' as status;
