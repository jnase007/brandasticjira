-- =====================================================
-- ADD MISSING PIPELINE/PROSPECT COLUMNS
-- Run this to fix "client_status column not found" error
-- =====================================================

-- Add client_status column
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS client_status TEXT DEFAULT 'active';

-- Add engagement_type column
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS engagement_type TEXT DEFAULT 'retainer';

-- Add estimated hours columns
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS estimated_monthly_hours NUMERIC(10,2);

ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS estimated_project_hours NUMERIC(10,2);

ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS estimated_budget NUMERIC(12,2);

-- Add pipeline_stage column
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS pipeline_stage TEXT DEFAULT 'lead';

-- Add lead tracking columns
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS lead_source TEXT;

ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS expected_close_date DATE;

ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add ticket prefix and counter for ticket IDs
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS ticket_prefix TEXT;

ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS next_ticket_number INTEGER DEFAULT 1;

-- Generate prefixes for existing clients
UPDATE public.clients 
SET ticket_prefix = UPPER(LEFT(REGEXP_REPLACE(name, '[^a-zA-Z]', '', 'g'), 3))
WHERE ticket_prefix IS NULL;

-- Done!
SELECT 'Pipeline columns added successfully!' as result;
