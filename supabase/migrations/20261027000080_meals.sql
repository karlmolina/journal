-- The Meals tab: a library of meals with their recipes, the meals planned
-- next (a simple list), and per-person settings (diet constraints for the
-- chatbot prompt, and which grocery items are ticked off). Members only, and
-- a planned meal can only point at one of its owner's meals.

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  -- How many people the recipe below feeds.
  servings smallint not null default 2 check (servings between 1 and 50),
  total_minutes smallint check (total_minutes between 1 and 2000),
  -- [{ qty, unit, item, note, aisle }]; empty until the recipe is imported.
  ingredients jsonb not null default '[]'::jsonb,
  -- Steps in order, as plain text.
  steps jsonb not null default '[]'::jsonb,
  -- Where the recipe came from, when imported from a link.
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meals_user_id_idx on public.meals (user_id);

create table public.meal_plan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  meal_id uuid not null references public.meals (id) on delete cascade,
  -- How many people to cook for; groceries scale from the recipe's servings.
  servings smallint not null check (servings between 1 and 50),
  created_at timestamptz not null default now()
);

create index meal_plan_user_id_idx on public.meal_plan (user_id);
create index meal_plan_meal_id_idx on public.meal_plan (meal_id);

create table public.meal_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- Like "Vegetarian", "Gluten free".
  diets text[] not null default '{}',
  -- Anything else for the chatbot: allergies, dislikes, equipment.
  diet_notes text not null default '',
  -- Grocery list keys that are ticked off.
  checked_groceries text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.meals enable row level security;
alter table public.meal_plan enable row level security;
alter table public.meal_settings enable row level security;

create policy "Users can read their own meals"
  on public.meals for select
  using ((select auth.uid()) = user_id and (select public.is_member()));
create policy "Users can add their own meals"
  on public.meals for insert
  with check ((select auth.uid()) = user_id and (select public.is_member()));
create policy "Users can update their own meals"
  on public.meals for update
  using ((select auth.uid()) = user_id and (select public.is_member()))
  with check ((select auth.uid()) = user_id and (select public.is_member()));
create policy "Users can delete their own meals"
  on public.meals for delete
  using ((select auth.uid()) = user_id and (select public.is_member()));

create policy "Users can read their own meal plan"
  on public.meal_plan for select
  using ((select auth.uid()) = user_id and (select public.is_member()));
create policy "Users can add to their own meal plan"
  on public.meal_plan for insert
  with check ((select auth.uid()) = user_id and (select public.is_member())
    and exists (
      select 1 from public.meals m
      where m.id = meal_id and m.user_id = (select auth.uid())
    ));
create policy "Users can update their own meal plan"
  on public.meal_plan for update
  using ((select auth.uid()) = user_id and (select public.is_member()))
  with check ((select auth.uid()) = user_id and (select public.is_member())
    and exists (
      select 1 from public.meals m
      where m.id = meal_id and m.user_id = (select auth.uid())
    ));
create policy "Users can delete from their own meal plan"
  on public.meal_plan for delete
  using ((select auth.uid()) = user_id and (select public.is_member()));

create policy "Users can read their own meal settings"
  on public.meal_settings for select
  using ((select auth.uid()) = user_id and (select public.is_member()));
create policy "Users can create their own meal settings"
  on public.meal_settings for insert
  with check ((select auth.uid()) = user_id and (select public.is_member()));
create policy "Users can update their own meal settings"
  on public.meal_settings for update
  using ((select auth.uid()) = user_id and (select public.is_member()))
  with check ((select auth.uid()) = user_id and (select public.is_member()));
