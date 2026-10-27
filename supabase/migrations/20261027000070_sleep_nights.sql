-- One row per night of sleep: how well you slept (0-10), when you went to bed
-- and when you woke up. Members only, like the rest of the app.

create table public.sleep_nights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The person's local date of the evening the night started, sent by the app.
  night date not null,
  quality smallint not null check (quality between 0 and 10),
  -- Local clock times; a wake-up earlier than bedtime is the next morning.
  bedtime time not null,
  woke_at time not null,
  created_at timestamptz not null default now(),
  unique (user_id, night)
);

alter table public.sleep_nights enable row level security;

create policy "Users can read their own sleep"
  on public.sleep_nights for select
  using ((select auth.uid()) = user_id and (select public.is_member()));

create policy "Users can log their own sleep"
  on public.sleep_nights for insert
  with check ((select auth.uid()) = user_id and (select public.is_member()));

create policy "Users can update their own sleep"
  on public.sleep_nights for update
  using ((select auth.uid()) = user_id and (select public.is_member()))
  with check ((select auth.uid()) = user_id and (select public.is_member()));

create policy "Users can delete their own sleep"
  on public.sleep_nights for delete
  using ((select auth.uid()) = user_id and (select public.is_member()));
