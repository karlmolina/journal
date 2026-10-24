-- The person's own notes on an exercise, like a cue that helps or the weight
-- that felt right. Keyed by the exercise's name (lowercased) so notes work for
-- plan exercises and typed-in ones that aren't in the library, the same way
-- sets are matched to exercises.

create table public.exercise_notes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_key text not null check (exercise_key = lower(trim(exercise_key)) and exercise_key <> ''),
  note text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_key)
);

alter table public.exercise_notes enable row level security;

create policy "Users can read their own exercise notes"
  on public.exercise_notes for select
  using ((select auth.uid()) = user_id and (select public.is_member()));

create policy "Users can create their own exercise notes"
  on public.exercise_notes for insert
  with check ((select auth.uid()) = user_id and (select public.is_member()));

create policy "Users can update their own exercise notes"
  on public.exercise_notes for update
  using ((select auth.uid()) = user_id and (select public.is_member()))
  with check ((select auth.uid()) = user_id and (select public.is_member()));

create policy "Users can delete their own exercise notes"
  on public.exercise_notes for delete
  using ((select auth.uid()) = user_id and (select public.is_member()));
