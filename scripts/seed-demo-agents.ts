/**
 * Seed (or reset) the demo agent logins.
 *
 * Auth is app-managed (no Supabase Auth): this upserts `agents` rows with a
 * bcrypt password_hash and links each to a restaurant. Server-only — it lives
 * OUTSIDE the Next.js bundle and uses the service-role key, which never ships to
 * the browser.
 *
 * Run:
 *   SUPABASE_SERVICE_ROLE_KEY=... npm run seed:agents
 * or, with the key already in .env.local (gitignored):
 *   npm run seed:agents
 *
 * Idempotent: re-running resets each demo agent to the password below and
 * re-applies the restaurant link.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

// Minimal .env.local loader so the script works without extra deps.
function loadEnvLocal() {
  try {
    const file = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of file.split("\n")) {
      const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    // No .env.local — rely on the ambient environment.
  }
}

loadEnvLocal();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CECCONIS = "cec0cec0-0000-4000-8000-000000000001";
const PASSWORD = "DemoPass123!";

if (!URL || !SERVICE_KEY) {
  console.error(
    "Missing env. Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
      "(add it to .env.local or pass it inline).",
  );
  process.exit(1);
}

type Demo = {
  email: string;
  fullName: string;
  role: string;
  mustChange: boolean;
};

// alice/bob/carol are all `host` (read-only member directory); their passwords
// may live in a public README. Only the admin can write members / manage agents,
// and the admin is forced to change its password on first login.
const DEMO_AGENTS: Demo[] = [
  { email: "admin@thened-demo.com", fullName: "Avery Stone", role: "admin", mustChange: true },
  { email: "alice@thened-demo.com", fullName: "Alice Hart", role: "host", mustChange: false },
  { email: "bob@thened-demo.com", fullName: "Bob Mensah", role: "host", mustChange: false },
  { email: "carol@thened-demo.com", fullName: "Carol Nguyen", role: "host", mustChange: false },
];

const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const password_hash = await bcrypt.hash(PASSWORD, 10);

  for (const a of DEMO_AGENTS) {
    const { data: agent, error } = await admin
      .from("agents")
      .upsert(
        {
          email: a.email,
          full_name: a.fullName,
          role: a.role,
          password_hash,
          must_change_password: a.mustChange,
          is_active: true,
        },
        { onConflict: "email" },
      )
      .select("id")
      .single();

    if (error || !agent) {
      console.error(`✗ ${a.email}: ${error?.message ?? "upsert failed"}`);
      continue;
    }

    const { error: linkErr } = await admin
      .from("agent_restaurants")
      .upsert(
        { agent_id: agent.id, restaurant_id: CECCONIS },
        { onConflict: "agent_id,restaurant_id" },
      );
    if (linkErr) {
      console.error(`✗ ${a.email}: link — ${linkErr.message}`);
      continue;
    }

    console.log(`✓ ${a.email} — ${a.role}, assigned to Cecconi's`);
  }

  console.log(
    `\nDone. Demo agents use the password: ${PASSWORD}\n` +
      "admin@thened-demo.com must change it on first login.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
