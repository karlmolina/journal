-- Food you add yourself on the Meals tab: things to buy that aren't from a
-- planned recipe, and what you have at home, with an optional use-by date so
-- food about to go off can be used first. Like the other meal tables, rows
-- belong to the meal space you're using (yours, or the one you joined).

create table public.kitchen_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default public.meal_owner() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 200),
  -- Free text like "2 lb" or "1 bag"; empty when it doesn't matter.
  amount text not null default '' check (length(amount) <= 100),
  aisle text not null default 'Other' check (length(aisle) <= 40),
  -- 'buy' = on the grocery list, 'home' = in the kitchen.
  place text not null default 'buy' check (place in ('buy', 'home')),
  use_by date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index kitchen_items_user_id_idx on public.kitchen_items (user_id);

alter table public.kitchen_items enable row level security;

create policy "Users can read their own kitchen items"
  on public.kitchen_items for select to authenticated
  using (user_id = (select public.meal_owner()) and (select public.is_member()));
create policy "Users can add their own kitchen items"
  on public.kitchen_items for insert to authenticated
  with check (user_id = (select public.meal_owner()) and (select public.is_member()));
create policy "Users can update their own kitchen items"
  on public.kitchen_items for update to authenticated
  using (user_id = (select public.meal_owner()) and (select public.is_member()))
  with check (user_id = (select public.meal_owner()) and (select public.is_member()));
create policy "Users can delete their own kitchen items"
  on public.kitchen_items for delete to authenticated
  using (user_id = (select public.meal_owner()) and (select public.is_member()));
