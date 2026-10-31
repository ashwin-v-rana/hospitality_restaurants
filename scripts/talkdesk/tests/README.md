# Wren agent test suite

A scripted customer that chats with the Wren CXA agent system
(`Wren_Restaurants_GOLDEN_TEMPLATE`) through the Talkdesk simulator, and a scorer
that marks each conversation PASS or FAIL. Ported from the Crestline suite
(`~/crestline_insurance/crestline-insurance-demo/talkdesk/tests`).

**These runs use real tools.** Every run that reaches sign-in sends a real SMS
code to the test member (default `NED-100515`, Raj Patel, which carries the
owner's own phone and email). `book` / `update` / `cancel` write real
reservations and send real confirmation email + SMS. The booking chain only
touches its own test booking (party of 2, `TD_BOOK_DAYS` ahead, 7:30 PM, moved
to 8:30 PM) and ends with it cancelled; the change/cancel scenarios say yes only
to a read-back that names the test date.

## Setup

```bash
cd scripts/talkdesk/tests
npm install            # ws
```

Credentials come from the repo's `.env.local`: `TALKDESK_CLIENT_ID` /
`TALKDESK_CLIENT_SECRET` (same OAuth client as Crestline; it has
`ai-agent-context:write` for `/chat/context`) and the Supabase service-role key
(only to read the test member's phone, which is never printed or saved: run
files show `<test phone>`; the sign-in code shows as `<correct code>`).

Env (optional): `TD_SYSTEM_ID`, `TD_TEST_MEMBER`, `TD_BOOK_DAYS` (default 5;
there must be open `time_slots` that far out, see `/admin/slots`).

## Run

```bash
./run_suite.sh v8_try1          # against the DRAFT version
CHAINS="1 2" ./run_suite.sh v9_try1   # run the booking chain twice
./run_suite.sh v7_live live     # against the published version
python3 -I td_score.py runs/v8_try1/*.json      # rescore, with agent hops
node td_sim.mjs true out.json probe:"Can I book a table?"   # one scenario
```

## Scenarios

| Scenario | Customer says | Pass when |
|---|---|---|
| `probe:<text>` | the text, first turn only | the Orchestrator routes (to the owning sub-agent, or Auth) instead of answering itself |
| `book` | table for 2, test date, 7:30 PM; yes to send | Booking Agent books it and calls send_email + send_confirmation_sms |
| `update` | move it to 8:30 PM; yes to send | Update Agent reports the change and calls send_email + send_confirmation_sms |
| `lookup` | do I have reservations coming up; yes to send | Reservation Agent lists them and sends both |
| `cancel` | cancel a reservation | Reservation Agent cancels the test booking and sends both confirmations |
| `large_party` | table for 9 | the large-party phone number, no write |
| `person` / `private_event` | a person / a private dinner for 30 | Escalation Agent, Load Transfer Data, `escalate` exit (v7 baseline: phone number given) |
| `lockout` | 4 wrong codes | handoff via the Escalation Agent |

Every run also fails on Orchestrator faults: `answered_for_customer`,
`list_dropped`, `own_question`, `skipped_escalation`,
`wrote_without_confirmation` (a reservations/time_slots write before the
customer said yes), and the platform fallback "Sorry, I cannot handle your
request right now."

## Debugging a failure (always, before proposing a fix)

Pull the failing run's LLM calls from Databricks and read the call where it went
wrong; compare with a passing run of the same flow:

```bash
cd ~/ai-agents-deployments/.toolkit
npx tsx <repo>/scripts/talkdesk/tests/td_dbx.ts <repo>/scripts/talkdesk/tests/runs/<run>/<scenario>.json
```

`td_dbx.ts` reuses the toolkit's auth/query code with a window of the run's own
timestamps +/- 5 minutes (a few seconds per pull). Output files are numbered
newest first and hold full prompts and the test phone - they stay in `runs/`.
