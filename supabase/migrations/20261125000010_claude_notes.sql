-- Notes you write for Claude from the button in the bottom-left corner:
-- feature requests, bugs, feedback. Claude sessions read the open ones
-- (done_at is null) and set done_at once they've picked a note up.

create table public.claude_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 10000),
  created_at timestamptz not null default now(),
  -- Set by Claude when it picks the note up.
  done_at timestamptz
);

create index claude_notes_user_id_idx on public.claude_notes (user_id, created_at desc);

alter table public.claude_notes enable row level security;

create policy "Users can read their own Claude notes"
  on public.claude_notes for select to authenticated
  using ((select auth.uid()) = user_id and (select public.is_member()));
create policy "Users can add their own Claude notes"
  on public.claude_notes for insert to authenticated
  with check ((select auth.uid()) = user_id and (select public.is_member()));
create policy "Users can update their own Claude notes"
  on public.claude_notes for update to authenticated
  using ((select auth.uid()) = user_id and (select public.is_member()))
  with check ((select auth.uid()) = user_id and (select public.is_member()));
create policy "Users can delete their own Claude notes"
  on public.claude_notes for delete to authenticated
  using ((select auth.uid()) = user_id and (select public.is_member()));
