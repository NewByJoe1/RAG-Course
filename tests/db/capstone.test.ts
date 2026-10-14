import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./pglite";

const ALICE = "00000000-0000-0000-0000-00000000ca01";
const BOB = "00000000-0000-0000-0000-00000000ca02";
const REVIEWER = "00000000-0000-0000-0000-00000000ca03";
const FIVE = ["recall", "citation", "isolation", "nightly", "kill_switch"];

let t: TestDb;
const q = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => t.db.query<T>(sql, params);
const asUser = <T>(id: string, fn: () => Promise<T>) => t.as("authenticated", id, fn);

/** What the poll-ci function does with the service role. */
async function serviceUpsert(userId: string, branch: string, criteria: string[], ci = "success") {
  await t.as("service_role", null, () =>
    q(
      `insert into public.capstone_checks (user_id, check_key, ci_status, criteria_met, last_run_at)
       values ($1, $2, $3, $4, now())
       on conflict (user_id, check_key) do update set ci_status = excluded.ci_status, criteria_met = excluded.criteria_met`,
      [userId, branch, ci, criteria],
    ),
  );
}

beforeAll(async () => {
  t = await createTestDb();
  for (const [id, email] of [
    [ALICE, "alice@example.com"],
    [BOB, "bob@example.com"],
    [REVIEWER, "rev@example.com"],
  ]) {
    await t.createUser(id, email);
  }
  await q(`update public.profiles set role = 'admin' where id = $1`, [REVIEWER]);
  // The service role bypasses RLS in Supabase; mirror its table grants here.
  await q(`grant select, insert, update, delete on public.capstone_checks to service_role`);
});

describe("github_repo", () => {
  it("lets a learner link a repo as owner/name", async () => {
    const r = await asUser(ALICE, () => q(`update public.profiles set github_repo = 'alice/rag-capstone' where id = $1 returning github_repo`, [ALICE]));
    expect(r.rows).toEqual([{ github_repo: "alice/rag-capstone" }]);
  });

  it.each(["alice", "alice/rag/x", "-alice/x", "alice/..", "https://github.com/alice/x"])("rejects %s", async (bad) => {
    await expect(asUser(BOB, () => q(`update public.profiles set github_repo = $1 where id = $2`, [bad, BOB]))).rejects.toThrow(/check constraint/);
  });

  it("allows one learner per repo, ignoring case", async () => {
    await expect(asUser(BOB, () => q(`update public.profiles set github_repo = 'Alice/RAG-Capstone' where id = $1`, [BOB]))).rejects.toThrow(
      /profiles_github_repo_key/,
    );
  });
});

