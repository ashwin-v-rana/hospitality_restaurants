-- The Ned — Booking System: schema (Cecconi's at The Ned London)
--
-- A Talkdesk Multi-Agent system queries these tables directly via the
-- Supabase `execute_sql` MCP tool. There is no backend/API layer yet.
--
-- Read access is granted to the anon role via permissive RLS SELECT policies
-- (mirroring the Crestline demo). Writes (book / cancel) are issued through the
-- MCP `execute_sql` tool, which runs with an elevated role and bypasses RLS, so
-- no INSERT/UPDATE/DELETE policies are defined.
--
-- Apply this once to a fresh Supabase project, then run seed.sql.
-- Tables are created in foreign-key dependency order.

create extension if not exists "pgcrypto";

-- ==========================================================================
-- 1. restaurants  (one row seeded: Cecconi's; schema supports more later)
-- ==========================================================================
create table public.restaurants (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique,
  name                  text not null,
  large_party_phone     text,
  slot_interval_minutes int  not null default 15,
  created_at            timestamptz default now()
);

-- ==========================================================================
-- 2. service_windows  (per-restaurant first/last seating per weekday)
--    One continuous window per weekday: open_time = first seating,
--    close_time = last (bookable) seating. seed.sql `_hours` is the single
--    source of truth for the actual hours; this table just mirrors them.
-- ==========================================================================
create table public.service_windows (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id),
  day_of_week   int  not null check (day_of_week between 0 and 6),  -- 0=Sun .. 6=Sat
  service_name  text not null default 'all_day'
                  check (service_name in ('lunch','dinner','all_day')),
  open_time     time not null,                                      -- first seating
  close_time    time not null                                       -- last (bookable) seating
);

create index idx_service_windows_restaurant on public.service_windows (restaurant_id, day_of_week);

-- ==========================================================================
-- 3. members  (the `cid` analog; auth is phone -> exists-in-list)
-- ==========================================================================
create table public.members (
  id            uuid primary key default gen_random_uuid(),
  member_number text not null unique,
  first_name    text not null,
  last_name     text not null,
  phone         text not null unique
                  check (phone ~ '^\+[1-9]\d{10,14}$'),
  email         text,
  created_at    timestamptz default now()
);

create index idx_members_phone on public.members (phone);

-- ==========================================================================
-- 4. time_slots  (the availability counter; one row per restaurant/date/time)
-- ==========================================================================
create table public.time_slots (
  id                 uuid primary key default gen_random_uuid(),
  restaurant_id      uuid not null references public.restaurants(id),
  slot_date          date not null,
  slot_time          time not null,
  capacity_total     int  not null,
  capacity_remaining int  not null check (capacity_remaining >= 0),
  unique (restaurant_id, slot_date, slot_time)
);

create index idx_time_slots_lookup on public.time_slots (restaurant_id, slot_date, slot_time);

-- ==========================================================================
-- 4b. Confirmation-code sequence + generator
--     MUST be created BEFORE `reservations` so the table DEFAULT below can
--     reference the function. Seed reservations draw 6-digit codes from this
--     sequence (CEC-100000, CEC-100001, ...). Starting at 100000 keeps them
--     disjoint from the live Booking Agent's random 4-digit codes
--     (CEC-0000..CEC-9999 via gen_confirmation_code), so a seeded code can
--     never collide with one the agent mints at runtime.
-- ==========================================================================
create sequence if not exists public.cecconis_conf_seq start with 100000;

create or replace function public.gen_cecconis_conf_code()
returns text
language sql
as $$
  select 'CEC-' || nextval('public.cecconis_conf_seq')::text;
$$;

-- ==========================================================================
-- 5. reservations  (make + cancel only; no modify/reschedule)
-- ==========================================================================
create table public.reservations (
  id                uuid primary key default gen_random_uuid(),
  confirmation_code text not null unique
                      default public.gen_cecconis_conf_code(),  -- seed: 'CEC-100000'+ ; speakable
  restaurant_id     uuid not null references public.restaurants(id),
  member_id         uuid not null references public.members(id),
  slot_date         date not null,
  slot_time         time not null,
  party_size        int  not null check (party_size between 1 and 6),  -- 7+ never writes
  turn_minutes      int  not null,                        -- derived; see turn_minutes()
  occasion          text,
  special_request   text,
  status            text not null default 'booked' check (status in ('booked','cancelled')),
  created_at        timestamptz default now(),
  cancelled_at      timestamptz
);

create index idx_reservations_member on public.reservations (member_id, status);

-- ==========================================================================
-- 6. auth_events  (mirror Crestline)
-- ==========================================================================
create table public.auth_events (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid references public.members(id),
  event_type text not null check (event_type in ('auth_success','auth_failed')),
  result     text not null check (result in ('success','failure')),
  created_at timestamptz default now()
);

create index idx_auth_events_member on public.auth_events (member_id);

-- ==========================================================================
-- Helper functions  (keep the agent's book/cancel SQL as clean one-liners)
-- ==========================================================================

-- Turn-time rule, single source of truth (also stated in the agent prompts):
--   <=2 -> 90, <=4 -> 120, 5+ -> 150.
create or replace function public.turn_minutes(p_party int)
returns int
language sql
immutable
as $$
  select case when p_party <= 2 then 90
              when p_party <= 4 then 120
              else 150 end;
$$;

-- Unique, speakable confirmation code: '<PREFIX>-NNNN' (4 digits), retry on
-- collision. Prefix is per-restaurant ('CEC' for Cecconi's).
create or replace function public.gen_confirmation_code(p_prefix text)
returns text
language plpgsql
as $$
declare
  v_code text;
begin
  loop
    v_code := p_prefix || '-' || lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (select 1 from public.reservations where confirmation_code = v_code);
  end loop;
  return v_code;
end;
$$;

-- ==========================================================================
-- Row Level Security  (anon read-only; writes via MCP bypass RLS)
-- ==========================================================================
alter table public.restaurants     enable row level security;
alter table public.service_windows enable row level security;
alter table public.members         enable row level security;
alter table public.time_slots      enable row level security;
alter table public.reservations    enable row level security;
alter table public.auth_events     enable row level security;

create policy anon_read_restaurants     on public.restaurants     for select to anon using (true);
create policy anon_read_service_windows on public.service_windows for select to anon using (true);
create policy anon_read_members         on public.members         for select to anon using (true);
create policy anon_read_time_slots      on public.time_slots      for select to anon using (true);
create policy anon_read_reservations    on public.reservations    for select to anon using (true);
create policy anon_read_auth_events     on public.auth_events     for select to anon using (true);
