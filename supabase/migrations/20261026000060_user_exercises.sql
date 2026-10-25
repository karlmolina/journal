-- Every logged set points at a library exercise. Names typed during a workout
-- that aren't in the library become the person's own exercises, so they show
-- in the library and can say which body areas they work.

-- Sets typed with a library exercise's name but never linked: link them,
-- preferring the person's own exercise over a built-in one.
update public.workout_sets s
set exercise_id = (
  select e.id from public.exercises e
  where lower(trim(e.name)) = lower(trim(s.exercise_name))
    and (e.user_id is null or e.user_id = s.user_id)
  order by e.user_id nulls last
  limit 1
)
where s.exercise_id is null;

-- The rest become the person's own exercises, named the way they last typed
-- them, and one side at a time if any set was logged with a side.
insert into public.exercises (user_id, name, unilateral)
select
  user_id,
  (array_agg(trim(exercise_name) order by created_at desc))[1],
  bool_or(side is not null)
from public.workout_sets
where exercise_id is null
group by user_id, lower(trim(exercise_name));

update public.workout_sets s
set exercise_id = (
  select e.id from public.exercises e
  where e.user_id = s.user_id
    and lower(trim(e.name)) = lower(trim(s.exercise_name))
  limit 1
)
where s.exercise_id is null;

-- Renaming your own exercise renames its sets and moves its notes, which are
-- matched by name. Runs as the person, so it only touches their own rows.
create function public.rename_exercise_references()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.workout_sets
  set exercise_name = new.name
  where exercise_id = new.id and exercise_name <> new.name;

  update public.exercise_notes
  set exercise_key = lower(trim(new.name)), exercise_name = new.name
  where user_id = new.user_id and exercise_key = lower(trim(old.name));

  return null;
end;
$$;

create trigger exercises_rename_references
  after update of name on public.exercises
  for each row
  when (old.name is distinct from new.name and new.user_id is not null)
  execute function public.rename_exercise_references();

-- Your own exercises are members-only, like the rest of your workout data.
-- Built-in exercises stay readable to everyone signed in.
alter policy "Everyone signed in can read built-in exercises and their own"
  on public.exercises
  using (
    user_id is null
    or ((select auth.uid()) = user_id and (select public.is_member()))
  );

alter policy "Users can create their own exercises"
  on public.exercises
  with check ((select auth.uid()) = user_id and (select public.is_member()));

alter policy "Users can update their own exercises"
  on public.exercises
  using ((select auth.uid()) = user_id and (select public.is_member()))
  with check ((select auth.uid()) = user_id and (select public.is_member()));

alter policy "Users can delete their own exercises"
  on public.exercises
  using ((select auth.uid()) = user_id and (select public.is_member()));
