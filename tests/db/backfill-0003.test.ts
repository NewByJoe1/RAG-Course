import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./pglite";
import { modules } from "@/content";

// Simulates the live database: learners took Module 1 under 0002's rules,
// then 0003 is applied on top.

const PASSED = "00000000-0000-0000-0000-0000000000f1";
const FAILED = "00000000-0000-0000-0000-0000000000f2";
const m01 = modules.find((m) => m.id === "m01")!;

function answers(nCorrect: number) {
  return JSON.stringify(
    Object.fromEntries(
      m01.quiz_items.map((q, i) => {
        if (i >= nCorrect) return [q.id, { choice: "zzz", choices: ["zzz"], text: "zzz" }];
        if (q.kind === "single_choice") return [q.id, { choice: q.answer.choice }];
        if (q.kind === "multi_choice") return [q.id, { choices: q.answer.choices }];
        return [q.id, { text: q.answer.accepted[0] }];
      }),
    ),
  );
}

let t: TestDb;

beforeAll(async () => {
  // Live, 0003 ran when only Module 1 existed.
  t = await createTestDb({ upTo: "0002", modules: ["m01"] });
  await t.createUser(PASSED, "passed@example.com");
  await t.createUser(FAILED, "failed@example.com");

  // Under 0002, wrong answers create cards that are due immediately.
  await t.as("authenticated", PASSED, () => t.db.query(`select public.submit_module_quiz('m01', $1)`, [answers(3)]));
  await t.as("authenticated", PASSED, () => t.db.query(`select public.submit_module_quiz('m01', $1)`, [answers(7)]));
  await t.as("authenticated", FAILED, () => t.db.query(`select public.submit_module_quiz('m01', $1)`, [answers(2)]));

  const before = await t.db.query<{ n: number }>(`select count(*)::int as n from public.review_cards where user_id = $1`, [PASSED]);
  expect(before.rows[0].n).toBe(4); // the 4 wrong answers from the first attempt

  await t.migrateRest();
});

describe("0003 backfill", () => {
  it("gives learners who already passed their full deck, first due in 2 days", async () => {
    const { rows } = await t.db.query<{ quiz: number; failure: number; not_two: number; early: number }>(
      `select count(quiz_item_id)::int as quiz,
              count(failure_case_id)::int as failure,
              count(*) filter (where interval_days <> 2)::int as not_two,
              count(*) filter (where due_at < now() + interval '47 hours')::int as early
       from public.review_cards where user_id = $1`,
      [PASSED],
    );
    // Legacy wrong-answer cards are reset to the 2-day start too.
    expect(rows[0]).toEqual({ quiz: 7, failure: 3, not_two: 0, early: 0 });
  });

  it("leaves learners who haven't passed alone, including their legacy cards", async () => {
    const { rows } = await t.db.query<{ n: number }>(
      `select count(*)::int as n from public.review_cards where user_id = $1 and failure_case_id is null and interval_days = 0`,
      [FAILED],
    );
    expect(rows[0].n).toBe(5);
    const failureCards = await t.db.query(`select 1 from public.review_cards where user_id = $1 and failure_case_id is not null`, [FAILED]);
    expect(failureCards.rows).toHaveLength(0);
  });

  it("is idempotent", async () => {
    const { rows } = await t.db.query<{ n: number }>(`select count(*)::int as n from public.review_cards`);
    await t.db.query(
      `do $$ declare r record; begin
         for r in select user_id, module_id from public.progress where passed_at is not null loop
           perform public.enroll_review_cards(r.user_id, r.module_id);
         end loop; end $$;`,
    );
    const again = await t.db.query<{ n: number }>(`select count(*)::int as n from public.review_cards`);
    expect(again.rows[0].n).toBe(rows[0].n);
  });
});
