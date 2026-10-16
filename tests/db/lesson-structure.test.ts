import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./pglite";
import { modules } from "@/content";

const ANA = "00000000-0000-0000-0000-0000000010a1";
const BEN = "00000000-0000-0000-0000-0000000010b1";
let t: TestDb;
const q = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => t.db.query<T>(sql, params);
const m01 = modules.find((m) => m.id === "m01")!;

beforeAll(async () => {
  t = await createTestDb();
  await t.createUser(ANA, "ana@example.com");
  await t.createUser(BEN, "ben@example.com");
});

describe("0010 lesson structure: content", () => {
  it("seeds Module 1's hook, stages, worked example, glossary and study guide", async () => {
    const { rows } = await q<{ hook: string; pipeline_stages: string[]; explain_back_prompt: string }>(
      `select hook, pipeline_stages, explain_back_prompt from public.modules where id = 'm01'`,
    );
    expect(rows[0].hook).toContain("subcontractor");
    expect(rows[0].pipeline_stages).toEqual(["hybrid-retrieval", "generation"]);
    const counts = await q<{ w: number; g: number; p: number }>(
      `select (select count(*)::int from public.worked_example_steps where module_id = 'm01') as w,
              (select count(*)::int from public.module_glossary where module_id = 'm01') as g,
              (select count(*)::int from public.study_guide_points where module_id = 'm01') as p`,
    );
    expect(counts.rows[0]).toEqual({ w: m01.worked_example!.length, g: m01.glossary!.length, p: m01.study_guide!.length });
  });

  it("lets anyone read lesson content for published modules only", async () => {
    await q(`update public.modules set is_published = false where id = 'm02'`);
    await q(`insert into public.worked_example_steps (id, module_id, order_index, title, body_md) values ('m02-w01', 'm02', 1, 'Draft', 'x')`);
    const anonRows = await t.as("anon", null, () => q<{ module_id: string }>(`select distinct module_id from public.worked_example_steps`));
    expect(anonRows.rows.map((r) => r.module_id)).toEqual(["m01"]);
    const terms = await t.as("anon", null, () => q(`select 1 from public.glossary_terms`));
    expect(terms.rows.length).toBeGreaterThanOrEqual(m01.glossary!.length);
    await q(`update public.modules set is_published = true where id = 'm02'`);
  });

  it("is read-only for learners", async () => {
    await expect(t.as("authenticated", ANA, () => q(`insert into public.glossary_terms (id, term, definition) values ('x', 'x', 'x')`))).rejects.toThrow(
      /permission denied/,
    );
    await expect(t.as("authenticated", ANA, () => q(`delete from public.study_guide_points`))).rejects.toThrow(/permission denied/);
  });

  it("only accepts the seven pipeline stages, the warm_up kind, and a well-formed video", async () => {
    await expect(q(`update public.modules set pipeline_stages = array['retrieval'] where id = 'm01'`)).rejects.toThrow(/pipeline_stages/);
    await expect(q(`insert into public.worked_example_steps (id, module_id, order_index, title, body_md, stage) values ('m01-w99', 'm01', 99, 'x', 'x', 'search')`)).rejects.toThrow(
      /check constraint/,
    );
    await expect(q(`update public.modules set video = '{"title":"no src"}' where id = 'm01'`)).rejects.toThrow(/check constraint/);
    await q(`update public.modules set video = '{"src":"/v/m01.mp4","title":"Pilot"}' where id = 'm01'`);
    await q(`update public.modules set video = null where id = 'm01'`);
    const { rows } = await q<{ kind: string }>(`select kind from public.lesson_steps where id = 'm01-s01'`);
    expect(rows[0].kind).toBe("warm_up");
  });
});

describe("0010: explain it back (private)", () => {
  const save = (who: string, text: string, module = "m01") =>
    t.as("authenticated", who, () => q(`insert into public.explain_back_responses (module_id, response) values ($1, $2) returning user_id`, [module, text]));

  it("saves a learner's answer as their own and keeps every attempt", async () => {
    const r = await save(ANA, "It was a retrieval miss: §4.2(b) never reached the writer.");
    expect(r.rows[0].user_id).toBe(ANA);
    await save(ANA, "Second try.");
    const mine = await t.as("authenticated", ANA, () => q(`select response from public.explain_back_responses order by created_at`));
    expect(mine.rows).toHaveLength(2);
  });

  it("is private: other learners and anonymous visitors see nothing", async () => {
    expect((await t.as("authenticated", BEN, () => q(`select 1 from public.explain_back_responses`))).rows).toHaveLength(0);
    await expect(t.as("anon", null, () => q(`select 1 from public.explain_back_responses`))).rejects.toThrow(/permission denied/);
  });

  it("can't be written for someone else, edited or deleted", async () => {
    await expect(
      t.as("authenticated", BEN, () => q(`insert into public.explain_back_responses (user_id, module_id, response) values ($1, 'm01', 'x')`, [ANA])),
    ).rejects.toThrow(/permission denied/);
    await expect(t.as("authenticated", ANA, () => q(`update public.explain_back_responses set response = 'edited'`))).rejects.toThrow(/permission denied/);
    await expect(t.as("authenticated", ANA, () => q(`delete from public.explain_back_responses`))).rejects.toThrow(/permission denied/);
  });

  it("rejects blank or oversized answers", async () => {
    await expect(save(ANA, "   ")).rejects.toThrow(/check constraint/);
    await expect(save(ANA, "x".repeat(4001))).rejects.toThrow(/check constraint/);
  });
});

describe("0010 leaves the quiz gate alone", () => {
  it("submit_module_quiz still grades the rewritten Module 1 and records the pass", async () => {
    const answers = Object.fromEntries(
      m01.quiz_items.map((it) => [
        it.id,
        it.kind === "single_choice" ? { choice: it.answer.choice } : it.kind === "multi_choice" ? { choices: it.answer.choices } : { text: it.answer.accepted[0] },
      ]),
    );
    const { rows } = await t.as("authenticated", BEN, () =>
      q<{ r: { passed: boolean; correct: number; total: number } }>(`select public.submit_module_quiz('m01', $1) as r`, [JSON.stringify(answers)]),
    );
    expect(rows[0].r).toMatchObject({ passed: true, correct: 7, total: 7 });
  });
});
