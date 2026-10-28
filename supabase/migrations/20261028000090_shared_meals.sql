-- Sharing the Meals tab: someone can join another member's meals through a
-- link, and from then on both see and edit the same library, plan, grocery
-- list and settings. Each person has one meal space at a time, kept under its
-- owner's user_id; joining someone else's hides your own meals until you
-- leave. The owner can't also be in someone else's space, so it's never more
-- than one hop.

-- Who has joined whose meals. One row per person who joined.
create table public.meal_shares (
  member_id uuid primary key references auth.users (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (member_id <> owner_id)
);

create index meal_shares_owner_id_idx on public.meal_shares (owner_id);

-- The link that lets people join an owner's meals; one per owner, replaced
-- when the owner makes a new one. Read and written through the functions
-- below.
create table public.meal_share_codes (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

alter table public.meal_shares enable row level security;
alter table public.meal_share_codes enable row level security;

-- Either side can end a share: the person who joined leaves, or the owner
-- removes them. Joining only happens through join_meal_share.
create policy "People in a share can see it"
  on public.meal_shares for select
  using (((select auth.uid()) = member_id or (select auth.uid()) = owner_id)
    and (select public.is_member()));
create policy "People in a share can end it"
  on public.meal_shares for delete
  using (((select auth.uid()) = member_id or (select auth.uid()) = owner_id)
    and (select public.is_member()));

-- Whose meals you're using: the owner of the space you joined, or yourself.
create function public.meal_owner()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select owner_id from public.meal_shares where member_id = auth.uid()),
    auth.uid()
  );
$$;

-- New rows land in the space you're using.
alter table public.meals alter column user_id set default public.meal_owner();
alter table public.meal_plan alter column user_id set default public.meal_owner();
alter table public.meal_settings alter column user_id set default public.meal_owner();

alter policy "Users can read their own meals"
  on public.meals
  using (user_id = (select public.meal_owner()) and (select public.is_member()));
alter policy "Users can add their own meals"
  on public.meals
  with check (user_id = (select public.meal_owner()) and (select public.is_member()));
alter policy "Users can update their own meals"
  on public.meals
  using (user_id = (select public.meal_owner()) and (select public.is_member()))
  with check (user_id = (select public.meal_owner()) and (select public.is_member()));
alter policy "Users can delete their own meals"
  on public.meals
  using (user_id = (select public.meal_owner()) and (select public.is_member()));

alter policy "Users can read their own meal plan"
  on public.meal_plan
  using (user_id = (select public.meal_owner()) and (select public.is_member()));
alter policy "Users can add to their own meal plan"
  on public.meal_plan
  with check (user_id = (select public.meal_owner()) and (select public.is_member())
    and exists (
      select 1 from public.meals m
      where m.id = meal_id and m.user_id = (select public.meal_owner())
    ));
alter policy "Users can update their own meal plan"
  on public.meal_plan
  using (user_id = (select public.meal_owner()) and (select public.is_member()))
  with check (user_id = (select public.meal_owner()) and (select public.is_member())
    and exists (
      select 1 from public.meals m
      where m.id = meal_id and m.user_id = (select public.meal_owner())
    ));
alter policy "Users can delete from their own meal plan"
  on public.meal_plan
  using (user_id = (select public.meal_owner()) and (select public.is_member()));

alter policy "Users can read their own meal settings"
  on public.meal_settings
  using (user_id = (select public.meal_owner()) and (select public.is_member()));
alter policy "Users can create their own meal settings"
  on public.meal_settings
  with check (user_id = (select public.meal_owner()) and (select public.is_member()));
alter policy "Users can update their own meal settings"
  on public.meal_settings
  using (user_id = (select public.meal_owner()) and (select public.is_member()))
  with check (user_id = (select public.meal_owner()) and (select public.is_member()));

