import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, insert, type TestDb } from "./pglite";
import { modules } from "@/content";
import { PASS_THRESHOLD } from "@/lib/course/quiz";
import { decideAccess } from "@/lib/auth/routes";

const ALICE = "00000000-0000-0000-0000-00000000000a";
const BOB = "00000000-0000-0000-0000-00000000000b";

const m01 = modules.find((m) => m.id === "m01")!;

/** Correct response for a content quiz item. */
function correctResponse(q: (typeof m01.quiz_items)[number]) {
  if (q.kind === "single_choice") return { choice: q.answer.choice };
  if (q.kind === "multi_choice") return { choices: [...q.answer.choices].reverse() };
  return { text: q.answer.accepted[0].toUpperCase() };
}
const wrongResponse = { choice: "zzz", choices: ["zzz"], text: "zzz" };

/** Responses with the first `n` items right and the rest wrong. */
function responsesWithCorrect(n: number) {
  return Object.fromEntries(m01.quiz_items.map((q, i) => [q.id, i < n ? correctResponse(q) : wrongResponse]));
}

type QuizResult = { correct: number; total: number; score: number; passed: boolean; best_score: number; passed_at: string | null };

let t: TestDb;

async function submit(userId: string, moduleId: string, responses: Record<string, unknown>) {
  return t.as("authenticated", userId, async () => {
    const { rows } = await t.db.query<{ r: QuizResult }>(`select public.submit_module_quiz($1, $2) as r`, [
      moduleId,
      JSON.stringify(responses),
    ]);
    const r = rows[0].r;
    return { ...r, score: Number(r.score), best_score: Number(r.best_score) };
  });
}

async function gate(userId: string, slug: string) {
  return t.as("authenticated", userId, async () => {
    const { rows } = await t.db.query<{ unlocked: boolean; prev_slug: string | null }>(
      `select unlocked, prev_slug from public.module_gate($1)`,
      [slug],
    );
    return rows[0];
  });
}

beforeAll(async () => {
  t = await createTestDb();
  await t.createUser(ALICE, "alice@example.com");
  await t.createUser(BOB, "bob@example.com");

  // A second published module (5 questions, so 4/5 lands exactly on 80%)
  // and an unpublished one between them that gating must skip.
  await insert(t.db, "modules", { id: "m02", slug: "draft", order_index: 2, title: "Draft", is_published: false });
  await insert(t.db, "modules", { id: "m03", slug: "chunking", order_index: 3, title: "Chunking", is_published: true });
  for (let i = 1; i <= 5; i++) {
    await insert(t.db, "quiz_items", {
      id: `m03-q0${i}`,
      module_id: "m03",
      order_index: i,
      kind: "single_choice",
      prompt: `Q${i}`,
      choices: [{ id: "a", text: "A" }, { id: "b", text: "B" }],
      answer: { choice: "a" },
    });
  }
});

describe("pass threshold", () => {
  it("matches the app constant", async () => {
    const { rows } = await t.db.query<{ v: string }>(`select public.quiz_pass_threshold()::text as v`);
    expect(Number(rows[0].v)).toBe(PASS_THRESHOLD);
  });
});

describe("grading Module 1 content", () => {
  it("grades every authored answer key as correct", async () => {
    const r = await submit(BOB, "m01", responsesWithCorrect(m01.quiz_items.length));
    expect(r).toMatchObject({ correct: m01.quiz_items.length, total: m01.quiz_items.length, score: 1, passed: true });
  });
});

describe("brand-new learner", () => {
  const NEW = "00000000-0000-0000-0000-0000000000e1";

  it("reaches Module 1 with no progress row, and nothing beyond it", async () => {
    await t.createUser(NEW, "new@example.com");

    const { rows } = await t.db.query(`select 1 from public.progress where user_id = $1`, [NEW]);
    expect(rows).toHaveLength(0);

    const m1 = await gate(NEW, "rag-foundations");
    expect(m1).toEqual({ unlocked: true, prev_slug: null });
    expect(decideAccess({ pathname: "/modules/rag-foundations", signedIn: true, gate: { module_id: "m01", slug: "rag-foundations", ...m1 } })).toEqual({ action: "next" });

    const m3 = await gate(NEW, "chunking");
    expect(m3).toEqual({ unlocked: false, prev_slug: "rag-foundations" });
    expect(decideAccess({ pathname: "/modules/chunking", signedIn: true, gate: { module_id: "m03", slug: "chunking", ...m3 } })).toEqual({
      action: "redirect",
      to: "/modules/rag-foundations?locked=chunking",
    });
  });

  it("can submit the Module 1 quiz, which creates their progress row", async () => {
    const r = await submit(NEW, "m01", responsesWithCorrect(7));
    expect(r.passed).toBe(true);
    const { rows } = await t.db.query<{ status: string }>(`select status from public.progress where user_id = $1`, [NEW]);
    expect(rows).toEqual([{ status: "completed" }]);
  });

  it("returns no row for an unknown module, so the page can 404", async () => {
    const r = await gate(NEW, "does-not-exist");
    expect(r).toBeUndefined();
  });
});

