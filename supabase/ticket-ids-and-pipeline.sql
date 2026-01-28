-- =====================================================
-- TICKET IDS & SALES PIPELINE SCHEMA
-- =====================================================
-- This adds:
-- 1. Client-specific ticket IDs (like Jira: B-1, B-2, etc.)
-- 2. Sales pipeline/prospect status for clients
-- 3. Estimated hours and project type fields
-- =====================================================

-- 1. ADD CLIENT PREFIX AND COUNTER FOR TICKET IDS
-- =====================================================
-- Add prefix (e.g., "B" for Brandastic) and counter for generating ticket IDs
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS ticket_prefix TEXT,
ADD COLUMN IF NOT EXISTS next_ticket_number INTEGER DEFAULT 1;

-- Generate prefix from client name if not set
UPDATE public.clients 
SET ticket_prefix = UPPER(LEFT(REGEXP_REPLACE(name, '[^a-zA-Z]', '', 'g'), 3))
WHERE ticket_prefix IS NULL;

-- 2. ADD PIPELINE/SALES FIELDS TO CLIENTS
-- =====================================================
-- Client status: prospect (in pipeline), active, inactive, closed
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS client_status TEXT DEFAULT 'active' 
  CHECK (client_status IN ('prospect', 'active', 'inactive', 'closed'));

-- Project/engagement type
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS engagement_type TEXT DEFAULT 'retainer'
  CHECK (engagement_type IN ('retainer', 'one_time', 'hourly', 'discovery'));

-- Estimated hours (for proposals/prospects)
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS estimated_monthly_hours NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS estimated_project_hours NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS estimated_budget NUMERIC(12,2);

-- Pipeline stage for prospects
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS pipeline_stage TEXT DEFAULT 'lead'
  CHECK (pipeline_stage IN ('lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'));

-- Probability of closing (for forecasting)
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS close_probability INTEGER DEFAULT 50
  CHECK (close_probability >= 0 AND close_probability <= 100);

-- Expected close date
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS expected_close_date DATE;

-- Source of lead
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS lead_source TEXT;

-- 3. FUNCTION TO GENERATE TICKET ID
-- =====================================================
CREATE OR REPLACE FUNCTION generate_ticket_id()
RETURNS TRIGGER AS $$
DECLARE
  v_prefix TEXT;
  v_number INTEGER;
  v_ticket_id TEXT;
BEGIN
  -- Get client prefix and next number
  SELECT 
    COALESCE(ticket_prefix, UPPER(LEFT(REGEXP_REPLACE(name, '[^a-zA-Z]', '', 'g'), 3))),
    COALESCE(next_ticket_number, 1)
  INTO v_prefix, v_number
  FROM public.clients
  WHERE id = NEW.client_id;
  
  -- Generate ticket ID (e.g., "BRA-1")
  v_ticket_id := v_prefix || '-' || v_number;
  
  -- Update the ticket with the generated ID
  NEW.ticket_id := v_ticket_id;
  
  -- Increment the counter on the client
  UPDATE public.clients
  SET next_ticket_number = v_number + 1
  WHERE id = NEW.client_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate ticket IDs on insert
DROP TRIGGER IF EXISTS trigger_generate_ticket_id ON public.tickets;
CREATE TRIGGER trigger_generate_ticket_id
  BEFORE INSERT ON public.tickets
  FOR EACH ROW
  WHEN (NEW.ticket_id IS NULL OR NEW.ticket_id = '')
  EXECUTE FUNCTION generate_ticket_id();

-- 4. BACKFILL EXISTING TICKETS WITH IDS
-- =====================================================
-- First, update client prefixes
UPDATE public.clients 
SET ticket_prefix = UPPER(LEFT(REGEXP_REPLACE(name, '[^a-zA-Z]', '', 'g'), 3))
WHERE ticket_prefix IS NULL;

-- Generate IDs for existing tickets that don't have one
DO $$
DECLARE
  v_ticket RECORD;
  v_prefix TEXT;
  v_number INTEGER;
BEGIN
  FOR v_ticket IN 
    SELECT t.id, t.client_id, c.ticket_prefix, c.name
    FROM public.tickets t
    JOIN public.clients c ON c.id = t.client_id
    WHERE t.ticket_id IS NULL OR t.ticket_id = ''
    ORDER BY t.created_at
  LOOP
    -- Get current number for this client
    SELECT COALESCE(next_ticket_number, 1) INTO v_number
    FROM public.clients WHERE id = v_ticket.client_id;
    
    v_prefix := COALESCE(v_ticket.ticket_prefix, UPPER(LEFT(REGEXP_REPLACE(v_ticket.name, '[^a-zA-Z]', '', 'g'), 3)));
    
    -- Update ticket
    UPDATE public.tickets 
    SET ticket_id = v_prefix || '-' || v_number
    WHERE id = v_ticket.id;
    
    -- Increment counter
    UPDATE public.clients
    SET next_ticket_number = v_number + 1
    WHERE id = v_ticket.client_id;
  END LOOP;
END $$;

-- 5. UPDATE is_active TO USE NEW client_status
-- =====================================================
-- Sync is_active with client_status
UPDATE public.clients 
SET client_status = CASE 
  WHEN is_active = true THEN 'active'
  ELSE 'inactive'
END
WHERE client_status IS NULL;

-- 6. HELPER FUNCTION: Get next ticket ID preview
-- =====================================================
CREATE OR REPLACE FUNCTION get_next_ticket_id(p_client_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_number INTEGER;
BEGIN
  SELECT 
    COALESCE(ticket_prefix, UPPER(LEFT(REGEXP_REPLACE(name, '[^a-zA-Z]', '', 'g'), 3))),
    COALESCE(next_ticket_number, 1)
  INTO v_prefix, v_number
  FROM public.clients
  WHERE id = p_client_id;
  
  RETURN v_prefix || '-' || v_number;
END;
$$ LANGUAGE plpgsql;

-- 7. INDEX FOR TICKET ID LOOKUPS
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_id ON public.tickets(ticket_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(client_status);
CREATE INDEX IF NOT EXISTS idx_clients_pipeline ON public.clients(pipeline_stage) WHERE client_status = 'prospect';

-- =====================================================
-- DONE!
-- =====================================================
-- After running this:
-- 1. All clients will have a ticket_prefix (e.g., "BRA" for Brandastic)
-- 2. All tickets will get IDs like "BRA-1", "BRA-2", etc.
-- 3. New tickets auto-generate IDs on creation
-- 4. Clients can be in "prospect" status for sales pipeline
-- =====================================================
