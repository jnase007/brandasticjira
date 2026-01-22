-- ============================================
-- CLIENT PORTAL ENHANCEMENTS
-- Allow clients to submit requests and comments
-- ============================================

-- ============================================
-- 1. Allow clients to INSERT their own requests
-- ============================================
DROP POLICY IF EXISTS "Clients can create their own requests" ON public.client_requests;
CREATE POLICY "Clients can create their own requests" ON public.client_requests 
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'client' 
    AND client_id = client_requests.client_id
  )
);

-- ============================================
-- 2. Allow clients to view and comment on their tickets
-- ============================================

-- First ensure clients can view tickets for their client
DROP POLICY IF EXISTS "Clients can view their tickets" ON public.tickets;
CREATE POLICY "Clients can view their tickets" ON public.tickets 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'client' 
    AND client_id = tickets.client_id
  )
);

-- Allow clients to view comments on their tickets
DROP POLICY IF EXISTS "Clients can view comments on their tickets" ON public.comments;
CREATE POLICY "Clients can view comments on their tickets" ON public.comments 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE t.id = comments.ticket_id 
    AND p.role = 'client' 
    AND p.client_id = t.client_id
  )
);

-- Allow clients to create comments on their tickets
DROP POLICY IF EXISTS "Clients can comment on their tickets" ON public.comments;
CREATE POLICY "Clients can comment on their tickets" ON public.comments 
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tickets t
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE t.id = comments.ticket_id 
    AND p.role = 'client' 
    AND p.client_id = t.client_id
  )
);

-- ============================================
-- 3. Allow clients to view their assigned team members
-- ============================================
DROP POLICY IF EXISTS "Clients can view team assigned to their tickets" ON public.profiles;
CREATE POLICY "Clients can view team assigned to their tickets" ON public.profiles 
FOR SELECT USING (
  -- Can always view own profile
  id = auth.uid()
  OR
  -- Can view team members assigned to their tickets
  EXISTS (
    SELECT 1 FROM public.tickets t
    JOIN public.profiles client_profile ON client_profile.id = auth.uid()
    WHERE t.assigned_to = profiles.id
    AND client_profile.role = 'client'
    AND client_profile.client_id = t.client_id
  )
  OR
  -- Team can view all profiles
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('team', 'admin')
  )
);

-- ============================================
-- 4. Allow clients to view their boards
-- ============================================
DROP POLICY IF EXISTS "Clients can view their boards" ON public.boards;
CREATE POLICY "Clients can view their boards" ON public.boards 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'client' 
    AND client_id = boards.client_id
  )
);

-- ============================================
-- DONE
-- ============================================
SELECT 'Client portal enhancements applied!' as status;
