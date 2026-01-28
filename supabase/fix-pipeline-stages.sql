-- Fix pipeline stages to match actual sales process
-- Run this if you already ran the previous SQL

-- Drop the old constraint
ALTER TABLE public.clients 
DROP CONSTRAINT IF EXISTS clients_pipeline_stage_check;

-- Add the new constraint with correct stages
ALTER TABLE public.clients 
ADD CONSTRAINT clients_pipeline_stage_check 
CHECK (pipeline_stage IN ('lead', 'kickoff', 'proposal', 'contract', 'won', 'lost'));

-- Update any existing records that used old stage names
UPDATE public.clients SET pipeline_stage = 'lead' WHERE pipeline_stage = 'qualified';
UPDATE public.clients SET pipeline_stage = 'contract' WHERE pipeline_stage = 'negotiation';
UPDATE public.clients SET pipeline_stage = 'won' WHERE pipeline_stage = 'closed_won';
UPDATE public.clients SET pipeline_stage = 'lost' WHERE pipeline_stage = 'closed_lost';
