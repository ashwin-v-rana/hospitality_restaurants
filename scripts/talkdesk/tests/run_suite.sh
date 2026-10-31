#!/bin/zsh
# Usage: run_suite.sh <run name> [draft|live]   (results in tests/runs/<run name>; default draft)
# REAL TOOLS: sign-in sends real SMS codes to the test member; book/update/cancel write
# real reservations and send real email + SMS. The booking chain only touches its own
# test booking (party of 2, TD_BOOK_DAYS ahead) and ends with it cancelled.
cd "${0:A:h}"; OUT=runs/${1:?usage: run_suite.sh <name> [draft|live]}; mkdir -p $OUT
DRAFT=true; [[ $2 == live ]] && DRAFT=false
rm -f .tok; node td_sim.mjs --token || exit 1   # fresh token: a cached one can expire mid-run
run() { node td_sim.mjs $DRAFT $OUT/$1.json "$2" > $OUT/$1.log 2>&1 }
for i in 1 2 3; do
  run probe_book_$i    "probe:Can I book a table for 2 on Friday at 8pm?" &
  run probe_cancel_$i  "probe:I need to cancel my reservation." &
  run probe_change_$i  "probe:Can I change my booking to 9pm?" &
  run probe_lookup_$i  "probe:What time is my table on Saturday?" &
  run probe_person_$i  "probe:Can I speak to someone at the restaurant?" &
  wait
done
run person_1 person & run private_event_1 private_event & run large_party_1 large_party & wait
run lockout_1 lockout
# Booking chain on the one test booking: book -> update -> lookup -> cancel.
for c in ${=CHAINS:-1}; do
  run book_$c book && run update_$c update && run lookup_$c lookup && run cancel_$c cancel
done
python3 -I td_score.py $OUT/*.json | grep -E '^(PASS|FAIL)|passed$'
