# The Ned — Booking System (Supabase schema + seed)

A Supabase (Postgres) database for a **Talkdesk Multi-Agent** reservation demo.
Partner: **GreenIP**. End customer: **The Ned** (members-only club, London).
**Scope: one restaurant — Cecconi's at The Ned London.**

The Talkdesk agents query this DB **directly** via the Supabase `execute_sql`
MCP tool. There is no backend/API layer yet (that's a later Vercel step).

## Files

- `supabase/migrations/0001_init.sql` — tables, FKs, unique constraints, RLS
  (anon read-only), `pgcrypto`, plus two helper functions: `turn_minutes(party)`
  and `gen_confirmation_code(prefix)`.
- `supabase/seed.sql` — idempotent seed (truncates + regenerates). Knobs at the
  top. Availability is a **rolling 14-day window anchored on `current_date`**, so
  re-running keeps the demo fresh — it never goes stale.

## Live project

Applied + seeded to Supabase project **`hospitality_restaurants`** (ref
`ehsvhlaatnxzhvfzxpnj`, personal account) on 2026-06-03. Real demo people are
added via `supabase/add_accounts.sql` (member numbers `NED-2000xx`); re-run it
after any re-seed, since `seed.sql` truncates `members`.

## Apply

Order matters: schema first, then seed.

```bash
# Supabase SQL editor: paste 0001_init.sql, run; then paste seed.sql, run.
# Or via psql:
psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
psql "$DATABASE_URL" -f supabase/seed.sql
# Or via the Supabase MCP `execute_sql` tool, one file at a time.
```

> Not yet executed against a live Postgres (no local server was available in the
> build environment). Reviewed by hand; validate on first apply.

---

## Constants for the agent prompts

**Hardcode this restaurant UUID** into the Talkdesk agent prompts (the seed
inserts Cecconi's with this fixed id):

```
RESTAURANT_ID (Cecconi's) = cec0cec0-0000-4000-8000-000000000001
CONFIRMATION PREFIX       = CEC
LARGE-PARTY (7+) PHONE    = +442079460123   (Ofcom fictional London range)
TURN-TIME RULE            = <=2 -> 90 min, <=4 -> 120 min, 5+ -> 150 min
```

### Opening hours (single source of truth)

Defined ONCE in `seed.sql` (the `_hours` table) and used to generate every
`time_slots` row — there are **no** slots outside these windows. `last seating`
is itself a bookable 15-minute slot (generation is inclusive). **Mirror this
table verbatim in the Booking Agent prompt's opening-hours guard; if it ever
changes, change it in both the seed `_hours` and the prompt.**

| Day       | First seating | Last seating |
|-----------|---------------|--------------|
| Monday    | 12:00         | 22:30        |
| Tuesday   | 07:00         | 22:30        |
| Wednesday | 07:00         | 22:30        |
| Thursday  | 07:00         | 22:30        |
| Friday    | 12:00         | 22:30        |
| Saturday  | 12:00         | 22:30        |
| Sunday    | 12:00         | 21:30        |

Slots are every 15 minutes from first to last seating inclusive. A `23:00` slot
never exists; a Sunday `22:00` slot never exists; a Monday `11:00` slot never
exists. `service_windows` mirrors these as one `all_day` window per weekday.

### Sample members (phone + member number)

| Member #     | Name              | Phone (Ofcom fictional) |
|--------------|-------------------|-------------------------|
| `NED-100482` | Olivia Whitfield  | `+447700900112`         |
| `NED-100485` | James Okafor      | `+447700900145`         |
| `NED-100488` | Priya Nair        | `+447700900167`         |
| `NED-100491` | Thomas Ashworth   | `+447700900189`         |

### Confirmation codes (for the cancel flow)

Seed reservations draw codes from `public.cecconis_conf_seq` (the seed restarts
it at `100000` each run), so they are **deterministic**:

- `CEC-100000` and `CEC-100001` both belong to **Olivia Whitfield (`NED-100482`,
  `+447700900112`)** — she has **two** upcoming reservations, so this member
  exercises the **disambiguation branch** of the cancel flow.
- The other ~8 seeded reservations get `CEC-100002`, `CEC-100003`, … in insert
  order.

> Code ranges are deliberately disjoint: **seed** codes are 6-digit sequence
> codes (`CEC-100000`+), while the **live Booking Agent** mints random 4-digit
> codes (`CEC-0000`..`CEC-9999` via `gen_confirmation_code('CEC')`), so a runtime
> booking can never collide with a seeded one.

---

## SQL the agents run

All take the restaurant UUID as `<rid>` = `cec0cec0-0000-4000-8000-000000000001`.

**Auth lookup** (phone exists in member list):
```sql
select id, member_number, first_name, last_name, email
from members where phone = '<e164>' limit 1;
```

**Availability check** (at booking time):
```sql
select capacity_remaining from time_slots
where restaurant_id = '<rid>' and slot_date = '<d>' and slot_time = '<t>';
```

**Nearby-times suggestion** (same date, within +/- N minutes, has space):
```sql
select slot_time, capacity_remaining from time_slots
where restaurant_id = '<rid>' and slot_date = '<d>'
  and capacity_remaining > 0
  and slot_time between '<t>'::time - interval '<N> minutes'
                    and '<t>'::time + interval '<N> minutes'
order by slot_time;
```

**Book (atomic — a race can't oversell):** decrement only if space remains, then
insert. If the slot is full the CTE returns no rows, nothing is inserted, and the
statement returns empty — the agent then offers nearby times. `occasion` /
`special_request` are optional (pass `null`).
```sql
with dec as (
  update time_slots set capacity_remaining = capacity_remaining - 1
  where restaurant_id = '<rid>' and slot_date = '<d>' and slot_time = '<t>'
    and capacity_remaining > 0
  returning id
)
insert into reservations
  (confirmation_code, restaurant_id, member_id, slot_date, slot_time,
   party_size, turn_minutes, occasion, special_request, status)
select gen_confirmation_code('CEC'), '<rid>', '<mid>', '<d>', '<t>',
       <party>, turn_minutes(<party>), <occasion-or-null>, <request-or-null>, 'booked'
from dec
returning confirmation_code, slot_date, slot_time, party_size, turn_minutes;
```

**Cancel lookup** (list a member's booked reservations; 2+ rows -> disambiguate):
```sql
select confirmation_code, restaurant_id, slot_date, slot_time, party_size
from reservations
where member_id = '<mid>' and status = 'booked'
order by slot_date, slot_time;
```

**Cancel (atomic):** mark cancelled (only if it's this member's and still booked),
then release the seat back to the slot.
```sql
with cx as (
  update reservations set status = 'cancelled', cancelled_at = now()
  where confirmation_code = '<code>' and member_id = '<mid>' and status = 'booked'
  returning restaurant_id, slot_date, slot_time
)
update time_slots t set capacity_remaining = capacity_remaining + 1
from cx
where t.restaurant_id = cx.restaurant_id
  and t.slot_date = cx.slot_date and t.slot_time = cx.slot_time
returning t.slot_date, t.slot_time;
```

---

## Deliberately not built (per spec)

One restaurant only; no table/seat-level inventory or overlap math; no
card/deposit fields; no modify/reschedule (make + cancel only); no cross-restaurant
fallback; no turn-time-based availability re-release; no touchpoint-driven
`restaurant_id` injection (it's the hardcoded constant above).
