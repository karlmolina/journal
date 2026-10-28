-- Plans can be edited in the app (adding an exercise to a day), so their
-- owners may update the plan itself. Nothing else about a plan changes.

create policy "Users can update their own plans"
  on public.workout_plans for update
  using ((select auth.uid()) = user_id and (select public.is_member()))
  with check ((select auth.uid()) = user_id and (select public.is_member()));

revoke update on public.workout_plans from anon, authenticated;
grant update (plan) on public.workout_plans to authenticated;
