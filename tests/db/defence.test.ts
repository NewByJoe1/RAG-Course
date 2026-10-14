import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./pglite";

const REVIEWER = "00000000-0000-0000-0000-0000000000e1";
const REVIEWER_LEARNER = "00000000-0000-0000-0000-0000000000e2"; // a reviewer who also has a capstone repo
const ANA = "00000000-0000-0000-0000-0000000000e3"; // 5/6 from CI, awaiting defence
const BEN = "00000000-0000-0000-0000-0000000000e4"; // repo linked, no CI yet
const CAL = "00000000-0000-0000-0000-0000000000e5"; // ordinary learner with a repo
const DEE = "00000000-0000-0000-0000-0000000000e6"; // learner without a repo
const FIVE = ["recall", "citation", "isolation", "nightly", "kill_switch"];

type Q = { question: string; citation_verified: boolean; passed: boolean; note?: string | null };
const six = (over: Partial<Q>[] = []): Q[] =>
  Array.from({ length: 6 }, (_, i) => ({ question: `Question ${i + 1}`, citation_verified: true, passed: true, note: null, ...(over[i] ?? {}) }));

let t: TestDb;
const q = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => t.db.query<T>(sql, params);
const asUser = <T>(id: string, fn: () => Promise<T>) => t.as("authenticated", id, fn);

/** Record a defence the way the reviewer screen does: a plain insert under RLS. */
const record = (reviewer: string, learner: string, questions: Q[] | unknown, closingPassed = true) =>
  asUser(reviewer, () =>
    q<{ passed: boolean; reviewer_id: string; recorded_at: Date }>(
      `insert into public.capstone_defences (learner_id, questions, closing_passed, closing_note)
       values ($1, $2, $3, 'closing note') returning passed, reviewer_id, recorded_at`,
      [learner, JSON.stringify(questions), closingPassed],
    ),
  ).then((r) => r.rows[0]);

const mainCriteria = async (user: string) =>
  (await q<{ criteria_met: string[] }>(`select criteria_met from public.capstone_checks where user_id = $1 and check_key = 'main'`, [user])).rows[0]
    ?.criteria_met ?? [];
const masteredAt = async (user: string) =>
  (await q<{ mastered_at: Date | null }>(`select mastered_at from public.progress where user_id = $1 and module_id = 'm12'`, [user])).rows[0]
    ?.mastered_at ?? null;
const history = async (user: string) =>
  (await q<{ passed: boolean }>(`select passed from public.capstone_defences where learner_id = $1 order by recorded_at, id`, [user])).rows.map((r) => r.passed);

beforeAll(async () => {
  t = await createTestDb();
  const users: [string, string, string | null][] = [
    [REVIEWER, "rev@example.com", null],
    [REVIEWER_LEARNER, "rev2@example.com", "rev2/capstone"],
    [ANA, "ana@example.com", "ana/capstone"],
    [BEN, "ben@example.com", "ben/capstone"],
    [CAL, "cal@example.com", "cal/capstone"],
    [DEE, "dee@example.com", null],
  ];
  for (const [id, email, repo] of users) {
    await t.createUser(id, email);
    if (repo) await q(`update public.profiles set github_repo = $1 where id = $2`, [repo, id]);
  }
  await q(`update public.profiles set is_reviewer = true where id in ($1, $2)`, [REVIEWER, REVIEWER_LEARNER]);
  // CI (the poller, as service role) has met the five automatic criteria for Ana.
  await q(`insert into public.capstone_checks (user_id, check_key, ci_status, criteria_met) values ($1, 'main', 'success', $2)`, [ANA, FIVE]);
});

