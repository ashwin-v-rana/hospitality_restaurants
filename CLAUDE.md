# CLAUDE.md — The Ned Reservations Console

A staff-facing web app (an OpenTable-style host console) for checking table
availability and managing reservations across one or more restaurants. Human
**agents** (hosts / managers) log in, see only the restaurants they're assigned
to, check availability for a date + party size, and create or cancel bookings.

This console is the **human counterpart to an existing CXA AI agent**
("The_Ned_Restaurants" / Cecconi Concierge). Both surfaces read and write the
**same Supabase tables**, so they must obey identical business rules and the same
atomic booking pattern. Treat the AI agent's behaviour as the contract this
console has to stay consistent with.

---

## 1. Tech stack (locked decisions — do not substitute)

- **Next.js** (App Router) + **TypeScript**
- **Supabase** for Postgres, Auth (email/password), and RLS
- **@supabase/supabase-js** + **@supabase/ssr** (cookie-based sessions; do NOT
  use the deprecated auth-helpers)
- **Tailwind CSS** + **shadcn/ui** for a clean, demo-grade host console
- **Vercel** for deployment

The browser only ever uses the **anon** key under RLS. The **service-role key is
never shipped to the client** and is not required by the app at runtime — every
write goes through a `SECURITY DEFINER` RPC.

---

## 2. Supabase project

- **Project ref:** `ehsvhlaatnxzhvfzxpnj`
- **URL:** `https://ehsvhlaatnxzhvfzxpnj.supabase.co`
- Apply DDL with migrations (the Supabase MCP `apply_migration`, or
  `supabase migration` CLI). Don't hand-edit tables in the dashboard for
  anything that needs to be reproducible.

---

## 3. Verified schema (already exists — do not recreate these tables)

All in schema `public`. RLS is enabled on every table.

### restaurants
| column | type | notes |
|---|---|---|
| id | uuid PK | `gen_random_uuid()` |
| slug | text UNIQUE | e.g. `cecconis` |
| name | text | display name |
| large_party_phone | text, nullable | parties ≥ 7 are phoned, not booked |
| slot_interval_minutes | int | default 15 |
| created_at | timestamptz | |

### service_windows
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| restaurant_id | uuid FK → restaurants.id | |
| day_of_week | int (0–6) | **Postgres `dow`: 0 = Sunday … 6 = Saturday** |
| service_name | text | `lunch` \| `dinner` \| `all_day` (default `all_day`) |
| open_time | time | first seating |
| close_time | time | last seating |

### members
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| member_number | text UNIQUE | e.g. `NED-100482` (display only) |
| first_name / last_name | text | |
| phone | text UNIQUE | **CHECK `^\+[1-9]\d{10,14}$` (E.164)** |
| email | text, nullable | |
| created_at | timestamptz | |

### time_slots
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| restaurant_id | uuid FK | |
| slot_date | date | |
| slot_time | time | aligned to 15-min boundaries |
| capacity_total | int | |
| capacity_remaining | int | **CHECK ≥ 0**; bookable only when `> 0` |

### reservations
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| confirmation_code | text UNIQUE | **auto via `gen_cecconis_conf_code()` — never set it; read it back with RETURNING** |
| restaurant_id | uuid FK | |
| member_id | uuid FK → members.id | the member's UUID, never the `NED-` number |
| slot_date / slot_time | date / time | |
| party_size | int | **CHECK 1–6** |
| turn_minutes | int | derived from party_size (see §6) |
| occasion / special_request | text, nullable | |
| status | text | `booked` \| `cancelled` (default `booked`) |
| created_at | timestamptz | |
| cancelled_at | timestamptz, nullable | set when cancelled |

### auth_events
OTP/auth telemetry for the AI agent (`event_type` `auth_success|auth_failed`,
`result` `success|failure`). **The console does not write here.** Leave it alone.

---

## 4. Live data snapshot & the demo-date caveat

- 1 restaurant: **Cecconi's at The Ned London**, id
  `cec0cec0-0000-4000-8000-000000000001`, slug `cecconis`,
  large_party_phone `+442079460123`.
- 27 members, 714 time_slots, 12 reservations (11 booked / 1 cancelled), 7
  service windows.
