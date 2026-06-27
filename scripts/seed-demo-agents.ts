/**
 * Seed the demo agent logins.
 *
 * Server-only — this lives OUTSIDE the Next.js bundle and uses the service-role
 * key (CLAUDE.md §8: the key never ships to the browser). It creates Supabase
 * Auth users, then links each to an `agents` profile + `agent_restaurants`.
 *
 * Run:
 *   SUPABASE_SERVICE_ROLE_KEY=... npm run seed:agents
 * or, with the key already in .env.local (gitignored):
 *   npm run seed:agents
 *
 * Idempotent: re-running skips users that already exist and re-applies links.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

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

type Demo = { email: string; fullName: string; role: string };

// alice/bob/carol are all `host` (read-only member directory). Their passwords
// may live in a public README, so none of them can write members or reach the
// admin tools — only the admin account (whose password should be rotated) can.
const DEMO_AGENTS: Demo[] = [
  { email: "admin@thened-demo.com", fullName: "Avery Stone", role: "admin" },
  { email: "alice@thened-demo.com", fullName: "Alice Hart", role: "host" },
  { email: "bob@thened-demo.com", fullName: "Bob Mensah", role: "host" },
  { email: "carol@thened-demo.com", fullName: "Carol Nguyen", role: "host" },
];

const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserIdByEmail(email: string): Promise<string | null> {
  // listUsers is paginated; scan a few pages for the demo set.
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const hit = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  return null;
}

async function main() {
  for (const a of DEMO_AGENTS) {
    let userId: string | null = null;

    const { data, error } = await admin.auth.admin.createUser({
      email: a.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: a.fullName },
    });

    if (error) {
      // Most likely "already registered" — look the user up and continue.
      userId = await findUserIdByEmail(a.email);
      if (!userId) {
        console.error(`✗ ${a.email}: ${error.message}`);
        continue;
      }
      console.log(`• ${a.email}: auth user already exists`);
    } else {
      userId = data.user.id;
      console.log(`✓ ${a.email}: auth user created`);
    }

    const { error: agentErr } = await admin
      .from("agents")
      .upsert(
        { id: userId, email: a.email, full_name: a.fullName, role: a.role },
        { onConflict: "id" },
      );
    if (agentErr) {
      console.error(`✗ ${a.email}: agents upsert — ${agentErr.message}`);
      continue;
    }

    const { error: linkErr } = await admin
      .from("agent_restaurants")
      .upsert(
        { agent_id: userId, restaurant_id: CECCONIS },
        { onConflict: "agent_id,restaurant_id" },
      );
    if (linkErr) {
      console.error(`✗ ${a.email}: link — ${linkErr.message}`);
      continue;
    }

    console.log(`  ↳ ${a.role}, assigned to Cecconi's`);
  }

  console.log(
    `\nDone. All demo agents use the password: ${PASSWORD}\n` +
      "Log in at /login (admin@thened-demo.com sees the Agents admin page).",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
