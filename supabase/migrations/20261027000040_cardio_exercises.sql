-- Cardio joins the exercise types.

alter table public.exercises
  drop constraint exercises_category_check,
  add constraint exercises_category_check
    check (category in ('cardio', 'mobility', 'stability', 'strength', 'stretch'));