- **⚠️ Seeded slots run `2026-06-09` → `2026-06-22`, which is in the past.** The
  availability screen will look empty for "today/future". Before any live demo,
  roll the slot window (and matching reservations) forward by the same delta so
  the data stays internally consistent. Optional prep migration:

  ```sql
  -- Shift slots + reservations so the latest slot_date lands ~2 weeks out.
  -- Run as ONE migration so slots and their reservations stay aligned.
  do $$
  declare v_delta int;
  begin
    select (current_date + 13) - max(slot_date) into v_delta from public.time_slots;
    update public.time_slots  set slot_date = slot_date + v_delta;
    update public.reservations set slot_date = slot_date + v_delta;
  end $$;
  ```

The schema is multi-restaurant ready even though only Cecconi's is seeded. Build
the UI around a **restaurant switcher**, never a hardcoded restaurant.

---

## 5. Security model — what to build

**Current state:** RLS on; only `anon_read_*` SELECT policies exist (anon reads
everything, nothing writes from the browser). No staff auth, no agent→restaurant
map, no write policies.

**Target:** agents authenticate via Supabase Auth; reads are scoped to the
agent's assigned restaurants; writes happen only through `SECURITY DEFINER` RPCs
that re-check access server-side and perform atomic capacity changes.

Apply this as a migration (`agents_auth_and_booking_rpcs`):

```sql
-- 5.1  Staff (agent) profile + restaurant access map -----------------------
create table if not exists public.agents (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  full_name  text,
  role       text not null default 'host' check (role in ('host','manager','admin')),
  created_at timestamptz default now()
);

create table if not exists public.agent_restaurants (
  agent_id      uuid not null references public.agents(id)      on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  primary key (agent_id, restaurant_id)
);

alter table public.agents            enable row level security;
alter table public.agent_restaurants enable row level security;

-- 5.2  Access helper (used by every scoped policy and RPC) -----------------
create or replace function public.agent_has_restaurant(p_restaurant_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.agent_restaurants
    where agent_id = auth.uid() and restaurant_id = p_restaurant_id
  );
$$;

-- 5.3  RLS for the authenticated (logged-in agent) role --------------------
create policy agent_self_read   on public.agents
  for select to authenticated using (id = auth.uid());
create policy agent_links_read  on public.agent_restaurants
  for select to authenticated using (agent_id = auth.uid());

create policy auth_read_restaurants on public.restaurants
  for select to authenticated using (public.agent_has_restaurant(id));
create policy auth_read_service_windows on public.service_windows
  for select to authenticated using (public.agent_has_restaurant(restaurant_id));
create policy auth_read_time_slots on public.time_slots
  for select to authenticated using (public.agent_has_restaurant(restaurant_id));
create policy auth_read_reservations on public.reservations
  for select to authenticated using (public.agent_has_restaurant(restaurant_id));
-- Members must be searchable to attach a booking. Keep this read-only.
create policy auth_read_members on public.members
  for select to authenticated using (true);

-- 5.4  Atomic booking write (mirrors the AI agent's CTE) -------------------
create or replace function public.create_reservation(
  p_restaurant_id  uuid,
  p_member_id      uuid,
  p_slot_date      date,
  p_slot_time      time,
  p_party_size     int,
  p_occasion       text default null,
  p_special_request text default null
) returns table (confirmation_code text, reservation_id uuid)
language plpgsql security definer set search_path = public as $$
declare v_turn int;
begin
  if not public.agent_has_restaurant(p_restaurant_id) then
    raise exception 'not authorized for restaurant %', p_restaurant_id using errcode = '42501';
  end if;
  if p_party_size < 1 or p_party_size > 6 then
    raise exception 'party_size must be 1..6 (parties of 7+ are phone-only)' using errcode = '23514';
  end if;

  v_turn := case when p_party_size <= 2 then 90
                 when p_party_size <= 4 then 120
                 else 150 end;

  -- Decrement the slot and insert the reservation in one statement so a full
  -- slot can never be oversold. Returns 0 rows if the slot just filled.
  return query
  with booked as (
    update public.time_slots
       set capacity_remaining = capacity_remaining - 1
     where restaurant_id = p_restaurant_id
       and slot_date = p_slot_date
       and slot_time = p_slot_time
       and capacity_remaining > 0
    returning id
  )
  insert into public.reservations
    (restaurant_id, member_id, slot_date, slot_time, party_size,
     turn_minutes, occasion, special_request, status)
  select p_restaurant_id, p_member_id, p_slot_date, p_slot_time, p_party_size,
         v_turn, p_occasion, p_special_request, 'booked'
  from booked
  returning reservations.confirmation_code, reservations.id;
end;
$$;

-- 5.5  Cancel + return the seat to inventory -------------------------------
create or replace function public.cancel_reservation(p_reservation_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_rest uuid; v_status text; v_date date; v_time time;
begin
  select restaurant_id, status, slot_date, slot_time
    into v_rest, v_status, v_date, v_time
    from public.reservations where id = p_reservation_id;

  if v_rest is null then raise exception 'reservation not found' using errcode = 'P0002'; end if;
  if not public.agent_has_restaurant(v_rest) then raise exception 'not authorized' using errcode = '42501'; end if;
  if v_status = 'cancelled' then return false; end if;  -- avoid double credit

  update public.reservations
     set status = 'cancelled', cancelled_at = now()
   where id = p_reservation_id;
  update public.time_slots
     set capacity_remaining = capacity_remaining + 1
   where restaurant_id = v_rest and slot_date = v_date and slot_time = v_time;
  return true;
end;
$$;

grant execute on function public.agent_has_restaurant(uuid) to authenticated;
grant execute on function public.create_reservation(uuid,uuid,date,time,int,text,text) to authenticated;
grant execute on function public.cancel_reservation(uuid) to authenticated;
```

