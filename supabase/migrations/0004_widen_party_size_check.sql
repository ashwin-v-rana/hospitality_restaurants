-- 0004_widen_party_size_check.sql
-- Widen the reservations.party_size CHECK from 1..6 to 1..12.
--
-- Constraint only: create_reservation, MAX_PARTY_SIZE (lib/constants.ts) and
-- the CXA agent prompts still cap bookings at 6, so 7..12 is not yet bookable
-- through either surface.

alter table public.reservations
  drop constraint reservations_party_size_check;

alter table public.reservations
  add constraint reservations_party_size_check
  check (party_size between 1 and 12);
