-- Invite-only accounts. Google sign-in still creates an auth user, but nothing
-- in the app works until that user redeems an invite code an admin generated
-- and becomes a member. Everyone who already has an account is a member.

create table public.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  is_admin boolean not null default false,
  joined_at timestamptz not null default now()
);

alter table public.members enable row level security;

create policy "Users can read their own membership"
  on public.members for select
  using ((select auth.uid()) = user_id);

insert into public.members (user_id)
select id from auth.users;

update public.members
set is_admin = true
where user_id in (select id from auth.users where email = 'karlgmolina@gmail.com');

create function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.members where user_id = auth.uid());
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members where user_id = auth.uid() and is_admin
  );
$$;

-- Only members can use their entries.
alter policy "Users can read their own entries"
  on public.entries
  using ((select auth.uid()) = user_id and (select public.is_member()));

alter policy "Users can create their own entries"
  on public.entries
  with check ((select auth.uid()) = user_id and (select public.is_member()));

alter policy "Users can update their own entries"
  on public.entries
  using ((select auth.uid()) = user_id and (select public.is_member()))
  with check ((select auth.uid()) = user_id and (select public.is_member()));

alter policy "Users can delete their own entries"
  on public.entries
  using ((select auth.uid()) = user_id and (select public.is_member()));

-- Codes are only read and written through the functions below.
create table public.invite_codes (
  code text primary key,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz
);

alter table public.invite_codes enable row level security;

create function public.create_invite_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  -- No 0/O or 1/I/L, so codes survive being read aloud or retyped.
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  new_code text;
begin
  if not public.is_admin() then
    raise exception 'Only admins can create invite codes'
      using errcode = '42501';
  end if;

  loop
    select string_agg(
      substr(alphabet, 1 + get_byte(extensions.gen_random_bytes(1), 0) % length(alphabet), 1),
      ''
    )
    into new_code
    from generate_series(1, 8);

    begin
      insert into public.invite_codes (code, created_by)
      values (new_code, auth.uid());
      return new_code;
    exception when unique_violation then
      -- Try another code.
    end;
  end loop;
end;
$$;

create function public.list_invite_codes()
returns table (
  code text,
  created_at timestamptz,
  used_at timestamptz,
  used_by_email text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can list invite codes'
      using errcode = '42501';
  end if;

  return query
  select c.code, c.created_at, c.used_at, u.email::text
  from public.invite_codes c
  left join auth.users u on u.id = c.used_by
  order by c.created_at desc;
end;
$$;

-- Only unused codes can be revoked, so the record of who joined stays.
create function public.revoke_invite_code(invite_code text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can revoke invite codes'
      using errcode = '42501';
  end if;

  delete from public.invite_codes where code = invite_code and used_by is null;
end;
$$;

create function public.redeem_invite_code(invite_code text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  if public.is_member() then
    return true;
  end if;

  update public.invite_codes
  set used_by = uid, used_at = now()
  where code = upper(trim(invite_code)) and used_by is null and used_at is null;

  if not found then
    return false;
  end if;

  insert into public.members (user_id) values (uid);
  return true;
end;
$$;

-- Lets someone without an invite back out without leaving an account behind.
create function public.delete_uninvited_account()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_member() then
    delete from auth.users where id = auth.uid();
  end if;
end;
$$;

revoke execute on function
  public.is_member(),
  public.is_admin(),
  public.create_invite_code(),
  public.list_invite_codes(),
  public.revoke_invite_code(text),
  public.redeem_invite_code(text),
  public.delete_uninvited_account()
from public, anon;

grant execute on function
  public.is_member(),
  public.is_admin(),
  public.create_invite_code(),
  public.list_invite_codes(),
  public.revoke_invite_code(text),
  public.redeem_invite_code(text),
  public.delete_uninvited_account()
to authenticated;
