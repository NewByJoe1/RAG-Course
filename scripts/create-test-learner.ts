/**
 * Create (or refresh) a test learner for checking the reviewer flow:
 * Modules 0–11 passed and a capstone repo linked. Safe to re-run.
 *
 *   TEST_LEARNER_EMAIL=you+test-learner@example.com npm run test-learner:create
 *   … -- --repo=owner/name        repo to link (default NewByJoe1/capstone-test-2)
 *   … -- --take-over-repo         unlink the repo from whoever has it first
 *                                 (clears THEIR capstone results)
 *   … -- --dry-run                check only; change nothing
 *
 * Password: TEST_LEARNER_PASSWORD if set, otherwise a random one is generated
 * and printed here once. Needs NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY (.env.local).
 */
import { randomBytes } from "node:crypto";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { modules } from "../content";
import { normalizeGithubRepo } from "../supabase/functions/_shared/capstone";
import { createTestLearner, findUserByEmail } from "./lib/test-learner";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

async function main() {
  const email = process.env.TEST_LEARNER_EMAIL?.trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Set TEST_LEARNER_EMAIL to the test account's email.");
  const repo = normalizeGithubRepo(opt("repo") ?? process.env.TEST_LEARNER_REPO ?? "NewByJoe1/capstone-test-2");
  if (!repo) throw new Error("--repo must be owner/name.");

  // Modules 0–11: set-up and every published lesson module, not the capstone (m12).
  const moduleIds = modules.filter((m) => m.is_published && m.order_index >= 0 && m.order_index <= 11).map((m) => m.id);
  if (moduleIds.length !== 12) throw new Error(`Expected 12 modules to mark passed, found ${moduleIds.length}.`);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  if (flag("dry-run")) {
    const existing = await findUserByEmail(admin, email);
    const { data } = await admin.from("profiles").select("id, github_repo").not("github_repo", "is", null);
    const holder = (data ?? []).find((p) => p.github_repo.toLowerCase() === repo.toLowerCase() && p.id !== existing?.id);
    console.log(`Dry run: account ${existing ? `exists (${existing.id})` : "would be created"}; ${repo} ${holder ? `is linked to ${holder.id}` : "is free"}; would mark ${moduleIds.join(", ")} passed.`);
    return;
  }

  const generated = !process.env.TEST_LEARNER_PASSWORD;
  const password = process.env.TEST_LEARNER_PASSWORD ?? randomBytes(18).toString("base64url");
  if (password.length < 8) throw new Error("TEST_LEARNER_PASSWORD must be at least 8 characters.");

  const { userId, created } = await createTestLearner(admin, { email, password, repo, moduleIds, takeOverRepo: flag("take-over-repo"), log: console.log });

  console.log(`\n${created ? "Created" : "Updated"} test learner ${userId}`);
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${generated ? password + "   (generated; shown only now)" : "(the TEST_LEARNER_PASSWORD you set)"}`);
  console.log(`  Repo:     ${repo}  (CI results appear after the next 15-minute poll)`);
}

main().catch((err) => {
  console.error(`Error: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
