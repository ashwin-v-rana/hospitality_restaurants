"""Score td_sim.mjs runs (ported from Crestline). Usage: python3 -I td_score.py <run.json> [...]

Prints per run: PASS/FAIL, why, then the agent hops and tool calls.
"""
import json, re, sys

ORCH = 'Cecconi Concierge'
PROBE_WANT = {  # first-message keyword -> the sub-agent that owns the request
    'book a table': 'Booking Agent', 'cancel': 'Reservation Agent', 'change': 'Update Agent',
    'move': 'Update Agent', 'what time is my table': 'Reservation Agent', 'reservations coming up': 'Reservation Agent',
    'speak to': 'Escalation Agent', 'private': 'Escalation Agent',
}
# Lines the Orchestrator may write itself (greeting, clarifier, anything else, closing, handoff, auth fail).
OWN_LINES = (r"welcome to Cecconi|anything else I can help|book a table, or cancel|lovely day|"
             r"pass you to the team|wasn't able to (verify|find)|could you tell me a bit more")
WRITE_RE = r'(INSERT INTO|UPDATE)\s+(public\.)?(reservations|time_slots)'


def name(x):
    return (x or {}).get('name')


def hops(recs):
    out = []
    for r in recs:
        m, tc = r.get('message'), r.get('tool_call')
        if r['record_type'] == 'MESSAGE' and m:
            out.append(f"{name(m.get('from_agent')) or m.get('from')}->{name(m.get('to_agent')) or m.get('to')}")
        elif r['record_type'] == 'TOOL_CALL' and tc:
            out.append(f"[{(tc.get('tool') or {}).get('tool_name') or tc.get('tool_name') or r.get('llm_action')}]")
        if r.get('exit'):
            out.append(f"EXIT:{r['exit'].get('type')}/{r.get('llm_action')}")
    return out


def msgs(recs, src=None, dst=None):
    for r in recs:
        m = r.get('message')
        if r['record_type'] != 'MESSAGE' or not m:
            continue
        s, d = name(m.get('from_agent')) or m.get('from'), name(m.get('to_agent')) or m.get('to')
        if (src is None or s == src) and (dst is None or d == dst):
            yield s, d, m.get('msg') or '', r


def said(recs, agent, pattern):
    return any(re.search(pattern, t, re.I) for _, _, t, _ in msgs(recs, src=agent))


def tools(recs):
    return [(tc.get('tool') or {}).get('tool_name') or tc.get('tool_name') for r in recs
            if r['record_type'] == 'TOOL_CALL' and (tc := r.get('tool_call'))]


def relay_faults(recs):
    """Orchestrator faults any scenario can hit (same definitions as Crestline):
    answered_for_customer, list_dropped, skipped_escalation, own_question,
    code_dropped (a CEC- confirmation code the sub-agent gave did not reach the customer)."""
    faults, pending, escalate_due = [], None, False
    for s, d, msg, r in msgs(recs):
        if s not in (ORCH, 'USER') and d == ORCH:
            pending = msg
            escalate_due = bool(re.search(r'"failure_reason":\s*"max_attempts"|"status":\s*"escalate"', msg))
        elif s == ORCH and d == 'USER':
            if escalate_due and not r.get('exit'):
                faults.append('skipped_escalation')
            escalate_due = False
            # A confirmation code the sub-agent gave must reach the customer.
            if pending and any(code not in msg for code in re.findall(r'CEC-\d+', pending)):
                faults.append('code_dropped')
            if pending and len(re.findall(r'^\s*\d+\.', pending, re.M)) >= 2 and len(re.findall(r'^\s*\d+\.', msg, re.M)) < 2:
                faults.append('list_dropped')
            if not pending and not re.search(OWN_LINES, msg, re.I) and '?' in msg:
                faults.append('own_question')
            pending = None
        elif s == ORCH and d not in ('USER', ORCH) and pending and '?' in pending \
                and (not re.match(r'\s*\{|STATUS:', pending) or 'ASK_CUSTOMER' in pending):
            faults.append('answered_for_customer')
            pending = None
        elif s == 'USER':
            pending = None
    return faults


