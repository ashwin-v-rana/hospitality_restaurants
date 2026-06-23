-- The Ned — add real demo accounts (standalone, re-runnable)
--
-- Paste into the Supabase SQL editor (or run via the MCP `execute_sql` tool).
-- Kept SEPARATE from seed.sql on purpose: these are real people.
--
-- !!  seed.sql TRUNCATES the members table on every run, which WIPES these rows.
-- !!  Re-run THIS script after any re-seed to restore them.
--
-- Re-runnable: upserts on the unique `phone`, so running it twice is a no-op /
-- refresh. Member numbers use the NED-2000xx block, OUTSIDE the seeded
-- NED-1004xx range, so nothing collides.

-- ===== Team members (real, OTP-reachable phones) =====
insert into public.members (member_number, first_name, last_name, phone, email) values
  ('NED-200001','Ashish','Bhatia','+12146685171','ashwin.rana@talkdesk.com'),
  ('NED-200002','Suresh','Bhandarkar','+16463980879','suresh.bhandarkar@talkdesk.com'),
  ('NED-200003','Niall','Madden','+447300338516','niall.madden@talkdesk.com'),
  ('NED-200004','Scott','Baron','+447511649716','scott.baron@talkdesk.com'),
  ('NED-200005','Andy','Pham','+19162585820','andy.t.pham@talkdesk.com'),
  ('NED-200006','Richard','Nelson','+447468416144','richard.nelson@talkdesk.com'),
  ('NED-200007','Narcis','Gimenez','+34607679186','narcis.gimenez@talkdesk.com'),
  ('NED-200008','Jamie','Hughes','+442031487632','jamie@greenip.co.uk'),
  ('NED-200009','Craig','Newell','+441202165100','Craig@greenip.co.uk')
on conflict (phone) do update
  set member_number = excluded.member_number,
      first_name    = excluded.first_name,
      last_name     = excluded.last_name,
      email         = excluded.email;

-- ===== Customers (fictional, Ofcom range) =====
-- (pending — tell me how many, or paste them as `Name | phone | email`)