describe("80% pass gate", () => {
  it("locks m03 until m01 is passed, skipping the unpublished module", async () => {
    expect(await gate(ALICE, "rag-foundations")).toEqual({ unlocked: true, prev_slug: null });
    expect(await gate(ALICE, "chunking")).toEqual({ unlocked: false, prev_slug: "rag-foundations" });
  });

  it("refuses quiz submissions for a locked module", async () => {
    await expect(submit(ALICE, "m03", { "m03-q01": { choice: "a" } })).rejects.toThrow(/locked/);
  });

  it("fails below 80% (5/7 = 71%) and keeps the module locked", async () => {
    const r = await submit(ALICE, "m01", responsesWithCorrect(5));
    expect(r).toMatchObject({ correct: 5, total: 7, passed: false, passed_at: null });
    expect(r.score).toBeCloseTo(5 / 7, 3);
    expect((await gate(ALICE, "chunking")).unlocked).toBe(false);
  });

  it("counts unanswered questions as wrong", async () => {
    const all = responsesWithCorrect(7);
    const sixAnswered = Object.fromEntries(Object.entries(all).slice(0, 6));
    const r = await submit(ALICE, "m01", Object.fromEntries(Object.entries(sixAnswered).slice(0, 5)));
    expect(r).toMatchObject({ correct: 5, total: 7, passed: false });
  });

  it("passes at 6/7 (86%), records progress and unlocks the next module", async () => {
    const r = await submit(ALICE, "m01", responsesWithCorrect(6));
    expect(r).toMatchObject({ correct: 6, passed: true });
    expect(r.passed_at).not.toBeNull();
    expect((await gate(ALICE, "chunking")).unlocked).toBe(true);

    const { rows } = await t.db.query<{ status: string; quiz_attempt_count: number; best_score: string }>(
      `select status, quiz_attempt_count, best_score::text from public.progress where user_id = $1 and module_id = 'm01'`,
      [ALICE],
    );
    expect(rows[0]).toMatchObject({ status: "completed", quiz_attempt_count: 3 });
    expect(Number(rows[0].best_score)).toBeCloseTo(6 / 7, 3);
  });

  it("keeps the pass and best score after a later, worse attempt", async () => {
    const r = await submit(ALICE, "m01", responsesWithCorrect(1));
    expect(r.passed).toBe(false);
    expect(r.passed_at).not.toBeNull();
    expect(r.best_score).toBeCloseTo(6 / 7, 3);
    expect((await gate(ALICE, "chunking")).unlocked).toBe(true);
  });

  it("passes at exactly 80% (4/5)", async () => {
    const r = await submit(ALICE, "m03", {
      "m03-q01": { choice: "a" },
      "m03-q02": { choice: "a" },
      "m03-q03": { choice: "a" },
      "m03-q04": { choice: "a" },
      "m03-q05": { choice: "b" },
    });
    expect(r).toMatchObject({ correct: 4, total: 5, score: 0.8, passed: true });
  });

  it("does not share unlocks between learners", async () => {
    expect((await gate(BOB, "chunking")).unlocked).toBe(true); // Bob passed m01 above
    await t.db.query(`insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000c', 'c@example.com')`);
    expect((await gate("00000000-0000-0000-0000-00000000000c", "chunking")).unlocked).toBe(false);
  });
});

describe("attempt records", () => {
  it("logs every answered item", async () => {
    const { rows } = await t.as("authenticated", ALICE, () =>
      t.db.query<{ n: number }>(`select count(*)::int as n from public.quiz_attempts`),
    );
    // 7 + 5 + 7 + 7 for m01, 5 for m03
    expect(rows[0].n).toBe(31);
  });

  it("builds the review deck from passed modules, not from wrong answers", async () => {
    const cards = await t.as("authenticated", ALICE, () =>
      t.db.query<{ n: number }>(`select count(*)::int as n from public.review_cards`),
    );
    // m01: 7 quiz items + 3 failure cases; m03: 5 quiz items
    expect(cards.rows[0].n).toBe(15);
  });
});

describe("tamper resistance", () => {
  it("won't let a learner write their own score or pass", async () => {
    await t.db.query(`insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000d', 'd@example.com')`);
    const D = "00000000-0000-0000-0000-00000000000d";
    await expect(
      t.as("authenticated", D, () =>
        t.db.query(`insert into public.progress (module_id, passed_at, best_score) values ('m01', now(), 1)`),
      ),
    ).rejects.toThrow(/permission denied/);

    await t.as("authenticated", D, () =>
      t.db.query(`insert into public.progress (module_id, status, current_step_id) values ('m01', 'in_progress', 'm01-s01')`),
    );
    await expect(
      t.as("authenticated", D, () => t.db.query(`update public.progress set passed_at = now() where module_id = 'm01'`)),
    ).rejects.toThrow(/permission denied/);

    // Lesson position stays writable.
    const upd = await t.as("authenticated", D, () =>
      t.db.query(`update public.progress set current_step_id = 'm01-s02' where module_id = 'm01' returning current_step_id`),
    );
    expect(upd.rows).toHaveLength(1);
    expect((await gate(D, "chunking")).unlocked).toBe(false);
  });

  it("won't let a learner insert attempts or call the grader directly", async () => {
    await expect(
      t.as("authenticated", ALICE, () =>
        t.db.query(`insert into public.quiz_attempts (quiz_item_id, response, is_correct) values ('m01-q01', '{}', true)`),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      t.as("authenticated", ALICE, () => t.db.query(`select public.grade_quiz_response('single_choice', '{}', '{}')`)),
    ).rejects.toThrow(/permission denied/);
  });

  it("blocks anonymous callers", async () => {
    await expect(t.as("anon", null, () => t.db.query(`select public.submit_module_quiz('m01', '{}')`))).rejects.toThrow(
      /permission denied/,
    );
    await expect(t.as("anon", null, () => t.db.query(`select * from public.module_gate('chunking')`))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("rejects malformed responses", async () => {
    await expect(
      t.as("authenticated", ALICE, () => t.db.query(`select public.submit_module_quiz('m01', '[]')`)),
    ).rejects.toThrow(/JSON object/);
  });
});
