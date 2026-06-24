import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/types";

export type Restaurant = Tables<"restaurants">;
export type ServiceWindow = Tables<"service_windows">;
export type TimeSlot = Tables<"time_slots">;
export type Member = Tables<"members">;
export type Reservation = Tables<"reservations">;

export type DB = SupabaseClient<Database>;

/** Restaurants the logged-in agent may access (RLS returns only assigned ones). */
export async function getAssignedRestaurants(supabase: DB): Promise<Restaurant[]> {
  const { data, error } = await supabase
    .from("restaurants")
    .select("*")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function getRestaurant(
  supabase: DB,
  restaurantId: string,
): Promise<Restaurant | null> {
  const { data, error } = await supabase
    .from("restaurants")
    .select("*")
    .eq("id", restaurantId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Seating windows for a restaurant, keyed by Postgres dow. */
export async function getServiceWindows(
  supabase: DB,
  restaurantId: string,
): Promise<ServiceWindow[]> {
  const { data, error } = await supabase
    .from("service_windows")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("day_of_week")
    .order("open_time");
  if (error) throw error;
  return data ?? [];
}

/** Time slots for a restaurant on a date, ordered by time. */
export async function getTimeSlots(
  supabase: DB,
  restaurantId: string,
  slotDate: string,
): Promise<TimeSlot[]> {
  const { data, error } = await supabase
    .from("time_slots")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("slot_date", slotDate)
    .order("slot_time");
  if (error) throw error;
  return data ?? [];
}

export type ReservationWithMember = Reservation & {
  members: Pick<
    Member,
    "first_name" | "last_name" | "member_number" | "phone"
  > | null;
};

/** Reservations for a restaurant on a date, newest-booked first, with member info. */
export async function getReservations(
  supabase: DB,
  restaurantId: string,
  slotDate: string,
): Promise<ReservationWithMember[]> {
  const { data, error } = await supabase
    .from("reservations")
    .select(
      "*, members(first_name, last_name, member_number, phone)",
    )
    .eq("restaurant_id", restaurantId)
    .eq("slot_date", slotDate)
    .order("slot_time")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ReservationWithMember[];
}

/** Search members by name, member number, or phone (case-insensitive). */
export async function searchMembers(
  supabase: DB,
  term: string,
  limit = 12,
): Promise<Member[]> {
  let query = supabase.from("members").select("*");
  const t = term.trim();
  if (t.length > 0) {
    const like = `%${t}%`;
    query = query.or(
      `first_name.ilike.${like},last_name.ilike.${like},member_number.ilike.${like},phone.ilike.${like}`,
    );
  }
  const { data, error } = await query
    .order("last_name")
    .order("first_name")
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
