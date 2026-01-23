-- Public share link for client portal
alter table public.clients
add column if not exists public_enabled boolean default false;

alter table public.clients
add column if not exists public_token text;

create unique index if not exists clients_public_token_unique on public.clients (public_token);

