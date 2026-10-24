-- Exercises done one side at a time (one arm or one leg). The guided workout
-- alternates a left and a right set for these, and each logged set says
-- which side it was.
alter table public.exercises
  add column unilateral boolean not null default false;

alter table public.workout_sets
  add column side text check (side in ('left', 'right'));

update public.exercises
set unilateral = true
where user_id is null
  and name in (
    'Band external rotation',
    'Doorway pec stretch',
    'Bird dog',
    'Dead bug',
    'Side plank',
    'Pallof press',
    'Clamshell',
    'Half-kneeling hip flexor stretch',
    '90/90 hip switch',
    'Copenhagen plank',
    'Single-leg Romanian deadlift',
    'Straight leg raise',
    'Terminal knee extension',
    'Step-down',
    'Single-leg balance',
    'Ankle alphabet',
    'Knee-to-wall ankle mobilization'
  );