describe("capstone_checks access", () => {
  it("is written by the service role and read-only for learners", async () => {
    await serviceUpsert(ALICE, "main", FIVE);
    const mine = await asUser(ALICE, () => q<{ check_key: string }>(`select check_key from public.capstone_checks`));
    expect(mine.rows).toEqual([{ check_key: "main" }]);

    await expect(
      asUser(ALICE, () => q(`update public.capstone_checks set criteria_met = array['defence'] where user_id = $1`, [ALICE])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(BOB, () => q(`insert into public.capstone_checks (user_id, check_key, criteria_met) values ($1, 'main', $2)`, [BOB, [...FIVE, "defence"]])),
    ).rejects.toThrow(/permission denied/);
    await expect(asUser(ALICE, () => q(`delete from public.capstone_checks`))).rejects.toThrow(/permission denied/);
  });

  it("hides other learners' rows, but reviewers see everyone's", async () => {
    expect((await asUser(BOB, () => q(`select 1 from public.capstone_checks`))).rows).toHaveLength(0);
    expect((await asUser(REVIEWER, () => q(`select 1 from public.capstone_checks`))).rows).toHaveLength(1);
  });

  it("only accepts the 12 branches and known criteria, with defence on main only", async () => {
    await expect(serviceUpsert(ALICE, "feature-x", [])).rejects.toThrow(/capstone_checks_branch/);
    await expect(serviceUpsert(ALICE, "rerank", ["vibes"])).rejects.toThrow(/criteria_met/);
    await expect(serviceUpsert(ALICE, "rerank", ["defence"])).rejects.toThrow(/capstone_checks_defence_on_main/);
  });
});

describe("defence", () => {
  // Recording defences (reviewer screen) is covered in defence.test.ts.
  it("can no longer be set through the removed admin shortcut", async () => {
    await expect(asUser(REVIEWER, () => q(`select public.set_capstone_defence($1, true)`, [ALICE]))).rejects.toThrow(/does not exist/);
  });
});

describe("claim_capstone_mastery (Module 12)", () => {
  it("does nothing until all six criteria are met on main", async () => {
    const r = await asUser(ALICE, () => q<{ at: string | null }>(`select public.claim_capstone_mastery() as at`));
    expect(r.rows[0].at).toBeNull();
    expect((await q(`select 1 from public.progress where user_id = $1 and module_id = 'm12'`, [ALICE])).rows).toHaveLength(0);
  });

  it("ignores criteria met on other branches", async () => {
    await serviceUpsert(BOB, "rerank", FIVE);
    const r = await asUser(BOB, () => q<{ at: string | null }>(`select public.claim_capstone_mastery() as at`));
    expect(r.rows[0].at).toBeNull();
  });

  it("records mastered_at once all six are met, and keeps the first timestamp", async () => {
    // Defence arrives via a recorded defence; here the service role sets it directly.
    await serviceUpsert(ALICE, "main", [...FIVE, "defence"]);
    const first = await asUser(ALICE, () => q<{ at: Date }>(`select public.claim_capstone_mastery() as at`));
    expect(first.rows[0].at).not.toBeNull();

    const row = await q<{ status: string; mastered_at: Date }>(`select status, mastered_at from public.progress where user_id = $1 and module_id = 'm12'`, [ALICE]);
    expect(row.rows[0].status).toBe("completed");

    await q(`update public.progress set mastered_at = mastered_at - interval '1 day' where user_id = $1 and module_id = 'm12'`, [ALICE]);
    const again = await asUser(ALICE, () => q<{ at: Date }>(`select public.claim_capstone_mastery() as at`));
    const stored = await q<{ mastered_at: Date }>(`select mastered_at from public.progress where user_id = $1 and module_id = 'm12'`, [ALICE]);
    expect(new Date(again.rows[0].at).getTime()).toBe(new Date(stored.rows[0].mastered_at).getTime());
  });

  it("can't be written by learners directly", async () => {
    await expect(
      asUser(BOB, () => q(`insert into public.progress (module_id, mastered_at) values ('m12', now())`)),
    ).rejects.toThrow(/permission denied/);
    await expect(asUser(ALICE, () => q(`update public.progress set mastered_at = now() where module_id = 'm12'`))).rejects.toThrow(/permission denied/);
  });

  it("requires a signed-in learner", async () => {
    await expect(t.as("anon", null, () => q(`select public.claim_capstone_mastery()`))).rejects.toThrow(/permission denied/);
  });
});

describe("changing repos", () => {
  it("clears every check recorded for the old repo, including defence", async () => {
    expect((await q(`select 1 from public.capstone_checks where user_id = $1`, [ALICE])).rows.length).toBeGreaterThan(0);
    await asUser(ALICE, () => q(`update public.profiles set github_repo = 'alice/another-repo' where id = $1`, [ALICE]));
    expect((await q(`select 1 from public.capstone_checks where user_id = $1`, [ALICE])).rows).toHaveLength(0);
  });

  it("keeps checks when other profile fields change", async () => {
    await serviceUpsert(ALICE, "main", FIVE);
    await asUser(ALICE, () => q(`update public.profiles set display_name = 'Al' where id = $1`, [ALICE]));
    expect((await q(`select 1 from public.capstone_checks where user_id = $1`, [ALICE])).rows).toHaveLength(1);
  });
});

describe("capstone unlocks after Module 11", () => {
  const CAROL = "00000000-0000-0000-0000-00000000ca09";
  const gate = () =>
    t.as("authenticated", CAROL, () =>
      q<{ module_id: string; unlocked: boolean; prev_slug: string }>(`select module_id, unlocked, prev_slug from public.module_gate('capstone')`),
    );

  it("is published as m12 and locked until Module 11 is passed", async () => {
    await t.createUser(CAROL, "carol@example.com");
    expect((await gate()).rows).toEqual([{ module_id: "m12", unlocked: false, prev_slug: "legal-embeddings" }]);
    // Passing earlier modules isn't enough.
    await q(`insert into public.progress (user_id, module_id, status, passed_at) values ($1, 'm10', 'completed', now())`, [CAROL]);
    expect((await gate()).rows[0].unlocked).toBe(false);
  });

  it("unlocks once Module 11 is passed", async () => {
    await q(`insert into public.progress (user_id, module_id, status, passed_at) values ($1, 'm11', 'completed', now())`, [CAROL]);
    expect((await gate()).rows[0].unlocked).toBe(true);
  });
});

