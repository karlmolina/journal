-- Workouts started from a plan remember which plan and which of its
-- sessions they follow, so the app can offer the next session.
alter table public.workouts
  add column plan_id uuid references public.workout_plans (id) on delete set null,
  add column plan_session smallint check (plan_session >= 0);

create index workouts_plan_id_idx on public.workouts (plan_id);

-- Plans Claude rewrote on request keep a link to the version they replace
-- and the request itself, so earlier versions stay available.
alter table public.workout_plans
  add column revised_from uuid references public.workout_plans (id) on delete set null,
  add column instruction text;
