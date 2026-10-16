// Shared logic for scripts/create-test-learner.ts and delete-test-learner.ts.
// Takes the Supabase admin (service-role) client as a parameter so it can be
// tested without a live project.

import type { SupabaseClient, User } from "@supabase/supabase-js";

/** Stored in the auth user's app_metadata; the delete script requires it. */
export const TEST_ACCOUNT_MARKER = "rag-course-test-learner";

/** Every table that holds a learner's rows (all cascade from profiles). */
export const LEARNER_TABLES = [
  ["profiles", "id"],
  ["progress", "user_id"],
  ["quiz_attempts", "user_id"],
  ["review_cards", "user_id"],
  ["review_log", "user_id"],
  ["capstone_checks", "user_id"],
  ["capstone_defences", "learner_id"],
  ["explain_back_responses", "user_id"],
] as const;

export type Log = (msg: string) => void;

const isTestAccount = (u: User) => u.app_metadata?.test_account === TEST_ACCOUNT_MARKER;

export async function findUserByEmail(admin: SupabaseClient, email: string): Promise<User | null> {
  const target = email.toLowerCase();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
}

export type CreateOptions = {
  email: string;
  password: string;
  repo: string;
  /** Module ids to mark passed (Modules 1–11). */
  moduleIds: string[];
  /** Unlink the repo from whoever has it (clears their capstone checks). */
  takeOverRepo?: boolean;
  log?: Log;
};

/**
 * Create (or bring up to date) the test learner. Safe to re-run: an existing
 * test account is reused and its password reset to the one given; an
 * existing NON-test account with the same email is never touched.
 */
export async function createTestLearner(admin: SupabaseClient, o: CreateOptions): Promise<{ userId: string; created: boolean }> {
  const log = o.log ?? (() => {});

  // 1. The repo must be free (one learner per repo), unless taking it over.
  // Exact, case-insensitive match (not ILIKE: "_" in a repo name is a LIKE wildcard).
  const { data: linked, error: holderErr } = await admin.from("profiles").select("id, email, github_repo").not("github_repo", "is", null);
  if (holderErr) throw new Error(`profiles: ${holderErr.message}`);
  const holders = (linked ?? []).filter((p) => p.github_repo.toLowerCase() === o.repo.toLowerCase());

  let user = await findUserByEmail(admin, o.email);
  if (user && !isTestAccount(user)) {
    throw new Error(`${o.email} already belongs to a real (non-test) account. Pick another email; nothing was changed.`);
  }
  const others = holders.filter((h) => h.id !== user?.id);
  if (others.length && !o.takeOverRepo) {
    throw new Error(
      `${o.repo} is already linked to ${others.map((h) => h.email ?? h.id).join(", ")} (one learner per repo). ` +
        `Re-run with --take-over-repo to move it (this clears their capstone results), or use a different repo. Nothing was changed.`,
    );
  }

  // 2. The auth account (email confirmed, no email sent), tagged as a test account.
  let created = false;
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: o.email,
      password: o.password,
      email_confirm: true,
      user_metadata: { full_name: "Test Learner" },
      app_metadata: { test_account: TEST_ACCOUNT_MARKER },
    });
    if (error || !data.user) throw new Error(`createUser: ${error?.message ?? "no user returned"}`);
    user = data.user;
    created = true;
    log(`Created auth user ${user.id}`);
  } else {
    const { error } = await admin.auth.admin.updateUserById(user.id, { password: o.password, email_confirm: true });
    if (error) throw new Error(`updateUserById: ${error.message}`);
    log(`Reusing test account ${user.id} (password reset)`);
  }

  // 3. Free the repo if asked, then link it. (The signup trigger made the profile.)
  if (others.length) {
    const { error } = await admin.from("profiles").update({ github_repo: null }).in("id", others.map((h) => h.id));
    if (error) throw new Error(`unlink repo: ${error.message}`);
    log(`Unlinked ${o.repo} from ${others.length} other profile(s)`);
  }
  const { error: profErr } = await admin
    .from("profiles")
    .update({ display_name: "Test Learner", github_repo: o.repo })
    .eq("id", user.id);
  if (profErr) throw new Error(`profile: ${profErr.message}`);
  log(`Linked ${o.repo}`);

  // 4. Mark the modules passed.
  const now = new Date().toISOString();
  const rows = o.moduleIds.map((module_id) => ({
    user_id: user!.id,
    module_id,
    status: "completed",
    started_at: now,
    completed_at: now,
    passed_at: now,
    best_score: 1,
    last_score: 1,
  }));
  const { error: progErr } = await admin.from("progress").upsert(rows, { onConflict: "user_id,module_id" });
  if (progErr) throw new Error(`progress: ${progErr.message}`);
  log(`Marked ${o.moduleIds.length} modules passed: ${o.moduleIds.join(", ")}`);

  return { userId: user.id, created };
}

/** Count the account's rows in every learner table. */
export async function countLearnerRows(admin: SupabaseClient, userId: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const [table, col] of LEARNER_TABLES) {
    const { count, error } = await admin.from(table).select("*", { count: "exact", head: true }).eq(col, userId);
    if (error) throw new Error(`${table}: ${error.message}`);
    counts[table] = count ?? 0;
  }
  return counts;
}

/**
 * Delete the test learner and (by cascade) all its rows, then verify nothing
 * is left. Refuses accounts that aren't tagged as the test learner, and any
 * account that has recorded defences as a reviewer.
 */
export async function deleteTestLearner(
  admin: SupabaseClient,
  o: { email: string; log?: Log },
): Promise<{ deleted: boolean; before: Record<string, number> | null; after: Record<string, number> | null }> {
  const log = o.log ?? (() => {});
  const user = await findUserByEmail(admin, o.email);
  if (!user) {
    log(`No account for ${o.email}; nothing to delete.`);
    return { deleted: false, before: null, after: null };
  }
  if (!isTestAccount(user)) {
    throw new Error(`${o.email} is not tagged as the test learner (app_metadata.test_account). Refusing to delete it.`);
  }

  const { count: reviewed, error: revErr } = await admin
    .from("capstone_defences")
    .select("*", { count: "exact", head: true })
    .eq("reviewer_id", user.id);
  if (revErr) throw new Error(`capstone_defences: ${revErr.message}`);
  if (reviewed) throw new Error(`The test account has recorded ${reviewed} defence(s) as a reviewer; delete those first. Nothing was changed.`);

  const before = await countLearnerRows(admin, user.id);
  log(`Rows before: ${JSON.stringify(before)}`);

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) throw new Error(`deleteUser: ${error.message}`);

  const after = await countLearnerRows(admin, user.id);
  const leftover = Object.entries(after).filter(([, n]) => n > 0);
  if (leftover.length) throw new Error(`Deleted the account but rows remain: ${JSON.stringify(after)}`);
  if (await findUserByEmail(admin, o.email)) throw new Error("The auth account still exists after deletion.");
  log(`Deleted ${user.id}; all learner tables are clean.`);
  return { deleted: true, before, after };
}
