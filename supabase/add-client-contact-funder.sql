-- Add funding contact for client point-of-contact
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS contact_funder TEXT;
