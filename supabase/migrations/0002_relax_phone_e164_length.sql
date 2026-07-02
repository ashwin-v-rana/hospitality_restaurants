-- 0002_relax_phone_e164_length.sql
--
-- Relax the members.phone E.164 length window so short national numbers
-- (e.g. Nordic 8-digit numbers behind a 2-digit country code) are accepted.
--
-- Old rule: ^\+[1-9]\d{10,14}$  → 11–15 total digits after the "+".
--   This rejected valid E.164 numbers such as Denmark (+45 ) and Norway (+47 ),
--   whose national number is only 8 digits (10 total).
-- New rule: ^\+[1-9]\d{6,14}$   → 7–15 total digits after the "+".
--   Still enforces the E.164 maximum of 15 digits, just lowers the minimum.
--
-- This must be changed in lockstep in three DB places (CHECK constraint,
-- create_member, update_member) and the client constant lib/constants.ts.

-- 1) CHECK constraint on members.phone -------------------------------------
alter table public.members drop constraint if exists members_phone_check;
alter table public.members
  add constraint members_phone_check
  check (phone ~ '^\+[1-9]\d{6,14}$');

-- 2) create_member: relax the E.164 guard ----------------------------------
create or replace function public.create_member(
  p_first_name text,
  p_last_name  text,
  p_phone      text,
  p_email      text default null
) returns public.members
language plpgsql security definer set search_path = public as $function$
declare v_row public.members; v_number text;
begin
  p_first_name := nullif(btrim(p_first_name), '');
  p_last_name  := nullif(btrim(p_last_name), '');
  p_phone      := nullif(btrim(p_phone), '');
  p_email      := nullif(btrim(p_email), '');

  if p_first_name is null or p_last_name is null then
    raise exception 'first and last name are required' using errcode = '23514';
  end if;
  if p_phone is null or p_phone !~ '^\+[1-9]\d{6,14}$' then
    raise exception 'phone must be E.164 (e.g. +442079460123)' using errcode = '23514';
  end if;

  for i in 1..3 loop
    begin
      v_number := public.gen_ned_member_number();
      insert into public.members (member_number, first_name, last_name, phone, email)
      values (v_number, p_first_name, p_last_name, p_phone, p_email)
      returning * into v_row;
      return v_row;
    exception
      when unique_violation then
        if position('phone' in coalesce(sqlerrm, '')) > 0 then
          raise exception 'a member with phone % already exists', p_phone using errcode = '23505';
        end if;
    end;
  end loop;
  raise exception 'could not allocate a member number, please retry';
end;
$function$;

-- 3) update_member: relax the E.164 guard ----------------------------------
create or replace function public.update_member(
  p_member_id  uuid,
  p_first_name text,
  p_last_name  text,
  p_phone      text,
  p_email      text default null
) returns public.members
language plpgsql security definer set search_path = public as $function$
declare v_row public.members;
begin
  p_first_name := nullif(btrim(p_first_name), '');
  p_last_name  := nullif(btrim(p_last_name), '');
  p_phone      := nullif(btrim(p_phone), '');
  p_email      := nullif(btrim(p_email), '');

  if p_first_name is null or p_last_name is null then
    raise exception 'first and last name are required' using errcode = '23514';
  end if;
  if p_phone is null or p_phone !~ '^\+[1-9]\d{6,14}$' then
    raise exception 'phone must be E.164 (e.g. +442079460123)' using errcode = '23514';
  end if;

  begin
    update public.members
       set first_name = p_first_name, last_name = p_last_name,
           phone = p_phone, email = p_email
     where id = p_member_id
    returning * into v_row;
  exception
    when unique_violation then
      raise exception 'a member with phone % already exists', p_phone using errcode = '23505';
  end;

  if v_row.id is null then
    raise exception 'member not found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$function$;
