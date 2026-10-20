-- Injuries placed on the body map, with a daily pain check-in for each.

create table public.injuries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Same keys as exercises.body_regions.
  region text not null,
  side text not null default 'center' check (side in ('left', 'right', 'center')),
  name text,
  notes text,
  started_on date not null default current_date,
  healed_on date,
  created_at timestamptz not null default now(),
  check (healed_on is null or healed_on >= started_on)
);

create index injuries_user_id_started_on_idx
  on public.injuries (user_id, started_on desc);

alter table public.injuries enable row level security;

create policy "Users can read their own injuries"
  on public.injuries for select
  using ((select auth.uid()) = user_id);

create policy "Users can create their own injuries"
  on public.injuries for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own injuries"
  on public.injuries for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own injuries"
  on public.injuries for delete
  using ((select auth.uid()) = user_id);

create table public.injury_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  injury_id uuid not null references public.injuries (id) on delete cascade,
  -- The person's local date, sent by the app, so "today" matches their day.
  checked_on date not null,
  pain smallint not null check (pain between 0 and 10),
  notes text,
  created_at timestamptz not null default now(),
  unique (injury_id, checked_on)
);

alter table public.injury_checkins enable row level security;

create policy "Users can read their own check-ins"
  on public.injury_checkins for select
  using ((select auth.uid()) = user_id);

-- A check-in can only be added to one of your own injuries.
create policy "Users can add check-ins to their own injuries"
  on public.injury_checkins for insert
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.injuries i
      where i.id = injury_id and i.user_id = (select auth.uid())
    )
  );

create policy "Users can update their own check-ins"
  on public.injury_checkins for update
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.injuries i
      where i.id = injury_id and i.user_id = (select auth.uid())
    )
  );

create policy "Users can delete their own check-ins"
  on public.injury_checkins for delete
  using ((select auth.uid()) = user_id);
