// Scripted customer for the Talkdesk simulator (ported from Crestline's td_sim.js).
// The customer answers what the agent asks, by keyword. The sign-in code is read from
// send_one_time_pin's sent_pin output and never printed; the test member's phone is
// read from the database and never printed either.
//
// Usage: node td_sim.mjs <isDraft true|false> <outJson> <scenario>
// Scenarios: book | update | lookup | cancel | large_party | person | private_event |
//            lockout | probe:<first message>
// Env: TD_SYSTEM_ID (default Wren GOLDEN_TEMPLATE), TD_TEST_MEMBER (default NED-100515),
//      TD_BOOK_DAYS (days ahead to book, default 5).
//
// REAL TOOLS: runs that reach sign-in send a real SMS code to the test member's phone;
// book/update/cancel write real reservations and send real email + SMS.
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const [isDraftArg, outJson, scenario] = process.argv.slice(2);
if (isDraftArg === '--token') { /* handled below */ } else if (!scenario) { console.error('usage: node td_sim.mjs <true|false> <out.json> <scenario>'); process.exit(2); }

const env = {};
for (const line of readFileSync(resolve(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
}

const SYSTEM_ID = process.env.TD_SYSTEM_ID || '39ab2b71-e859-443c-92fa-08f357ed8e27';
const ACCOUNT = '68668a003d12ae2f90ebbcb4';
const API = 'https://api.talkdeskapp.com';
const ORIGIN = 'https://partner-team1.mytalkdesk.com';
const WS_BASE = 'wss://ai-agent-platform.talkdeskapp.com';
const MEMBER = process.env.TD_TEST_MEMBER || 'NED-100515';

// ---- test booking: party of 2, N days ahead (London), 7:30 PM; update moves it to 8:30 PM.
const londonDate = (plusDays) => {
  const d = new Date(Date.now() + plusDays * 864e5);
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long' })
    .formatToParts(d).map(x => [x.type, x.value]));
  return { weekday: p.weekday, day: p.day, month: p.month };
};
const BD = londonDate(Number(process.env.TD_BOOK_DAYS || 5));
const BOOK_DATE = `${BD.weekday} ${BD.day} ${BD.month}`;
// Matches "November 5", "5 November", "Nov 5", "5th November" ...
const DATE_RE = new RegExp(`(\\b${BD.month.slice(0, 3)}[a-z]*\\.?\\s+${BD.day}(st|nd|rd|th)?\\b)|(\\b${BD.day}(st|nd|rd|th)?\\s+(of\\s+)?${BD.month.slice(0, 3)})`, 'i');
const OPENERS = {
  book: `I'd like to book a table for 2 on ${BOOK_DATE} at 7:30 PM.`,
  update: `I need to change my reservation on ${BOOK_DATE} to 8:30 PM.`,
  lookup: 'Do I have any reservations coming up?',
  cancel: 'I need to cancel a reservation.',
  large_party: `Can I book a table for 9 people on ${BOOK_DATE} at 8 PM?`,
  person: 'Can I speak to a real person please?',
  private_event: "I'd like to arrange a private dinner for 30 guests.",
  lockout: `I'd like to book a table for 2 on ${BOOK_DATE} at 7:30 PM.`,
};
// Scenarios that change an existing booking only ever say yes to the test booking.
const TOUCH_ONLY_TEST = ['update', 'cancel'].includes(scenario);

// One token per ~45 min, cached in tests/.tok (mode 600, gitignored): parallel runs
// each asking for a token get HTTP 429 from the token endpoint.
const TOK = resolve(dirname(fileURLToPath(import.meta.url)), '.tok');
async function token() {
  if (existsSync(TOK) && Date.now() - statSync(TOK).mtimeMs < 45 * 60e3) return readFileSync(TOK, 'utf8').trim();
  const basic = Buffer.from(`${env.TALKDESK_CLIENT_ID}:${env.TALKDESK_CLIENT_SECRET}`).toString('base64');
  const r = await fetch('https://partner-team1.talkdeskid.com/oauth/token', {
    method: 'POST', headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  });
  const b = await r.json();
  if (!b.access_token) throw new Error(`token failed ${r.status}`);
  writeFileSync(TOK, b.access_token, { mode: 0o600 });
  return b.access_token;
}

async function memberPhone() {
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/members?member_number=eq.${MEMBER}&select=phone`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  const rows = await r.json();
  if (!rows[0]?.phone) throw new Error(`no phone for ${MEMBER}`);
  return rows[0].phone;
}

async function openTestBookings() {
  const d = new Date(Date.now() + Number(process.env.TD_BOOK_DAYS || 5) * 864e5).toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
  const m = await (await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/members?member_number=eq.${MEMBER}&select=id`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } })).json();
  const r = await (await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/reservations?member_id=eq.${m[0].id}&slot_date=eq.${d}&status=eq.booked&select=id`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } })).json();
  return r.length;
}

const records = [];
const transcript = [];
const wrongCodes = ['111111', '222222', '333333', '444444'];
let PHONE;

function sentPin() {
  let pin = null;
  for (const r of records) {
    const te = r.tool_execution;
    if (te && te.tool && te.tool.tool_name === 'send_one_time_pin') {
      const m = JSON.stringify(te).match(/sent_pin\W+(\d{6})/);
      if (m) pin = m[1];
    }
  }
  return pin;
}

// Pick the numbered list line that is the test booking.
function pickTestLine(a) {
  const lines = a.split('\n').filter(l => /^\s*\d+\./.test(l));
  const hit = lines.find(l => DATE_RE.test(l) && (scenario !== 'cancel' || /8:30|20:30|7:30|19:30/.test(l)));
  return hit ? hit.match(/^\s*(\d+)\./)[1] : null;
}

// The customer's next message, or null to stop.
function nextUserMessage(agent) {
  const a = agent.toLowerCase();
  if (/anything else/.test(a)) return "No, that's all. Thank you!";
  if (/phone number/.test(a)) return PHONE;
  if (/code/.test(a) && /(enter|received|6-digit|didn't match|did not match|say)/.test(a)) {
    if (scenario === 'lockout') return wrongCodes.shift() || null;
    const pin = sentPin();
    return pin ? pin.slice(0, 3) + ' ' + pin.slice(3) : null;
  }
  // A numbered list to choose from.
  if (/^\s*\d+\./m.test(agent) && /which/.test(a)) {
    const n = pickTestLine(agent);
    return n ? n : 'None of those, thanks.';
  }
  // Offers to send details by email and phone.
  if (/send/.test(a) && /(email|phone)/.test(a) && /\?\s*$/.test(a)) {
    return ['book', 'update', 'lookup'].includes(scenario) ? 'Yes please.' : 'No, thanks.';
  }
  // Read-backs before a write.
  if ((/(shall i|should i|go ahead|is that (correct|right)|confirm)/.test(a) && /\?\s*$/.test(a)) || /say yes|yes to confirm|correct\?/.test(a)) {
    if (TOUCH_ONLY_TEST && !DATE_RE.test(agent)) return 'No, not that one.';
    return 'Yes, please go ahead.';
  }
  if (/what would you like to change/.test(a)) return 'The time, please - to 8:30 PM.';
  if (/what date|which date|which day/.test(a)) return BOOK_DATE;
  if (/what time|which time|\band what time/.test(a)) return scenario === 'update' ? '8:30 PM' : '7:30 PM';
  if (/how many/.test(a)) return scenario === 'large_party' ? '9' : '2';
  if (/try a different (phone )?number/.test(a)) return null;
  return null;
}

function waitForAgent(ws, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ws.removeListener('message', onMsg); reject(new Error('timeout')); }, timeoutMs);
    function onMsg(data) {
      let r;
      try { r = JSON.parse(data.toString()); } catch { return; }
      for (const rec of r.records || []) records.push(rec);
      const agentMsg = (r.records || []).some(x => x.record_type === 'MESSAGE' && x.message && x.message.to === 'USER' && !x.message.is_filler);
      const exit = (r.records || []).some(x => x.exit);
      if (agentMsg || exit || r.agent_text || r.exit || r.end_connection_reason) {
        clearTimeout(timer); ws.removeListener('message', onMsg); resolve(r);
      }
    }
    ws.on('message', onMsg);
  });
}

const agentText = (r) => (r.records || []).filter(x => x.record_type === 'MESSAGE' && x.message && x.message.to === 'USER' && !x.message.is_filler)
  .map(x => x.message.msg).join('\n') || r.agent_text || '';

function exitOf(r) {
  const rec = (r.records || []).find(x => x.exit);
  return (rec && { ...rec.exit, llm_action: rec.llm_action, by: rec.message?.from_agent?.name }) || r.exit || r.end_connection_reason || null;
}

(async () => {
  const tok = await token();
  if (isDraftArg === '--token') { console.log('token ready'); return; }
  PHONE = await memberPhone();
  // A booking chain starts clean: an orphaned test booking would make update/cancel pick the wrong one.
  if (scenario === 'book' && (await openTestBookings()) > 0) {
    console.log(`[${scenario}] ABORT: ${MEMBER} already has an open booking on ${BOOK_DATE}; cancel it first`); process.exit(3);
  }
  const sessionId = randomUUID();
  const interactionId = randomUUID().replace(/-/g, '');
  const res = await fetch(`${API}/chat/context`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, Accept: 'application/json', 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({
      interaction_id: interactionId, session_id: sessionId, room_id: 'sample room_id',
      account_id: ACCOUNT, agent_system_id: SYSTEM_ID,
      context: { account_id: ACCOUNT, interaction_id: interactionId, channelType: 'digital', channelName: 'SIMULATOR', callerId: '123456789', businessHours: '' },
      is_draft: isDraftArg === 'true',
    }),
  });
  console.log(`[${scenario}] context ${res.status} interaction=${interactionId} draft=${isDraftArg}`);
  if (!res.ok) { console.log((await res.text()).slice(0, 300)); process.exit(1); }

  const ws = new WebSocket(`${WS_BASE}/simulator?sessionId=${sessionId}`, { headers: { Origin: ORIGIN } });
  await new Promise((ok, bad) => { ws.once('open', ok); ws.once('error', bad); });
  try { transcript.push({ who: 'agent', text: agentText(await waitForAgent(ws, 20000)) }); } catch { console.log('(no greeting)'); }

  const probe = scenario.startsWith('probe:');
  let text = probe ? scenario.slice(6) : OPENERS[scenario];
  let exit = null;
  for (let turn = 0; text && turn < 14; turn++) {
    const p = waitForAgent(ws, 120000);
    ws.send(JSON.stringify({ id: `user-${Date.now()}`, text, sender: 'user', timestamp: new Date().toISOString(),
      account_id: ACCOUNT, agent_system_id: SYSTEM_ID, interaction_id: interactionId, session_id: sessionId, room_id: 'sample room_id' }));
    const shown = text === PHONE ? '<test phone>' : /^\d{3} \d{3}$/.test(text) && scenario !== 'lockout' ? '<correct code>' : text;
    transcript.push({ who: 'user', text: shown });
    console.log(`  USER:  ${shown}`);
    let r;
    try { r = await p; } catch (e) { console.log(`  AGENT: (${e.message})`); exit = { type: 'timeout' }; break; }
    const t = agentText(r);
    exit = exitOf(r);
    transcript.push({ who: 'agent', text: t, exit });
    console.log(`  AGENT: ${t}${exit ? `  [END: ${JSON.stringify(exit)}]` : ''}`);
    if (exit || probe) break;
    text = nextUserMessage(t);
  }
  ws.close();
  // Never store the test phone in the run file.
  const scrub = (s) => s.split(PHONE).join('<test phone>').split(PHONE.slice(1)).join('<test phone>');
  writeFileSync(outJson, scrub(JSON.stringify({ interactionId, sessionId, systemId: SYSTEM_ID, draft: isDraftArg === 'true', scenario, bookDate: BOOK_DATE, transcript, exit, records }, null, 2)));
  console.log(`[${scenario}] saved ${records.length} records`);
})().catch(e => { console.error(String(e).slice(0, 300)); process.exit(1); });
