# The Ned — Cecconi's Reservation System (Talkdesk Multi-Agent)

A **Talkdesk Multi-Agent AI System** for table reservations, plus the Supabase
(Postgres) database it runs on. Partner: **GreenIP**. End customer: **The Ned**
(members-only club, London). **Scope: one restaurant — Cecconi's at The Ned
London.** Voice + chat.

The agents query Supabase **directly** via the `execute_sql` MCP tool. Email and
SMS go through MCP/workflow tools (see *Tools & infrastructure*). There is no
backend/API layer yet — an OpenTable-shaped Vercel API is a deferred next step.

> **This README reflects the system as actually built and tested (live since
> 2026-06-03).** It supersedes the original DB-spec README. Several earlier
> design choices (random confirmation codes, n8n email) were changed during the
> build — see *History & hard-won lessons*.

---

## 1. Agent architecture

A strict one-level star: a single supervising **Orchestrator** voices everything
to the customer; five **action agents** do the work behind the scenes and return
JSON only. Action agents never speak to the customer directly.

| Agent | Role | Responsibility |
|---|---|---|
| **Cecconi's Orchestrator** | SUPERVISING_AGENT | Greets, routes on intent, relays sub-agent messages **verbatim**. Contains zero business logic. The only voice the customer hears. |
| **Auth Agent** | ACTION_AGENT | Phone + SMS-OTP authentication; writes member context to session variables. Unlimited attempts, no lockout. |
| **Booking Agent** | ACTION_AGENT | Makes reservations: collect date/time/party, opening-hours + lead-time guards, availability check, atomic write, dual confirmation. 7+ parties → large-party phone. |
| **Reservation Management Agent** | ACTION_AGENT | Looks up and cancels reservations; disambiguates when a member has more than one; releases the slot; dual confirmation. |
| **Escalation Agent** | ACTION_AGENT | Private events, group dining, "speak to a person." No tools — returns a graceful handoff message. |

**Sub-agent output contract:** every action agent returns a JSON object with a
`status` of `complete`, `reroute`, or `escalate`, plus a `customer_message` the
Orchestrator delivers word-for-word (confirmation codes, dates, amounts must
survive verbatim).

**Routing** lives in two places on the Orchestrator that must agree: the terse
`routing_condition` (machine classifier) and the prose ROUTING RULES in the
instruction. Unauthenticated membership requests → Auth first. The lookup intent
("check my reservation") routes to Reservation Management once authenticated.

### Session variables (the cross-agent contract)

Auth writes these via `set_customer_context`; Booking and Reservation Management
re-hydrate them at Step 0 via `get_customer_context` into local `working_*`
variables.

| Variable | Contents | Notes |
|---|---|---|
| `member_id` | members.id (UUID) | **The ONLY value ever used in SQL** (`reservations.member_id`). |
| `member_number` | `NED-xxxxxx` | **Display only** — never appears in a WHERE clause or INSERT key. |
| `customer_fname` / `customer_lname` | name | Used in confirmations and read-backs. |
| `customer_email` | email | Confirmation email destination. |
| `phone_number` | E.164 | OTP + confirmation SMS destination; persisted by `set_customer_context`. |
| `authenticated` | "authenticated" | Set on OTP match; gates routing. |

> **member_id vs member_number was a real bug.** The UUID originally travelled as
> `customer_id` (Crestline residue) while SQL used `member_id`; an empty
> same-named decoy variable caused `member_id = ''` queries. Resolved by renaming
> to `member_id` everywhere and removing `customer_id`. See *lessons*.

---

## 2. Tools & infrastructure

| Tool | Type | Used by | Purpose |
|---|---|---|---|
| `execute_sql` | Supabase MCP | Auth, Booking, Reservation Mgmt | All DB reads/writes (reads from the `sql_query` variable). |
| `set_customer_context` / `get_customer_context` | Workflow | Auth writes; Booking + Res Mgmt read | Persist/read the session variables above (incl. `member_id`, `member_number`, `phone_number`). |
| `send_one_time_pin` | Workflow | Auth | OTP SMS for **+1** (US/Canada) numbers. |
| `send_one_time_pin_UK` | Workflow | Auth | OTP SMS for **+44 and all other** countries. |
| `send_confirmation_sms` | Workflow | Booking, Res Mgmt | Confirmation SMS for **+1** numbers (reads `sms_message`, `phone_number`; fire-and-forget). |
| `send_confirmation_sms_UK` | Workflow | Booking, Res Mgmt | Confirmation SMS for **all other** countries. |
| `Call_Send_Email_claims_` | MCP | Booking, Res Mgmt | Email — **superseded by `send_email`** (see below). Reads `email_to`, `email_subject`, `email_body`. |
| `send_email` | MCP (Cloudflare Worker) | Booking, Res Mgmt | Current email tool. Resend backend via a TypeScript Cloudflare Worker (`talkdesk-demos-mcp`); bearer-token auth; same `email_to`/`email_subject`/`email_body` params. |