-- Everything the Share page shows: who owns the space you're in, and when it's
-- yours, its link and who has joined.
create function public.get_meal_share()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  owner uuid;
begin
  if not public.is_member() then
    raise exception 'Members only' using errcode = '42501';
  end if;

  select s.owner_id into owner from public.meal_shares s where s.member_id = uid;
  if owner is not null then
    return jsonb_build_object(
      'owner_email', (select u.email from auth.users u where u.id = owner),
      'code', null,
      'members', '[]'::jsonb
    );
  end if;

  return jsonb_build_object(
    'owner_email', null,
    'code', (select c.code from public.meal_share_codes c where c.owner_id = uid),
    'members', coalesce((
      select jsonb_agg(
        jsonb_build_object('user_id', s.member_id, 'email', u.email)
        order by s.created_at
      )
      from public.meal_shares s
      join auth.users u on u.id = s.member_id
      where s.owner_id = uid
    ), '[]'::jsonb)
  );
end;
$$;

-- A new link to your meals; the old one stops working.
create function public.create_meal_share_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  -- Same alphabet as invite codes, so links survive being retyped.
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  new_code text;
begin
  if not public.is_member() then
    raise exception 'Members only' using errcode = '42501';
  end if;
  if exists (select 1 from public.meal_shares where member_id = uid) then
    raise exception 'Leave the meals you joined before sharing your own'
      using errcode = 'P0001';
  end if;

  loop
    select string_agg(
      substr(alphabet, 1 + get_byte(extensions.gen_random_bytes(1), 0) % length(alphabet), 1),
      ''
    )
    into new_code
    from generate_series(1, 10);

    begin
      insert into public.meal_share_codes (owner_id, code)
      values (uid, new_code)
      on conflict (owner_id) do update
        set code = excluded.code, created_at = now();
      return new_code;
    exception when unique_violation then
      -- Try another code.
    end;
  end loop;
end;
$$;

-- Whose meals a link is for, so the join screen can say. Null when the link
-- doesn't work.
create function public.meal_share_owner_email(share_code text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.email::text
  from public.meal_share_codes c
  join auth.users u on u.id = c.owner_id
  where public.is_member() and c.code = upper(trim(share_code));
$$;

-- Joins the meals a link is for, switching from any you joined before. With
-- bring_recipes, a copy of your own library goes along (your originals stay
-- put for when you leave). Returns false when the link doesn't work.
create function public.join_meal_share(share_code text, bring_recipes boolean default false)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  owner uuid;
begin
  if not public.is_member() then
    raise exception 'Members only' using errcode = '42501';
  end if;

  select c.owner_id into owner
  from public.meal_share_codes c
  where c.code = upper(trim(share_code));
  if owner is null then
    return false;
  end if;
  if owner = uid then
    raise exception 'That''s your own link' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.meal_shares where owner_id = uid) then
    raise exception 'Others have joined your meals; remove them before joining someone else'
      using errcode = 'P0001';
  end if;

  insert into public.meal_shares (member_id, owner_id)
  values (uid, owner)
  on conflict (member_id) do update
    set owner_id = excluded.owner_id, created_at = now();

  if bring_recipes then
    insert into public.meals
      (user_id, name, servings, total_minutes, ingredients, steps, source_url)
    select owner, m.name, m.servings, m.total_minutes, m.ingredients, m.steps, m.source_url
    from public.meals m
    where m.user_id = uid
      -- Skip ones the shared library already has by name.
      and not exists (
        select 1 from public.meals o
        where o.user_id = owner and lower(trim(o.name)) = lower(trim(m.name))
      );
  end if;

  return true;
end;
$$;

revoke execute on function public.meal_owner() from public, anon;
revoke execute on function public.get_meal_share() from public, anon;
revoke execute on function public.create_meal_share_code() from public, anon;
revoke execute on function public.meal_share_owner_email(text) from public, anon;
revoke execute on function public.join_meal_share(text, boolean) from public, anon;
grant execute on function public.meal_owner() to authenticated;
grant execute on function public.get_meal_share() to authenticated;
grant execute on function public.create_meal_share_code() to authenticated;
grant execute on function public.meal_share_owner_email(text) to authenticated;
grant execute on function public.join_meal_share(text, boolean) to authenticated;
