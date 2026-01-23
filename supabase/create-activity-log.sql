-- Activity log table for real-time feed
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  activity_type text not null,
  entity_type text null,
  entity_id uuid null,
  entity_name text null,
  user_id uuid not null,
  client_id uuid null,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.activity_log enable row level security;

drop policy if exists "Activity log readable by authenticated users" on public.activity_log;
create policy "Activity log readable by authenticated users"
  on public.activity_log for select
  to authenticated
  using (true);

drop policy if exists "Activity log insert by authenticated users" on public.activity_log;
create policy "Activity log insert by authenticated users"
  on public.activity_log for insert
  to authenticated
  with check (auth.uid() = user_id);