**Why RPCs for writes:** they keep the service-role key out of the browser,
re-check the agent's restaurant access server-side, and do the slot decrement +
insert atomically — the same guarantee the AI Booking Agent relies on. The
console therefore needs **no INSERT/UPDATE RLS policies** on `time_slots` or
`reservations`.

**Optional hardening (ask the user first):** the legacy `anon_read_*` policies
let the public anon key read all data. If no other demo surface depends on
anon reads, drop them so authenticated, restaurant-scoped access is the only
read path. The CXA AI agent uses the service role (`execute_sql`), not anon, so
dropping anon reads should not affect it — but confirm before removing.

---

## 6. Business rules (must match the AI agent exactly)

- **turn_minutes** by party size: ≤2 → 90; ≤4 → 120; 5–6 → 150. (Encoded in
  `create_reservation`; mirror in any UI estimate.)
- **Party size 1–6 only.** ≥7 → don't book; show "call the restaurant" using
  `restaurants.large_party_phone`.
- **Seating windows** come from `service_windows` keyed by Postgres `dow`
  (`extract(dow from slot_date)`, 0=Sun). Only show/allow times within
  `[open_time, close_time]` for that weekday. (Seeded slots already respect
  this, so a plain slot query is usually enough — but compute the window for
  display and validation.)
- **15-minute grid:** round any time input to `:00/:15/:30/:45`
  (`restaurants.slot_interval_minutes`).
- **A slot is bookable only when `capacity_remaining > 0`.**
- **`member_id` is always the member UUID**, never the `NED-` number.
- **Never set `confirmation_code`** — the DB generates it; read it from the RPC
  return.
- Phone numbers for new members must satisfy E.164 (`^\+[1-9]\d{10,14}$`).
- Optional 30-minutes-in-the-future lead-time guard exists in the AI agent. For
  a staff console you may relax it (hosts book walk-ins for "now") — make it a
  config flag, default off.

---

## 7. App architecture

```
app/
  login/page.tsx              # email+password sign-in
  (app)/layout.tsx            # auth-gated shell: header + RestaurantSwitcher
  (app)/page.tsx              # dashboard: today's snapshot for selected restaurant
  (app)/availability/page.tsx # date + party-size -> SlotGrid; Book action
  (app)/reservations/page.tsx # reservations for restaurant/date; Cancel action
proxy.ts                      # refresh session; redirect unauthenticated -> /login
                              # (Next.js 16 renamed the `middleware` convention to `proxy`)
lib/
  supabase/server.ts          # createServerClient (@supabase/ssr, cookies)
  supabase/client.ts          # createBrowserClient
  queries.ts                  # typed reads (restaurants, slots, reservations, members)
  rpc.ts                      # createReservation(), cancelReservation()
  types.ts                    # generated DB types
components/
  RestaurantSwitcher.tsx      # lists ONLY assigned restaurants (RLS-scoped)
  SlotGrid.tsx                # time x capacity_remaining grid for a date
  BookingDialog.tsx           # MemberCombobox + occasion/special_request -> RPC
  MemberCombobox.tsx          # search members by name/number/phone
  ReservationTable.tsx        # list + cancel
```

**Flows**
1. **Login** → Supabase Auth. On success, `proxy.ts` lets the agent in.
2. **Restaurant scope** → `RestaurantSwitcher` reads `restaurants` (RLS returns
   only assigned ones). Persist the selected restaurant in a URL param or
   cookie. Everything downstream filters by it.
