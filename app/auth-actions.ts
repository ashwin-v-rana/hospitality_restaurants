"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword, verifyPassword } from "@/lib/auth-server";
import {
  signSession,
  verifySession,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  type SessionAgent,
} from "@/lib/auth";

export type LoginState = { error: string | null };
export type ChangePasswordState = { error: string | null };

async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/**
 * App-managed login: verify the password against agents.password_hash (bcrypt)
 * and issue a signed session cookie. No Supabase Auth involved.
 */
export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agents")
    .select("id, email, full_name, role, is_active, must_change_password, password_hash")
    .eq("email", email)
    .maybeSingle();

  // Same generic error for every failure mode (no account enumeration).
  if (!data || !data.is_active || !data.password_hash) {
    return { error: "Invalid email or password." };
  }
  const ok = await verifyPassword(password, data.password_hash);
  if (!ok) {
    return { error: "Invalid email or password." };
  }

  await supabase
    .from("agents")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", data.id);

  const agent: SessionAgent = {
    id: data.id,
    email: data.email,
    full_name: data.full_name,
    role: data.role as SessionAgent["role"],
    must_change_password: data.must_change_password,
  };
  await setSessionCookie(await signSession(agent));

  redirect(data.must_change_password ? "/change-password" : "/");
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}

/**
 * Change the signed-in agent's password (also clears must_change_password).
 * Requires the current password.
 */
export async function changePassword(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }
  if (next !== confirm) {
    return { error: "New passwords do not match." };
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agents")
    .select("id, email, full_name, role, password_hash")
    .eq("id", session.id)
    .maybeSingle();
  if (!data || !data.password_hash) redirect("/login");

  const ok = await verifyPassword(current, data.password_hash);
  if (!ok) {
    return { error: "Current password is incorrect." };
  }

  const hash = await hashPassword(next);
  await supabase
    .from("agents")
    .update({ password_hash: hash, must_change_password: false })
    .eq("id", data.id);

  const agent: SessionAgent = {
    id: data.id,
    email: data.email,
    full_name: data.full_name,
    role: data.role as SessionAgent["role"],
    must_change_password: false,
  };
  await setSessionCookie(await signSession(agent));

  redirect("/");
}
