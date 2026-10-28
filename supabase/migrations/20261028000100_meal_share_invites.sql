-- A meal share link from an admin also works as an invite, so the person it's
-- for can create an account and join the meals in one go. Links from other
-- members still need a normal invite, keeping invites with admins.
create or replace function public.redeem_invite_code(invite_code text)
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

  if not found and not exists (
    select 1
    from public.meal_share_codes c
    join public.members m on m.user_id = c.owner_id and m.is_admin
    where c.code = upper(trim(invite_code))
  ) then
    return false;
  end if;

  insert into public.members (user_id) values (uid);
  return true;
end;
$$;
