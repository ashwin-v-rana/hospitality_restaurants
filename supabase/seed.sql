-- The Ned — Booking System: seed data (Cecconi's at The Ned London)
--
-- Idempotent: truncates the demo tables and regenerates everything. Safe to
-- re-run any time to refresh the rolling 14-day availability window.
--
-- SERVICE HOURS are defined ONCE below in the `_hours` table (the single
-- source of truth). time_slots are generated ONLY within those windows.
-- These same hours are mirrored verbatim in the Booking Agent prompt's
-- opening-hours guard and in README.md — if you change hours, change them in
-- ALL THREE places.
--
-- All numbers/names below are fictional. Phones use the Ofcom reserved
-- fictional ranges (mobiles +447700900000-999, London landline 020 7946 0xxx)
-- so nothing real is ever dialed or texted. Emails use a fake domain.
--
-- Apply 0001_init.sql first, then run this.

do $$
declare
  -- ======================= KNOBS (tweak these) ==========================
  c_restaurant_id  uuid := 'cec0cec0-0000-4000-8000-000000000001';  -- HARDCODE THIS into the agent prompts
  c_anchor         date := current_date;   -- "today"; slots span anchor .. anchor + (c_days-1)
  c_days           int  := 14;             -- size of the rolling availability window
  c_slot_min       int  := 15;             -- bookable increment (minutes)
  c_cap_min        int  := 4;              -- min covers per slot (random)
  c_cap_max        int  := 12;             -- max covers per slot (random)
  c_zero_slots     int  := 8;              -- # of slots to fully book out (demo "no availability")
  c_num_reserv     int  := 8;              -- # of single existing reservations (plus 2 for the double-booker)
  c_large_party_ph text := '+442079460123';                          -- Ofcom London fictional range, 7+ parties
  -- ======================================================================

  v_first_member uuid;     -- the "double-booker": two upcoming reservations (disambiguation branch)
  v_dbl_codes    text[] := '{}';   -- captures the double-booker's two generated codes (for the demo/README)
  v_code         text;
  v_slot         record;
  v_member       uuid;
  v_party        int;
  i              int;
begin
  -- ===================== SERVICE HOURS (single source of truth) =========
  -- One continuous window per weekday. last_seating IS a bookable slot
  -- (generation is inclusive of it). dow: 0=Sun .. 6=Sat.
  --
  --   Monday        first 12:00  last 22:30
  --   Tuesday       first 07:00  last 22:30
  --   Wednesday     first 07:00  last 22:30
  --   Thursday      first 07:00  last 22:30
  --   Friday        first 12:00  last 22:30
  --   Saturday      first 12:00  last 22:30
  --   Sunday        first 12:00  last 21:30
  drop table if exists _hours;
  create temporary table _hours (
    dow           int  primary key,   -- 0=Sun .. 6=Sat
    first_seating time not null,
    last_seating  time not null
  ) on commit drop;
  insert into _hours (dow, first_seating, last_seating) values
    (1, time '12:00', time '22:30'),   -- Monday
    (2, time '07:00', time '22:30'),   -- Tuesday
    (3, time '07:00', time '22:30'),   -- Wednesday
    (4, time '07:00', time '22:30'),   -- Thursday
    (5, time '12:00', time '22:30'),   -- Friday
    (6, time '12:00', time '22:30'),   -- Saturday
    (0, time '12:00', time '21:30');   -- Sunday

  -- Wipe (FK-safe) and reset.
  truncate public.auth_events, public.reservations, public.time_slots,
           public.service_windows, public.members, public.restaurants
    restart identity cascade;

  -- Restart the confirmation-code sequence so a re-seed produces deterministic
  -- codes (double-booker is inserted first -> always CEC-100000 / CEC-100001).
  alter sequence public.cecconis_conf_seq restart with 100000;

  -- ----- restaurant (one row; fixed UUID so prompts/README can hardcode) -----
  insert into public.restaurants (id, slug, name, large_party_phone, slot_interval_minutes)
  values (c_restaurant_id, 'cecconis', 'Cecconi''s at The Ned London', c_large_party_ph, c_slot_min);

  -- ----- service_windows: mirror `_hours` (one all-day window per weekday) -----
  insert into public.service_windows (restaurant_id, day_of_week, service_name, open_time, close_time)
  select c_restaurant_id, h.dow, 'all_day', h.first_seating, h.last_seating
  from _hours h;

  -- ----- members (London-local names, Ofcom fictional mobiles) -----
  insert into public.members (member_number, first_name, last_name, phone, email) values
    ('NED-100482','Olivia','Whitfield','+447700900112','olivia.whitfield@member.thened-demo.com'),
    ('NED-100485','James','Okafor','+447700900145','james.okafor@member.thened-demo.com'),
    ('NED-100488','Priya','Nair','+447700900167','priya.nair@member.thened-demo.com'),
    ('NED-100491','Thomas','Ashworth','+447700900189','thomas.ashworth@member.thened-demo.com'),
    ('NED-100494','Sofia','Marchetti','+447700900201','sofia.marchetti@member.thened-demo.com'),
    ('NED-100497','Daniel','Fitzgerald','+447700900223','daniel.fitzgerald@member.thened-demo.com'),
    ('NED-100500','Amara','Bello','+447700900245','amara.bello@member.thened-demo.com'),
    ('NED-100503','Henry','Sinclair','+447700900267','henry.sinclair@member.thened-demo.com'),
    ('NED-100506','Mei Lin','Chow','+447700900289','meilin.chow@member.thened-demo.com'),
    ('NED-100509','Oliver','Bennett','+447700900301','oliver.bennett@member.thened-demo.com'),
    ('NED-100512','Charlotte','Hughes','+447700900323','charlotte.hughes@member.thened-demo.com'),
    ('NED-100515','Raj','Patel','+447700900345','raj.patel@member.thened-demo.com'),
    ('NED-100518','Emily','Thornton','+447700900367','emily.thornton@member.thened-demo.com'),
    ('NED-100521','Lucas','Romano','+447700900389','lucas.romano@member.thened-demo.com'),
    ('NED-100524','Grace','Adeyemi','+447700900401','grace.adeyemi@member.thened-demo.com'),
    ('NED-100527','William','Hartley','+447700900423','william.hartley@member.thened-demo.com'),
    ('NED-100530','Isabella','Ferreira','+447700900445','isabella.ferreira@member.thened-demo.com'),
    ('NED-100533','Samuel','Greenwood','+447700900467','samuel.greenwood@member.thened-demo.com');

  -- ----- time_slots: for each of the next c_days days, generate 15-min slots -----
  -- from that weekday's first_seating through last_seating INCLUSIVE. Slots are
  -- generated ONLY within `_hours`, so nothing exists outside the windows
  -- (no 23:00 slot, no Sunday 22:00 slot, no Monday 11:00 slot).
  insert into public.time_slots (restaurant_id, slot_date, slot_time, capacity_total, capacity_remaining)
  select c_restaurant_id, g_day.d::date, g_slot.ts::time, cap.c, cap.c
  from generate_series(c_anchor::timestamp, (c_anchor + (c_days - 1))::timestamp, interval '1 day') as g_day(d)
  join _hours h
    on h.dow = extract(dow from g_day.d)::int
  cross join lateral generate_series(
    (g_day.d::date + h.first_seating)::timestamp,
    (g_day.d::date + h.last_seating)::timestamp,
    make_interval(mins => c_slot_min)
  ) as g_slot(ts)
  cross join lateral (
    select (c_cap_min + floor(random() * (c_cap_max - c_cap_min + 1)))::int as c
  ) cap;

  -- ----- zero out a handful of slots (demo: "fully booked -> suggest nearby") -----
  update public.time_slots
  set capacity_remaining = 0
  where id in (
    select id from public.time_slots
    where restaurant_id = c_restaurant_id
    order by random()
    limit c_zero_slots
  );

  -- ----- existing reservations -----
  -- The double-booker, picked by member_number for a stable identity.
  select id into v_first_member from public.members where member_number = 'NED-100482';

  -- Two upcoming reservations for the double-booker. Confirmation codes come
  -- from the sequence DEFAULT (never hardcoded) -> CEC-100000, CEC-100001.
  for v_slot in (
    select id, slot_date, slot_time
    from public.time_slots
    where restaurant_id = c_restaurant_id and capacity_remaining > 0 and slot_date >= c_anchor
    order by random()
    limit 2
  ) loop
    v_party := 2 + floor(random() * 5)::int;  -- 2..6
    insert into public.reservations (restaurant_id, member_id,
                                     slot_date, slot_time, party_size, turn_minutes, status)
    values (c_restaurant_id, v_first_member, v_slot.slot_date, v_slot.slot_time,
            v_party, public.turn_minutes(v_party), 'booked')
    returning confirmation_code into v_code;
    v_dbl_codes := array_append(v_dbl_codes, v_code);
    update public.time_slots set capacity_remaining = capacity_remaining - 1 where id = v_slot.id;
  end loop;

  -- A spread of single reservations across other members. Codes also come from
  -- the sequence DEFAULT.
  for i in 1..c_num_reserv loop
    select id, slot_date, slot_time into v_slot
    from public.time_slots
    where restaurant_id = c_restaurant_id and capacity_remaining > 0 and slot_date >= c_anchor
    order by random()
    limit 1;

    select id into v_member
    from public.members
    where id <> v_first_member
    order by random()
    limit 1;

    v_party := 2 + floor(random() * 5)::int;  -- 2..6
    insert into public.reservations (restaurant_id, member_id,
                                     slot_date, slot_time, party_size, turn_minutes, status)
    values (c_restaurant_id, v_member,
            v_slot.slot_date, v_slot.slot_time, v_party, public.turn_minutes(v_party), 'booked');
    update public.time_slots set capacity_remaining = capacity_remaining - 1 where id = v_slot.id;
  end loop;

  raise notice 'Double-booker (Olivia Whitfield / NED-100482) confirmation codes: %',
    array_to_string(v_dbl_codes, ', ');
end $$;