**Country routing rule (OTP and confirmation SMS):** determined from the E.164
number — `+1` → base skill; **everything else** (incl. `+44`) → `_UK` skill.
Applied on every send, including resends.

**Shared MCP infrastructure:** the `talkdesk-demos.com` domain on Cloudflare, a
Cloudflare Worker bridging to Resend (free tier), DKIM/SPF/DMARC verified. The
Worker is a required protocol adapter (Resend doesn't speak MCP), not just
convenience. Sender identity is config, not LLM-controlled.

### Timezone / Date Resolution Engine

Time handling uses the **platform's built-in Date Resolution Engine**, not a
tool call. Set in the touchpoint's **Application Input**:

```json
{
  "ai_agent_settings": {
    "timezone": "Europe/London"
  }
}
```

This injects current London date/time (with automatic BST/GMT handling, because
it's a proper IANA `Region/City` value) into the system prompt every turn. The
Booking Agent's guards read that injected "now" — no `get_current_time` tool is
needed for this agent.

> **JSON must be valid.** A malformed block (`=` instead of `:`) silently fails
> to parse and **defaults to UTC**, which runs London an hour slow in summer (no
> BST) and makes the lead-time guard look intermittently broken. The guard logic
> is sound; a wrong clock was feeding it. This cost real debugging time — see
> *lessons*.

---

## 3. Booking rules

**Opening hours (single source of truth).** Defined once in `seed.sql` (the
`_hours` table) and used to generate every `time_slots` row — **no slots exist
outside these windows.** Mirrored verbatim in the Booking Agent's opening-hours
guard; change both together if hours ever change.

| Day | First seating | Last seating |
|---|---|---|
| Monday | 12:00 | 22:30 |
| Tuesday–Thursday | 07:00 | 22:30 |
| Friday–Saturday | 12:00 | 22:30 |
| Sunday | 12:00 | 21:30 |

Slots are every 15 minutes, first → last seating **inclusive**.

**Guards (Booking Step 1, after fields are captured, before availability):**
- **Opening-hours guard** — reject times outside the day's seating window with a
  specific message ("On Sundays our last seating is 9:30 PM…").
- **Lead-time guard** — booking must be **≥ 30 minutes** in the future relative
  to the injected London "now"; reject past/too-soon times.

**Other constants:**
```
RESTAURANT_ID (Cecconi's) = cec0cec0-0000-4000-8000-000000000001   (hardcoded in prompts)
CONFIRMATION PREFIX       = CEC
LARGE-PARTY (7+) PHONE     = +442038282000
TURN-TIME RULE            = <=2 -> 90 min, <=4 -> 120 min, 5 or 6 -> 150 min
PARTY SIZES               = 1–6 automated; 7+ → large-party phone (not a DB write)
```

**Confirmations** go to **both** email (`send_email`) and SMS
(`send_confirmation_sms[_UK]`), and include the booking policy (15-min grace,
party-size table hold, 24-hour / £25pp cancellation, children until 8pm).

**Cancellation policy figure: £25 per person** within 24 hours. (Known
occasional model drift to "£35"; a figure-pinning prompt patch is available but
was deferred.)

---

## 4. Database

### Files
- `supabase/migrations/0001_init.sql` — tables, FKs, unique constraints, RLS
  (anon read-only), `pgcrypto`, helper functions.
- `supabase/seed.sql` — idempotent seed (truncates + regenerates). Availability
  is a **rolling 14-day window anchored on `current_date`**, so re-running keeps
  the demo fresh.
- `supabase/add_accounts.sql` — real demo people (member numbers `NED-2000xx`);
  re-run after any re-seed, since `seed.sql` truncates `members`.

### Live project
Supabase project **`hospitality_restaurants`** (ref `ehsvhlaatnxzhvfzxpnj`,
personal account). Live and exercised via voice + chat since 2026-06-03.

### Apply (order matters: schema, then seed)
```bash
# Supabase SQL editor: paste 0001_init.sql, run; then seed.sql, run.
psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
psql "$DATABASE_URL" -f supabase/seed.sql
```

### Confirmation codes — sequence-backed (IMPORTANT)

Codes come from **one** source: the sequence `public.cecconis_conf_seq` (floor
**100000**) via function `gen_cecconis_conf_code()`, set as the **DEFAULT** on
`reservations.confirmation_code`. Both seed and runtime bookings draw from it, so
codes are monotonic (`CEC-100001`, `CEC-100002`, …) and **cannot collide**. The
Booking Agent's INSERT **omits** `confirmation_code` and reads it back via
`RETURNING`.

```sql
CREATE SEQUENCE IF NOT EXISTS public.cecconis_conf_seq;
SELECT setval('public.cecconis_conf_seq', 100000, true);   -- next nextval -> 100001
CREATE OR REPLACE FUNCTION public.gen_cecconis_conf_code()
RETURNS text LANGUAGE sql AS $$
  SELECT 'CEC-' || nextval('public.cecconis_conf_seq')::text
$$;
ALTER TABLE public.reservations
  ALTER COLUMN confirmation_code SET DEFAULT public.gen_cecconis_conf_code();
```

> **Re-seed hazard:** if a re-seed `DROP/CREATE`s `reservations` with a random
> default inline, it silently reverts this. The sequence + function must be
> created **before** `CREATE TABLE reservations`, with the DEFAULT set in the
> table definition — not via a later `ALTER` that a re-seed would wipe. The
> earlier random-4-digit scheme (`CEC-0000`..`CEC-9999`) is **removed**; it
> caused the `23505` collision saga.

### Sample members
| Member # | Name | Phone |
|---|---|---|
| `NED-100482` | Olivia Whitfield | `+447700900112` |
| `NED-100485` | James Okafor | `+447700900145` |
| `NED-100488` | Priya Nair | `+447700900167` |
| `NED-100491` | Thomas Ashworth | `+447700900189` |

Seed gives one member **two** upcoming reservations to exercise the cancel-flow
disambiguation branch. (Live testing also used `NED-100515` / Raj Patel and
`NED-200002` / Suresh Bhandarkar via `add_accounts.sql`.)

---

## 5. SQL the agents run

`<rid>` = `cec0cec0-0000-4000-8000-000000000001`.

**Auth lookup:**
```sql
SELECT id, member_number, first_name, last_name, email
FROM members WHERE phone = '<e164>' LIMIT 1;
```

**Availability check:**
```sql
SELECT capacity_remaining FROM time_slots
WHERE restaurant_id = '<rid>' AND slot_date = '<d>' AND slot_time = '<t>';
```

**Nearby times** (same date, ±60 min, has space; future/lead-time filtered in
the prompt against the injected London "now"):
```sql
SELECT slot_time FROM time_slots
WHERE restaurant_id = '<rid>' AND slot_date = '<d>' AND capacity_remaining > 0
  AND slot_time BETWEEN '<t>'::time - interval '60 minutes'
                    AND '<t>'::time + interval '60 minutes'
ORDER BY abs(extract(epoch FROM (slot_time - '<t>'::time))) LIMIT 6;
```

**Book (atomic — decrement-and-insert, can't oversell).** `confirmation_code` is
omitted (DB default mints it); `occasion`/`special_request` are `NULL`:
```sql
WITH booked AS (
  UPDATE time_slots SET capacity_remaining = capacity_remaining - 1
  WHERE restaurant_id = '<rid>' AND slot_date = '<d>' AND slot_time = '<t>'
    AND capacity_remaining > 0
  RETURNING id
)
INSERT INTO reservations
  (restaurant_id, member_id, slot_date, slot_time, party_size,
   turn_minutes, occasion, special_request, status)
SELECT '<rid>', '<mid>', '<d>', '<t>', <party>, <turn>, NULL, NULL, 'booked'
FROM booked
RETURNING confirmation_code;
```
Empty result → slot filled between check and write → offer nearby times.

**Cancel lookup** (booked, future; 2+ rows → disambiguate):
```sql
SELECT confirmation_code, slot_date, slot_time, party_size
FROM reservations
WHERE member_id = '<mid>' AND restaurant_id = '<rid>'
  AND status = 'booked' AND slot_date >= CURRENT_DATE
ORDER BY slot_date, slot_time;
```

**Cancel (atomic — mark cancelled + release the slot):**
```sql
WITH cancelled AS (
  UPDATE reservations SET status = 'cancelled', cancelled_at = now()
  WHERE confirmation_code = '<code>' AND member_id = '<mid>' AND status = 'booked'
  RETURNING restaurant_id, slot_date, slot_time
)
UPDATE time_slots t SET capacity_remaining = capacity_remaining + 1
FROM cancelled c
WHERE t.restaurant_id = c.restaurant_id
  AND t.slot_date = c.slot_date AND t.slot_time = c.slot_time
RETURNING t.id;
```

---

## 6. Prompt-engineering patterns (reusable across demos)

- **Thin Orchestrator, verbatim relay.** Never answers on the customer's behalf,
  never invents questions, never reveals internal agent names. Numbers / codes /
  amounts pass through exactly.
- **Step 0 context hydration.** Each action agent loads session vars into local
  `working_*` vars first thing (salience decays over multi-turn flows). Guard:
  if `working_member_id` isn't a UUID → escalate, never run SQL with an empty
  key.
- **Read the result before branching.** Every `execute_sql` / tool call must
  capture its result into a working var and branch on it — never guess what a
  query returned. (Fixed the "booked then said unavailable" and OTP-skip bugs.)
- **Silent tool calls — no narration.** "NEVER narrate a tool call" + STOP/
  OTHERWISE guards. Narrating internal steps causes Orchestrator echo loops.
- **Mandatory confirmation gate.** Booking/cancel write only after an explicit
  customer "yes" in the immediately preceding turn (a precondition, not a
  skippable step).
- **One field per turn.** Capture-first (absorb anything already provided), then
  ask only what's missing, one question at a time.
- **Scope walls on action agents.** "You handle X ONLY" — an agent that knows
  the customer's larger goal will otherwise freelance into another agent's job
  (Auth once tried to collect cancellation details).
- **Atomic writes** via single-statement CTEs so a race can't oversell/double-act.

---

## 7. History & hard-won lessons

- **Malformed `ai_agent_settings` JSON → silent UTC default.** `=` instead of `:`
  ran London 1 hour slow (no BST), making the lead-time guard look stochastically
  broken. **When a guard looks stochastic, check the clock/input feeding it
  before touching the guard logic.**
- **Confirmation-code collisions (`23505`).** Random 4-digit defaults collided
  with seed codes; the sequence was repeatedly reset below the seed range by
  re-seeds. Fixed with a `public`-qualified sequence at floor 100000 + function
  default baked into the schema.
- **`member_id` vs `customer_id` decoy.** An empty same-named session variable
  caused `member_id = ''` queries. Collapsed to a single `member_id` (UUID).
- **OTP verification.** Stripping *non-digits* laundered junk like `q168008` into
  a valid code; changed to strip **whitespace only**. (Verification still happens
  in-model; moving it to a DB `otp_codes` check is a noted production hardening.)
- **Studio flow terminal actions.** `END_AUTOMATION_SUCCESS` in a mid-flow SMS
  step terminated the whole automation; workflows used mid-conversation must
  return control, not end.
- **Agents skip silent steps.** Confirmation gates, OTP sends, and guards that
  produce no visible output get dropped as the model races to the goal — hence
  the explicit MANDATORY / precondition framing.

---

## 8. Deliberately not built (current scope)

One restaurant only (schema keeps `restaurant_id` for future multi-restaurant);
no table/seat-level inventory or overlap math (A1 slot-capacity model); no
card/deposit fields; no modify/reschedule (make + cancel only); no
cross-restaurant or Oracle Hospitality fallback; no turn-time-based availability
re-release; no touchpoint-driven `restaurant_id` injection (hardcoded constant).

## 9. Deferred / next steps

- Move OTP verification out of the model (DB `otp_codes` check-and-consume).
- Bake the confirmation-code sequence + default into the seed DDL so re-seeds
  can't regress it.
- OpenTable-shaped API layer on Vercel (agents would call it instead of direct
  SQL).
- **The Ned Resort** — multi-restaurant (10+) across multiple global locations:
  a clean schema (location + restaurant as real entities, per-location timezone),
  reusing the agent patterns above as reference. Tracked in a separate chat.
