-- Exercise notes become a history: many dated notes per exercise instead of
-- one note that gets overwritten. A note can also say which injury it's
-- about, so the injury's history shows it too. Existing notes stay as the
-- first entry for their exercise, dated when they were last saved.

alter table public.exercise_notes
  add column id uuid not null default gen_random_uuid(),
  add column created_at timestamptz not null default now(),
  -- The exercise's name as typed, for showing a note away from its exercise
  -- (exercise_key is lowercased).
  add column exercise_name text,
  add column injury_id uuid references public.injuries (id) on delete set null;

update public.exercise_notes n
set
  created_at = n.updated_at,
  exercise_name = coalesce(
    (
      select e.name from public.exercises e
      where lower(trim(e.name)) = n.exercise_key
        and (e.user_id is null or e.user_id = n.user_id)
      order by e.user_id nulls last
      limit 1
    ),
    n.exercise_key
  );

alter table public.exercise_notes
  alter column exercise_name set not null,
  add constraint exercise_notes_exercise_name_matches_key
    check (lower(trim(exercise_name)) = exercise_key),
  drop constraint exercise_notes_pkey,
  add primary key (id);

create index exercise_notes_user_id_exercise_key_created_at_idx
  on public.exercise_notes (user_id, exercise_key, created_at desc);

create index exercise_notes_injury_id_idx
  on public.exercise_notes (injury_id)
  where injury_id is not null;

-- A note can only be linked to one of your own injuries.
alter policy "Users can create their own exercise notes"
  on public.exercise_notes
  with check (
    (select auth.uid()) = user_id
    and (select public.is_member())
    and (
      injury_id is null
      or exists (
        select 1 from public.injuries i
        where i.id = injury_id and i.user_id = (select auth.uid())
      )
    )
  );

alter policy "Users can update their own exercise notes"
  on public.exercise_notes
  using ((select auth.uid()) = user_id and (select public.is_member()))
  with check (
    (select auth.uid()) = user_id
    and (select public.is_member())
    and (
      injury_id is null
      or exists (
        select 1 from public.injuries i
        where i.id = injury_id and i.user_id = (select auth.uid())
      )
    )
  );
