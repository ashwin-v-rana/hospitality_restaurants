-- 0003_generate_time_slots_rpc.sql
--
-- Admin slot generator: an atomic, idempotent way to open bookable
-- availability from the console (see /admin/slots) instead of hand-running SQL.
--
-- generate_time_slots steps the restaurant's slot_interval_minutes grid within
-- each weekday's service_windows and inserts time_slots for the requested date
-- range. It inserts with ON CONFLICT DO NOTHING, so it only *adds* missing
-- slots — existing slots (and any bookings against them) are never touched,
-- reset, or oversold. Returns the number of slots actually inserted.
--
-- Locked-down model (CLAUDE.md §5): SECURITY DEFINER, EXECUTE granted to
-- service_role only. The console calls it via the service-role client and
-- re-checks admin + restaurant scope in app code (app/(app)/admin/slots).

create or replace function public.generate_time_slots(
  p_restaurant_id uuid,
  p_start_date    date,
  p_end_date      date,
  p_capacity      int default 5
) returns int
language plpgsql security definer set search_path = public as $$
declare v_interval int; v_inserted int;
begin
  if p_end_date < p_start_date then
    raise exception 'end date must be on or after start date' using errcode = '22007';
  end if;
  if p_end_date - p_start_date > 92 then
    raise exception 'date range too large (max 92 days)' using errcode = '22003';
  end if;
  if p_capacity < 1 or p_capacity > 50 then
    raise exception 'capacity must be between 1 and 50' using errcode = '23514';
  end if;

  select slot_interval_minutes into v_interval
    from public.restaurants where id = p_restaurant_id;
  if v_interval is null then
    raise exception 'restaurant not found' using errcode = 'P0002';
  end if;

  with slots as (
    select distinct g_day.d::date as slot_date, g_slot.ts::time as slot_time
    from generate_series(p_start_date, p_end_date, interval '1 day') g_day(d)
    join public.service_windows sw
      on sw.restaurant_id = p_restaurant_id
     and sw.day_of_week = extract(dow from g_day.d)::int
    cross join lateral generate_series(
      (g_day.d::date + sw.open_time)::timestamp,
      (g_day.d::date + sw.close_time)::timestamp,
      make_interval(mins => v_interval)
    ) g_slot(ts)
  ), ins as (
    insert into public.time_slots
      (restaurant_id, slot_date, slot_time, capacity_total, capacity_remaining)
    select p_restaurant_id, slot_date, slot_time, p_capacity, p_capacity
    from slots
    on conflict (restaurant_id, slot_date, slot_time) do nothing
    returning 1
  )
  select count(*) into v_inserted from ins;

  return v_inserted;
end;
$$;

revoke all on function public.generate_time_slots(uuid,date,date,int) from public;
revoke all on function public.generate_time_slots(uuid,date,date,int) from anon;
revoke all on function public.generate_time_slots(uuid,date,date,int) from authenticated;
grant execute on function public.generate_time_slots(uuid,date,date,int) to service_role;
