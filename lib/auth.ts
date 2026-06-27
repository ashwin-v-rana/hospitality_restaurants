import { SignJWT, jwtVerify } from "jose";

/**
 * App-managed session. Authentication does NOT use Supabase Auth (GoTrue) — the
 * login flow verifies a bcrypt password_hash on the agents table and issues this
 * signed JWT, stored as an HttpOnly cookie. (fsec/Crestline pattern.)
 *
 * No "server-only" marker: this module is also imported by proxy.ts (edge
 * runtime). It's edge-safe (jose only) and is never imported by a client
 * component. The bcrypt helpers live in auth-server.ts (Node-only) instead.
 */
export const SESSION_COOKIE = "ned_session";
export const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

export type SessionAgent = {
  id: string;
  email: string;
  full_name: string | null;
  role: "host" | "manager" | "admin";
  must_change_password: boolean;
};

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function signSession(agent: SessionAgent): Promise<string> {
  return await new SignJWT({ ...agent })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret());
}

export async function verifySession(
  token: string | undefined,
): Promise<SessionAgent | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      id: payload.id as string,
      email: payload.email as string,
      full_name: (payload.full_name as string | null) ?? null,
      role: payload.role as SessionAgent["role"],
      must_change_password: Boolean(payload.must_change_password),
    };
  } catch {
    return null;
  }
}
