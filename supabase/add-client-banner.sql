-- Add banner image URL for client profiles
alter table public.clients
add column if not exists banner_url text;

