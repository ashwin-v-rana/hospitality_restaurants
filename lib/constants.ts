/**
 * Business rules shared with the CXA AI agent (CLAUDE.md §6).
 * Keep these identical to the AI agent so the voice agent and this console
 * never oversell a shared slot.
 */

export const SELECTED_RESTAURANT_COOKIE = "ned_restaurant";

export const MAX_PARTY_SIZE = 6;
export const MIN_PARTY_SIZE = 1;

/**
 * When false (default for a staff console), hosts may book walk-ins for "now".
 * When true, mirrors the AI agent's 30-minutes-in-the-future lead-time guard.
 */
export const ENFORCE_LEAD_TIME = false;
export const LEAD_TIME_MINUTES = 30;

/** E.164 — must match the members.phone CHECK constraint. */
export const E164_REGEX = /^\+[1-9]\d{10,14}$/;

/** turn_minutes by party size: ≤2 → 90; ≤4 → 120; 5–6 → 150. */
export function turnMinutes(partySize: number): number {
  if (partySize <= 2) return 90;
  if (partySize <= 4) return 120;
  return 150;
}

/** Round an "HH:MM" string to the nearest lower 15-minute boundary. */
export function roundToGrid(time: string, intervalMinutes = 15): string {
  const [h, m] = time.split(":").map(Number);
  const rounded = Math.floor(m / intervalMinutes) * intervalMinutes;
  return `${String(h).padStart(2, "0")}:${String(rounded).padStart(2, "0")}`;
}

/** Postgres dow (0 = Sunday … 6 = Saturday) for a yyyy-mm-dd date string. */
export function dowFromDate(slotDate: string): number {
  // Parse as local date to avoid TZ drift on a date-only value.
  const [y, mo, d] = slotDate.split("-").map(Number);
  return new Date(y, mo - 1, d).getDay();
}

/** "HH:MM:SS" or "HH:MM" -> "h:mm AM/PM". */
export function formatTime(time: string): string {
  const [hStr, mStr] = time.split(":");
  let h = Number(hStr);
  const m = mStr ?? "00";
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

/** yyyy-mm-dd -> "Tue, Jun 24" style display. */
export function formatDate(slotDate: string): string {
  const [y, mo, d] = slotDate.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("en-GB", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * "MMM D, HH:MM UTC" from a stored timestamptz string. Parsed directly from the
 * string (no Date/timezone) so server and client render identically — no
 * hydration mismatch. auth_events.created_at is stored in UTC.
 */
export function formatEventTime(iso: string | null): string {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return iso;
  const [, , mo, d, h, min] = m;
  return `${MONTHS[Number(mo) - 1]} ${Number(d)}, ${h}:${min} UTC`;
}

/** True if an ISO timestamp falls within the last `hours` hours. */
export function isWithinHours(iso: string | null, hours: number): boolean {
  if (!iso) return false;
  return Date.parse(iso) >= Date.now() - hours * 60 * 60 * 1000;
}

/** Local yyyy-mm-dd for "today" (used as the default availability date). */
export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}
