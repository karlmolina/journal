-- Workout tracking, kept separate from journal entries.

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  -- Set while the stopwatch is paused; the pause's length is added to
  -- paused_seconds when it resumes.
  paused_at timestamptz,
  paused_seconds integer not null default 0 check (paused_seconds >= 0),
  ended_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

create index workouts_user_id_started_at_idx
  on public.workouts (user_id, started_at desc, id desc);

-- At most one workout in progress per person.
create unique index workouts_one_active_per_user_idx
  on public.workouts (user_id)
  where ended_at is null;

alter table public.workouts enable row level security;

create policy "Users can read their own workouts"
  on public.workouts for select
  using ((select auth.uid()) = user_id);

create policy "Users can create their own workouts"
  on public.workouts for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own workouts"
  on public.workouts for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own workouts"
  on public.workouts for delete
  using ((select auth.uid()) = user_id);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  exercise_name text not null check (length(trim(exercise_name)) > 0),
  reps integer check (reps > 0),
  weight numeric(7, 2) check (weight >= 0),
  duration_seconds integer check (duration_seconds > 0),
  created_at timestamptz not null default now()
);

create index workout_sets_workout_id_created_at_idx
  on public.workout_sets (workout_id, created_at);

create index workout_sets_user_id_exercise_name_idx
  on public.workout_sets (user_id, lower(exercise_name), created_at);

alter table public.workout_sets enable row level security;

create policy "Users can read their own sets"
  on public.workout_sets for select
  using ((select auth.uid()) = user_id);

-- A set can only be added to one of your own workouts.
create policy "Users can add sets to their own workouts"
  on public.workout_sets for insert
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.user_id = (select auth.uid())
    )
  );

create policy "Users can update their own sets"
  on public.workout_sets for update
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.user_id = (select auth.uid())
    )
  );

create policy "Users can delete their own sets"
  on public.workout_sets for delete
  using ((select auth.uid()) = user_id);
