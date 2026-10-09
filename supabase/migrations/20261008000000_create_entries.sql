create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create index entries_user_id_created_at_idx
  on public.entries (user_id, created_at desc, id desc);

alter table public.entries enable row level security;

create policy "Users can read their own entries"
  on public.entries for select
  using ((select auth.uid()) = user_id);

create policy "Users can create their own entries"
  on public.entries for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own entries"
  on public.entries for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own entries"
  on public.entries for delete
  using ((select auth.uid()) = user_id);
