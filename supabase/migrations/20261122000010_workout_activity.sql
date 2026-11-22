-- Workouts that aren't sets of exercises, like yoga or a run: what it was,
-- logged after the fact with how long it took (started_at to ended_at) and a
-- description in notes. Null for regular workouts with sets.

alter table public.workouts
  add column activity text
    check (activity is null or length(trim(activity)) between 1 and 100);
