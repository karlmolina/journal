-- Supersets set up during a workout: lists of exercise names done back to
-- back, like [["Bench press", "Barbell row"]]. Null means the workout follows
-- its plan's supersets (plans keep theirs in each exercise's "superset" letter).
alter table public.workouts
  add column supersets jsonb
  check (supersets is null or jsonb_typeof(supersets) = 'array');
