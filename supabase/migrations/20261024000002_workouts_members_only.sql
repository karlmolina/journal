-- Workouts are members-only, like entries: someone who signed in with Google
-- but never redeemed an invite code can't read or write any workout data.

alter policy "Users can read their own workouts"
  on public.workouts
  using ((select auth.uid()) = user_id and (select public.is_member()));

alter policy "Users can create their own workouts"
  on public.workouts
  with check ((select auth.uid()) = user_id and (select public.is_member()));

alter policy "Users can update their own workouts"
  on public.workouts
  using ((select auth.uid()) = user_id and (select public.is_member()))
  with check ((select auth.uid()) = user_id and (select public.is_member()));

alter policy "Users can delete their own workouts"
  on public.workouts
  using ((select auth.uid()) = user_id and (select public.is_member()));

alter policy "Users can read their own sets"
  on public.workout_sets
  using ((select auth.uid()) = user_id and (select public.is_member()));

alter policy "Users can add sets to their own workouts"
  on public.workout_sets
  with check (
    (select auth.uid()) = user_id
    and (select public.is_member())
    and exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.user_id = (select auth.uid())
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
  );

alter policy "Users can delete their own sets"
  on public.workout_sets
  using ((select auth.uid()) = user_id and (select public.is_member()));

alter policy "Everyone signed in can read built-in exercises and their own"
  on public.exercises
  using (
    (user_id is null or (select auth.uid()) = user_id)
    and (select public.is_member())
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

alter policy "Users can read their own injuries"
  on public.injuries
  using ((select auth.uid()) = user_id and (select public.is_member()));

alter policy "Users can create their own injuries"
  on public.injuries
  with check ((select auth.uid()) = user_id and (select public.is_member()));

alter policy "Users can update their own injuries"
  on public.injuries
  using ((select auth.uid()) = user_id and (select public.is_member()))
  with check ((select auth.uid()) = user_id and (select public.is_member()));

alter policy "Users can delete their own injuries"
  on public.injuries
  using ((select auth.uid()) = user_id and (select public.is_member()));

alter policy "Users can read their own check-ins"
  on public.injury_checkins
  using ((select auth.uid()) = user_id and (select public.is_member()));

alter policy "Users can add check-ins to their own injuries"
  on public.injury_checkins
  with check (
    (select auth.uid()) = user_id
    and (select public.is_member())
    and exists (
      select 1 from public.injuries i
      where i.id = injury_id and i.user_id = (select auth.uid())
    )
  );

alter policy "Users can update their own check-ins"
  on public.injury_checkins
  using ((select auth.uid()) = user_id and (select public.is_member()))
  with check (
    (select auth.uid()) = user_id
    and (select public.is_member())
    and exists (
      select 1 from public.injuries i
      where i.id = injury_id and i.user_id = (select auth.uid())
    )
  );

alter policy "Users can delete their own check-ins"
  on public.injury_checkins
  using ((select auth.uid()) = user_id and (select public.is_member()));

alter policy "Users can read their own plans"
  on public.workout_plans
  using ((select auth.uid()) = user_id and (select public.is_member()));

alter policy "Users can create their own plans"
  on public.workout_plans
  with check ((select auth.uid()) = user_id and (select public.is_member()));

alter policy "Users can delete their own plans"
  on public.workout_plans
  using ((select auth.uid()) = user_id and (select public.is_member()));