describe("who can record a defence (RLS)", () => {
  it("a learner can't record their own defence", async () => {
    await expect(record(CAL, CAL, six())).rejects.toThrow(/row-level security/);
    expect(await mainCriteria(CAL)).toEqual([]);
  });

  it("a learner can't record anyone else's either", async () => {
    await expect(record(CAL, ANA, six())).rejects.toThrow(/row-level security/);
  });

  it("a reviewer can't record their own defence", async () => {
    await expect(record(REVIEWER_LEARNER, REVIEWER_LEARNER, six())).rejects.toThrow(/row-level security/);
  });

  it("a learner can't make themselves a reviewer", async () => {
    await expect(asUser(CAL, () => q(`update public.profiles set is_reviewer = true where id = $1`, [CAL]))).rejects.toThrow(/permission denied/);
  });

  it("only learners with a linked capstone repo can be defended", async () => {
    await expect(record(REVIEWER, DEE, six())).rejects.toThrow(/row-level security/);
  });

  it("clients can't supply the result, reviewer or timestamp", async () => {
    await expect(
      asUser(REVIEWER, () =>
        q(`insert into public.capstone_defences (learner_id, questions, closing_passed, passed) values ($1, $2, false, true)`, [BEN, JSON.stringify(six())]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(REVIEWER, () =>
        q(`insert into public.capstone_defences (learner_id, questions, closing_passed, reviewer_id) values ($1, $2, true, $3)`, [BEN, JSON.stringify(six()), REVIEWER_LEARNER]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("whether the defence criterion is met", () => {
  it("a failed question means it isn't met", async () => {
    const r = await record(REVIEWER, BEN, six([{}, {}, { passed: false }]));
    expect(r.passed).toBe(false);
    expect(await mainCriteria(BEN)).toEqual([]);
  });

  it("an unverified citation means it isn't met, even if every question passed", async () => {
    const r = await record(REVIEWER, BEN, six([{}, {}, {}, {}, { citation_verified: false }]));
    expect(r.passed).toBe(false);
    expect(await mainCriteria(BEN)).toEqual([]);
  });

  it("a failed closing question means it isn't met", async () => {
    const r = await record(REVIEWER, BEN, six(), false);
    expect(r.passed).toBe(false);
    expect(await mainCriteria(BEN)).toEqual([]);
  });

  it("all six passing with verified citations plus the closing question meets it", async () => {
    const r = await record(REVIEWER, BEN, six());
    expect(r).toMatchObject({ passed: true, reviewer_id: REVIEWER });
    expect(await mainCriteria(BEN)).toEqual(["defence"]); // main row created; CI hasn't reported yet
    expect(await masteredAt(BEN)).toBeNull(); // 1/6 isn't mastery
  });
});

describe("6/6 and mastery", () => {
  it("a passing defence that completes 6/6 records mastery", async () => {
    await record(REVIEWER, ANA, six());
    expect(await mainCriteria(ANA)).toEqual([...FIVE, "defence"]);
    expect(await masteredAt(ANA)).not.toBeNull();
  });

  it("records mastery only once: a second passing defence keeps the first timestamp", async () => {
    const first = await masteredAt(ANA);
    await record(REVIEWER, ANA, six());
    expect(await masteredAt(ANA)).toEqual(first);
    const { rows } = await q(`select 1 from public.progress where user_id = $1 and module_id = 'm12'`, [ANA]);
    expect(rows).toHaveLength(1);
  });

  it("uses the same path as the capstone page (claim_capstone_mastery returns the same timestamp)", async () => {
    const viaPage = await asUser(ANA, () => q<{ at: Date }>(`select public.claim_capstone_mastery() as at`));
    expect(viaPage.rows[0].at).toEqual(await masteredAt(ANA));
  });
});

describe("redoing a defence", () => {
  it("keeps every attempt and lets only the latest count", async () => {
    // Ben so far: fail, fail, fail, pass
    expect(await history(BEN)).toEqual([false, false, false, true]);

    await record(REVIEWER, BEN, six([{ passed: false }]));
    expect(await history(BEN)).toEqual([false, false, false, true, false]);
    expect(await mainCriteria(BEN)).toEqual([]); // latest failed → criterion cleared

    await record(REVIEWER_LEARNER, BEN, six());
    expect(await history(BEN)).toEqual([false, false, false, true, false, true]);
    expect(await mainCriteria(BEN)).toEqual(["defence"]);
  });

  it("records who reviewed each attempt", async () => {
    const { rows } = await q<{ reviewer_id: string }>(`select reviewer_id from public.capstone_defences where learner_id = $1 order by recorded_at desc, id limit 1`, [BEN]);
    expect(rows[0].reviewer_id).toBe(REVIEWER_LEARNER);
  });

  it("history can't be edited or deleted", async () => {
    await expect(asUser(REVIEWER, () => q(`update public.capstone_defences set closing_passed = true where learner_id = $1`, [BEN]))).rejects.toThrow(
      /permission denied/,
    );
    await expect(asUser(REVIEWER, () => q(`delete from public.capstone_defences where learner_id = $1`, [BEN]))).rejects.toThrow(/permission denied/);
  });

  it("a failed redo after mastery clears the criterion but not the recorded mastery", async () => {
    const before = await masteredAt(ANA);
    await record(REVIEWER, ANA, six([{}, { passed: false }]));
    expect(await mainCriteria(ANA)).toEqual(FIVE);
    expect(await masteredAt(ANA)).toEqual(before);
  });
});

describe("validation", () => {
  it.each([
    ["five questions", six().slice(0, 5)],
    ["seven questions", [...six(), six()[0]]],
    ["a blank question", six([{ question: "   " }])],
    ["a missing citation flag", six().map((x, i) => (i === 2 ? { question: x.question, passed: true } : x))],
    ["a non-boolean result", six().map((x, i) => (i === 0 ? { ...x, passed: "yes" } : x))],
    ["not an array", { question: "x" }],
  ])("rejects %s", async (_label, questions) => {
    await expect(record(REVIEWER, BEN, questions)).rejects.toThrow(/capstone_defence_questions_valid|check constraint/);
  });
});

describe("who can read what", () => {
  it("learners can't read defences, even their own", async () => {
    expect((await asUser(ANA, () => q(`select 1 from public.capstone_defences`))).rows).toHaveLength(0);
  });

  it("reviewers can read every defence", async () => {
    const { rows } = await asUser(REVIEWER, () => q<{ n: number }>(`select count(*)::int as n from public.capstone_defences`));
    expect(rows[0].n).toBe(6 + 3); // Ben: 6 attempts; Ana: pass, pass, failed redo
  });

  it("reviewers see learners with a linked repo and their main criteria, but not other learners", async () => {
    const { rows } = await asUser(REVIEWER, () => q<{ id: string }>(`select id from public.profiles order by email`));
    const seen = rows.map((r) => r.id);
    expect(seen).toEqual(expect.arrayContaining([ANA, BEN, CAL, REVIEWER, REVIEWER_LEARNER]));
    expect(seen).not.toContain(DEE);
    const checks = await asUser(REVIEWER, () => q<{ user_id: string }>(`select distinct user_id from public.capstone_checks`));
    expect(checks.rows.map((r) => r.user_id).sort()).toEqual([ANA, BEN].sort());
  });

  it("learners still see only themselves", async () => {
    const { rows } = await asUser(CAL, () => q<{ id: string }>(`select id from public.profiles`));
    expect(rows.map((r) => r.id)).toEqual([CAL]);
    expect((await asUser(CAL, () => q(`select 1 from public.capstone_checks`))).rows).toHaveLength(0);
  });
});
