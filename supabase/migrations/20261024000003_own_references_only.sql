-- Rows can only point at plans and exercises their owner can see: a workout
-- at one of your own plans, a set at a built-in or your own exercise, and a
-- revised plan at one of your own plans.

alter policy "Users can create their own workouts"
  on public.workouts
  with check (
    (select auth.uid()) = user_id
    and (select public.is_member())
    and (
      plan_id is null
      or exists (
        select 1 from public.workout_plans p
        where p.id = plan_id and p.user_id = (select auth.uid())
      )
    )
  );

alter policy "Users can update their own workouts"
  on public.workouts
  using ((select auth.uid()) = user_id and (select public.is_member()))
  with check (
    (select auth.uid()) = user_id
    and (select public.is_member())
    and (
      plan_id is null
      or exists (
        select 1 from public.workout_plans p
        where p.id = plan_id and p.user_id = (select auth.uid())
      )
    )
  );

alter policy "Users can add sets to their own workouts"
  on public.workout_sets
  with check (
    (select auth.uid()) = user_id
    and (select public.is_member())
    and exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.user_id = (select auth.uid())
    )
    and (
      exercise_id is null
      or exists (
        select 1 from public.exercises e
        where e.id = exercise_id
          and (e.user_id is null or e.user_id = (select auth.uid()))
      )
    )
  );

alter policy "Users can update their own sets"
  on public.workout_sets
  using ((select auth.uid()) = user_id and (select public.is_member()))
  with check (
    (select auth.uid()) = user_id
    and (select public.is_member())
    and exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.user_id = (select auth.uid())
    )
    and (
      exercise_id is null
      or exists (
        select 1 from public.exercises e
        where e.id = exercise_id
          and (e.user_id is null or e.user_id = (select auth.uid()))
      )
    )
  );

-- A policy on workout_plans can't query workout_plans itself (Postgres
-- reports infinite recursion), so this check goes through a function.
create function public.owns_workout_plan(plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workout_plans
    where id = plan_id and user_id = auth.uid()
  );
$$;

revoke execute on function public.owns_workout_plan(uuid) from public, anon;
grant execute on function public.owns_workout_plan(uuid) to authenticated;

alter policy "Users can create their own plans"
  on public.workout_plans
  with check (
    (select auth.uid()) = user_id
    and (select public.is_member())
    and (revised_from is null or public.owns_workout_plan(revised_from))
  );
