import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./pglite";
import { modules } from "@/content";

// Every authored answer key must grade as correct in the real SQL grader,
// and an obviously wrong response must not.

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});

const correct = (q: (typeof modules)[number]["quiz_items"][number]) => {
  if (q.kind === "single_choice") return { choice: q.answer.choice };
  if (q.kind === "multi_choice") return { choices: [...q.answer.choices].reverse() };
  return { text: `  ${q.answer.accepted[q.answer.accepted.length - 1].toUpperCase()} ` };
};

describe.each(modules.filter((m) => m.quiz_items.length).map((m) => [m.id, m] as const))("%s answer keys", (_id, mod) => {
  it.each(mod.quiz_items.map((q) => [q.id, q] as const))("%s grades its answer key as correct", async (_qid, q) => {
    const { rows } = await t.db.query<{ ok: boolean }>(
      `select public.grade_quiz_response(kind, answer, $2) as ok from public.quiz_items where id = $1`,
      [q.id, JSON.stringify(correct(q))],
    );
    expect(rows).toEqual([{ ok: true }]);
  });

  it("rejects a wrong response for every item", async () => {
    const { rows } = await t.db.query<{ id: string; ok: boolean }>(
      `select id, public.grade_quiz_response(kind, answer, '{"choice":"zzz","choices":["zzz"],"text":"zzz"}') as ok
       from public.quiz_items where module_id = $1`,
      [mod.id],
    );
    expect(rows.filter((r) => r.ok)).toEqual([]);
  });
});
