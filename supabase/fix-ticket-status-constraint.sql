-- ============================================
-- FIX TICKET STATUS CONSTRAINT
-- The original schema limited statuses to 'todo', 'inprogress', 'done'
-- We need to update this to support the full 7-status workflow
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Drop the old constraint
ALTER TABLE public.tickets 
DROP CONSTRAINT IF EXISTS tickets_status_check;

-- 2. Add new constraint with all valid statuses
ALTER TABLE public.tickets 
ADD CONSTRAINT tickets_status_check 
CHECK (status IN ('new', 'todo', 'in_progress', 'inprogress', 'internal_review', 'client_review', 'approved', 'ready_for_billing', 'closed', 'done'));

-- 3. Normalize any legacy status values to new format
UPDATE public.tickets SET status = 'new' WHERE status = 'todo';
UPDATE public.tickets SET status = 'in_progress' WHERE status = 'inprogress';
UPDATE public.tickets SET status = 'closed' WHERE status = 'done';

-- Done!
SELECT 'Ticket status constraint updated successfully!' as result;
