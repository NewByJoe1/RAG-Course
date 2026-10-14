/**
 * Delete the test learner and all its rows (profiles, progress, attempts,
 * review cards and log, capstone checks and defences all cascade), then
 * verify nothing is left. Only deletes an account tagged by
 * create-test-learner.ts.
 *
 *   TEST_LEARNER_EMAIL=you+test-learner@example.com npm run test-learner:delete            (shows what would go)
 *   TEST_LEARNER_EMAIL=you+test-learner@example.com npm run test-learner:delete -- --yes   (deletes)
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { countLearnerRows, deleteTestLearner, findUserByEmail, TEST_ACCOUNT_MARKER } from "./lib/test-learner";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

async function main() {
  const email = process.env.TEST_LEARNER_EMAIL?.trim();
  if (!email) throw new Error("Set TEST_LEARNER_EMAIL to the test account's email.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  if (!process.argv.includes("--yes")) {
    const user = await findUserByEmail(admin, email);
    if (!user) return console.log(`No account for ${email}.`);
    const tagged = user.app_metadata?.test_account === TEST_ACCOUNT_MARKER;
    console.log(`Would delete ${user.id} (${tagged ? "tagged test account" : "NOT a test account; would refuse"}).`);
    console.log(`Rows: ${JSON.stringify(await countLearnerRows(admin, user.id))}`);
    return console.log("Re-run with --yes to delete.");
  }

  await deleteTestLearner(admin, { email, log: console.log });
}

main().catch((err) => {
  console.error(`Error: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
