/** Isolated development project ONLY.
 * Server-only environment variables: DEV_SUPABASE_URL, DEV_SERVICE_ROLE_KEY.
 * Set them in your terminal; never prefix a service key with VITE_ or commit it.
 * Run: node scripts/seed-demo.mjs --development-only
 * The script explicitly creates confirmed demo identities. It is NOT an Auth
 * testing substitute. Use real approved inboxes to verify production OTP.
 */
import { createClient } from "@supabase/supabase-js";
if (!process.argv.includes("--development-only"))
  throw new Error(
    "Pass --development-only for an isolated development project.",
  );
const url = process.env.DEV_SUPABASE_URL,
  key = process.env.DEV_SERVICE_ROLE_KEY;
if (!url || !key)
  throw new Error(
    "Set DEV_SUPABASE_URL and DEV_SERVICE_ROLE_KEY in a private terminal session.",
  );
const client = createClient(url, key, { auth: { persistSession: false } });
const campus = "20000000-0000-0000-0000-000000000001";
async function requireResult(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
const data = await requireResult(
  await client.auth.admin.createUser({
    email: `demo-${Date.now()}@cuilahore.edu.pk`,
    email_confirm: true,
    user_metadata: { development_fixture: true },
  }),
);
const uid = data.user.id;
await requireResult(
  await client
    .from("user_accounts")
    .insert({
      user_id: uid,
      campus_id: campus,
      email_domain: "cuilahore.edu.pk",
      registration_number: `DEMO-${Date.now()}`,
      graduation_year: 2028,
    }),
);
await requireResult(
  await client
    .from("profiles")
    .insert({
      id: uid,
      campus_id: campus,
      full_name: "Demo Student (test data)",
      department: "Computer Science",
      verified_at: new Date().toISOString(),
    }),
);
// No callable phone number is fabricated. Contact lookup deliberately remains unavailable.
const shared = {
  user_id: uid,
  campus_id: campus,
  description:
    "DEMONSTRATION ONLY. This is a development fixture, not a real student listing.",
  preferred_meetup_spot: "Library entrance",
};
await requireResult(
  await client.from("listings").insert([
    {
      ...shared,
      type: "SALE",
      title: "DEMO — Data Structures textbook",
      category: "books-notes",
      condition: "USED",
      price: 1200,
    },
    {
      ...shared,
      type: "RENT",
      title: "DEMO — Scientific calculator rental",
      category: "calculators",
      condition: "LIKE_NEW",
      rental_rate_daily: 150,
      deposit: 1000,
    },
    {
      ...shared,
      type: "REQUEST",
      title: "DEMO — Looking for a lab coat",
      category: "lab-equipment",
      offered_budget: 700,
      need_type: "BUY",
    },
  ]),
);
console.log(
  "Three labeled demo listings created in the specified development project. No phone number was seeded.",
);
