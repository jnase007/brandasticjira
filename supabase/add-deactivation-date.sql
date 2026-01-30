-- ============================================
-- Add Deactivation Date to Clients
-- Run this in your Supabase SQL Editor
-- ============================================

-- Add deactivated_at column to track when clients went inactive
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS deactivated_at DATE;

-- Add a note/reason column for why they were deactivated
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;

-- Create index for filtering by deactivation date
CREATE INDEX IF NOT EXISTS idx_clients_deactivated_at ON public.clients(deactivated_at) 
WHERE deactivated_at IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN public.clients.deactivated_at IS 'Date the client retainer/contract ended';
COMMENT ON COLUMN public.clients.deactivation_reason IS 'Reason for deactivation (e.g., "Client ended retainer", "Budget cuts", etc.)';
