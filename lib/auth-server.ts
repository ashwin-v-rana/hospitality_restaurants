import "server-only";
import bcrypt from "bcryptjs";

/**
 * Password hashing for the agents table. Kept separate from lib/auth.ts because
 * bcryptjs is Node-only — the JWT helpers in auth.ts are edge-safe (used by the
 * proxy), this file is only imported from Node server actions.
 */
const ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? "10");

export async function hashPassword(plain: string): Promise<string> {
  return await bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return await bcrypt.compare(plain, hash);
}
