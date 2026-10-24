-- Workout plans written by Claude from a person's goals (via the
-- plan-workout Edge Function, which keeps the API key server-side).

create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goals text not null check (length(trim(goals)) > 0),
  days_per_week smallint not null check (days_per_week between 1 and 7),
  minutes_per_session smallint not null check (minutes_per_session between 10 and 240),
  equipment text,
  -- { title, summary, sessions: [{ day, focus, duration_minutes, exercises:
  --   [{ name, sets, reps, rest_seconds, notes }] }], safety_notes: [] }
  plan jsonb not null,
  model text not null,
  created_at timestamptz not null default now()
);

create index workout_plans_user_id_created_at_idx
  on public.workout_plans (user_id, created_at desc);

alter table public.workout_plans enable row level security;

create policy "Users can read their own plans"
  on public.workout_plans for select
  using ((select auth.uid()) = user_id);

create policy "Users can create their own plans"
  on public.workout_plans for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own plans"
  on public.workout_plans for delete
  using ((select auth.uid()) = user_id);
