-- How long the person rested before this set, in seconds: from stopping the
-- previous set to starting this one. Null when there was no rest to time
-- (the first set, the right side after the left, the next exercise in a
-- superset, or a set logged without the timer).
alter table public.workout_sets
  add column rest_seconds integer check (rest_seconds is null or rest_seconds >= 0);