3. **Availability** → query `time_slots` for `restaurant_id + slot_date`,
   ordered by `slot_time`, showing `capacity_remaining` per slot. Greyed when 0.
   "Book" opens `BookingDialog`.
4. **Book** → pick/search a member, optional occasion/special request, call
   `create_reservation` RPC. **0 rows returned = slot just filled** → refresh the
   grid and tell the agent to pick another time. A returned `confirmation_code`
   = success; show it.
5. **Reservations** → list for restaurant/date; `cancel_reservation` RPC frees
   the seat.

**Generate DB types** after the migration:
`supabase gen types typescript --project-id ehsvhlaatnxzhvfzxpnj > lib/types.ts`
(or the MCP `generate_typescript_types`). Use them throughout `queries.ts`.

---

## 8. Environment variables

`.env.local` (and Vercel project env):

```
NEXT_PUBLIC_SUPABASE_URL=https://ehsvhlaatnxzhvfzxpnj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from Supabase project settings>
```

Do **not** put the service-role key in the app. If a one-off admin script needs
it, keep it in a server-only script outside the Next.js bundle.

Both env vars are already set on the Vercel project (Production / Preview /
Development). The login flow uses `signInWithPassword` (no OAuth / magic links),
so **no Supabase redirect-URL configuration is needed**.

---

## 8a. Deployment (Vercel)

- Deployed via **Vercel GitHub import** — the repo is connected to the Vercel
  project under account `ashwin.rana@talkdesk.com` (`ashwinrana-4460`).
- **Push to `main` → auto-deploy.** PRs get preview URLs automatically.
- The repo receives commits from other authors too — **always
  `git pull --rebase` before pushing** to avoid non-fast-forward rejections.

---

## 9. Seed the first agent login

Supabase Auth has 0 users. After the §5 migration:

1. Create an auth user (Dashboard → Authentication → Add user, or the Admin API)
   with a password. Capture the new `user.id`.
2. Link the profile + restaurant access (replace the UUID):
   ```sql
   insert into public.agents (id, email, full_name, role)
   values ('<auth-user-uuid>', 'host@thened-demo.com', 'Demo Host', 'manager');

   insert into public.agent_restaurants (agent_id, restaurant_id)
   values ('<auth-user-uuid>', 'cec0cec0-0000-4000-8000-000000000001');
   ```
3. Log in at `/login`. The switcher should show exactly Cecconi's.

For a multi-restaurant demo, add restaurants + service_windows + time_slots and
insert more `agent_restaurants` rows to show scoped access.

---

## 10. Commands

```bash
npm install
npx supabase login                 # if using the CLI for migrations/types
npm run dev                        # local dev
npm run build && npm run start     # prod build check
git push origin main               # deploy (Vercel auto-deploys from main)
```

---

## 11. Build order

1. Scaffold Next.js + TS + Tailwind + shadcn/ui; wire `@supabase/ssr` clients.
2. Apply the §5 migration; generate `lib/types.ts`.
3. Seed one agent (§9) and (optional) roll slot dates forward (§4).
4. `/login` + `proxy.ts` (route protection + session refresh).
5. App shell + `RestaurantSwitcher` (verify RLS scoping with two agents).
6. `/availability` + `SlotGrid` (read-only first).
7. `BookingDialog` + `create_reservation`; handle the 0-rows race.
8. `/reservations` + `cancel_reservation` (verify seat is returned).
9. Dashboard snapshot; polish; deploy to Vercel.

---

## 12. Guardrails — do NOT

- Hardcode a restaurant id in the UI — always scope by the switcher / RLS.
- Write to `time_slots` or `reservations` directly from the client — use the RPCs.
- Set `confirmation_code` or `turn_minutes` by hand — DB/RPC owns them.
- Ship the service-role key to the browser.
- Book parties of 7+ — route them to `large_party_phone`.
- Drop the `anon_read_*` policies without confirming no other demo depends on them.
- Assume seeded slots are "today" — they're 2026-06-09→22; roll forward for demos.

---

## 13. Relationship to the CXA AI agent (reference only)

The "The_Ned_Restaurants" agent system (Cecconi Concierge supervisor + Auth,
Booking, Reservation Management, Escalation sub-agents) books against these exact
tables using a service-role `execute_sql` tool and the same atomic
decrement-and-insert CTE this console's `create_reservation` RPC reproduces.
Keeping the rules in §6 identical is what lets the voice agent and this host
console share one source of truth without overselling.