def score(d):
    sc, recs = d['scenario'], d['records']
    h = hops(recs)
    hs = ' | '.join(h)
    ex = d.get('exit') or {}
    escalated = ex.get('type') == 'escalate'
    heard = ' '.join(t['text'] or '' for t in d['transcript'] if t['who'] == 'agent')
    digits = re.sub(r'\D', '', heard)
    phone_given = '442079460123' in digits or '02079460123' in digits
    reached_esc = f'{ORCH}->Escalation Agent' in hs
    loaded = bool(re.search(r'\[Load[ _]Transfer[ _]Data\]', hs))
    used = tools(recs)
    if sc == 'book':
        ok = said(recs, 'Booking Agent', r'booked under confirmation code') and 'send_email' in used and 'send_confirmation_sms' in used
        why = f"booked={said(recs, 'Booking Agent', r'booked under')} email={'send_email' in used} sms={'send_confirmation_sms' in used}"
    elif sc == 'update':
        ok = said(recs, 'Update Agent', r'is now a table for|has been updated')
        why = 'updated' if ok else 'NOT updated'
    elif sc == 'lookup':
        ok = said(recs, 'Reservation Agent', r'table for') and re.search(r'table for', heard, re.I) is not None
        why = 'listed' if ok else 'NOT listed'
    elif sc == 'cancel':
        ok = said(recs, 'Reservation Agent', r'is cancelled')
        why = 'cancelled' if ok else 'NOT cancelled'
    elif sc == 'large_party':
        wrote = any(re.search(r'INSERT INTO\s+(public\.)?reservations', json.dumps(r.get('tool_call') or {}), re.I) for r in recs)
        ok = phone_given and not wrote
        why = f"phone_given={phone_given} wrote={wrote}"
    elif sc in ('person', 'private_event', 'lockout'):
        # Draft (v8+) must hand off for real; the v7 baseline only gave the phone number.
        ok = reached_esc and ((escalated and loaded) if d.get('draft') else (escalated or phone_given))
        why = f"escalation_agent={reached_esc} transfer={escalated} transfer_data={loaded} phone_given={phone_given}"
    else:  # probe
        first = sc[6:].lower()
        want = next((v for k, v in PROBE_WANT.items() if k in first), None)
        first_hop = next((x for x in h if x.startswith(f'{ORCH}->') and not x.endswith('USER')), None)
        routed = bool(first_hop)
        right = bool(first_hop and want and (first_hop.endswith(want) or first_hop.endswith('Auth Agent')))
        ok = routed and right
        why = f"first hop {first_hop or 'none (answered customer)'}; want {want}"
    faults = relay_faults(recs)
    said_yes = False
    for r in recs:
        m, tc = r.get('message'), r.get('tool_call')
        if m and m.get('from') == 'USER' and re.match(r'\s*yes', m.get('msg') or '', re.I):
            said_yes = True
        if tc and re.search(WRITE_RE, tc.get('arguments') or '', re.I) and not said_yes:
            faults.append('wrote_without_confirmation')
    if faults:
        ok, why = False, why + '; ' + ', '.join(sorted(set(faults)))
    if re.search(r'cannot handle your request', heard, re.I):
        ok, why = False, why + '; platform fallback "Sorry..."'
    return ok, why, hs


if __name__ == '__main__':
    npass = 0
    for f in sys.argv[1:]:
        d = json.load(open(f))
        ok, why, hs = score(d)
        npass += ok
        print(f"{'PASS' if ok else 'FAIL'}  {f.split('/')[-1]:<24} {d['interactionId'][:8]}  {why}")
        print('      ', hs[:900])
    print(f'{npass}/{len(sys.argv) - 1} passed')
