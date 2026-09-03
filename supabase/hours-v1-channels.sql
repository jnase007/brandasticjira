-- Hours v1: channel on time logs + optional per-channel hour splits on clients.
-- Chip has no SQL login. Run this in the Supabase SQL editor, then refresh.
-- App fails open if these columns are missing (channel treated as Other).

alter table public.time_entries
  add column if not exists channel text;

alter table public.time_entries
  add column if not exists client_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'time_entries_channel_check'
  ) then
    alter table public.time_entries
      add constraint time_entries_channel_check
      check (
        channel is null
        or channel in ('ppc', 'seo', 'social', 'email', 'web', 'creative', 'account', 'other')
      );
  end if;
end $$;

create index if not exists time_entries_channel_idx
  on public.time_entries (channel);

create index if not exists time_entries_client_id_idx
  on public.time_entries (client_id);

alter table public.clients
  add column if not exists channel_hours jsonb not null default '{}'::jsonb;
