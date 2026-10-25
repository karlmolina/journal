-- Changes to the plan made during one workout, leaving the plan itself alone:
-- {"swaps": {"2": "Leg press"}, "ended": [0]} swaps the third planned exercise
-- for leg press and ends the first one early. Keys and entries are indexes
-- into the session's exercises. Null means the workout follows the plan.
alter table public.workouts
  add column plan_changes jsonb
  check (plan_changes is null or jsonb_typeof(plan_changes) = 'object');
