-- What the person last asked a plan for: goals, equipment, days and minutes.
-- The Plan tab fills its form from here, so they only edit what changed.
-- Plans are now written by any chatbot the person pastes a prompt into, and
-- the reply is imported in the browser, so workout_plans.model records that.

create table public.workout_plan_preferences (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  goals text not null default '',
  equipment text not null default '',
  days_per_week smallint not null default 3 check (days_per_week between 1 and 7),
  minutes_per_session smallint not null default 45 check (minutes_per_session between 10 and 240),
  updated_at timestamptz not null default now()
);

alter table public.workout_plan_preferences enable row level security;

create policy "Users can read their own plan preferences"
  on public.workout_plan_preferences for select
  using ((select auth.uid()) = user_id and (select public.is_member()));

create policy "Users can create their own plan preferences"
  on public.workout_plan_preferences for insert
  with check ((select auth.uid()) = user_id and (select public.is_member()));

create policy "Users can update their own plan preferences"
  on public.workout_plan_preferences for update
  using ((select auth.uid()) = user_id and (select public.is_member()))
  with check ((select auth.uid()) = user_id and (select public.is_member()));

-- Start everyone from the goals and equipment of their latest plan.
insert into public.workout_plan_preferences
  (user_id, goals, equipment, days_per_week, minutes_per_session)
select distinct on (user_id)
  user_id, goals, coalesce(equipment, ''), days_per_week, minutes_per_session
from public.workout_plans
order by user_id, created_at desc;

alter table public.workout_plans alter column model set default 'chatbot';
