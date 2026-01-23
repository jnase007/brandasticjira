-- Ensure comments policies exist and storage is configured for attachments

-- Comments policies (safe to re-run)
drop policy if exists "Users can view comments on accessible tickets" on public.comments;
create policy "Users can view comments on accessible tickets" on public.comments
  for select using (
    exists (
      select 1 from public.tickets t
      join public.profiles p on p.id = auth.uid()
      where t.id = comments.ticket_id
      and (p.role in ('team', 'admin') or p.client_id = t.client_id)
    )
  );

drop policy if exists "Authenticated users can create comments" on public.comments;
create policy "Authenticated users can create comments" on public.comments
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own comments" on public.comments;
create policy "Users can update own comments" on public.comments
  for update using (auth.uid() = user_id);

-- Storage bucket for attachments
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict do nothing;

-- Storage policies for attachments
drop policy if exists "Team members can upload attachments" on storage.objects;
create policy "Team members can upload attachments"
  on storage.objects for insert
  with check (
    bucket_id = 'attachments' and
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('team', 'admin')
    )
  );

drop policy if exists "Team members can view attachments" on storage.objects;
create policy "Team members can view attachments"
  on storage.objects for select
  using (
    bucket_id = 'attachments' and
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('team', 'admin')
    )
  );

drop policy if exists "Clients can view their attachments" on storage.objects;
create policy "Clients can view their attachments"
  on storage.objects for select
  using (
    bucket_id = 'attachments' and
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'client'
      and (storage.foldername(name))[1] = p.client_id::text
    )
  );

drop policy if exists "Team members can delete attachments" on storage.objects;
create policy "Team members can delete attachments"
  on storage.objects for delete
  using (
    bucket_id = 'attachments' and
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('team', 'admin')
    )
  );

