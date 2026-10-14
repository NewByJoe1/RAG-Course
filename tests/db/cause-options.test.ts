import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./pglite";
import { modules } from "@/content";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});

const setOptions = (options: unknown, correct: string | null) =>
  t.db.query(`update public.failure_cases set cause_options = $1, correct_cause = $2 where id = 'm01-f01'`, [
    options === null ? null : JSON.stringify(options),
    correct,
  ]);

describe("0006 failure cause options", () => {
  it("stores every seeded failure case's options and exposes them to learners", async () => {
    await t.createUser("00000000-0000-0000-0000-0000000000d1", "d@example.com");
    const { rows } = await t.as("authenticated", "00000000-0000-0000-0000-0000000000d1", () =>
      t.db.query<{ id: string; n: number; correct_cause: string }>(
        `select id, jsonb_array_length(cause_options) as n, correct_cause from public.failure_cases where cause_options is not null order by id`,
      ),
    );
    expect(rows).toHaveLength(modules.flatMap((m) => m.failure_cases).length);
    expect(rows.every((r) => r.n === 3)).toBe(true);
    expect(rows.find((r) => r.id === "m03-f02")?.correct_cause).toBe("b");
  });

  it("still allows a case without options", async () => {
    await setOptions(null, null);
    const { rows } = await t.db.query(`select 1 from public.failure_cases where id = 'm01-f01' and cause_options is null`);
    expect(rows).toHaveLength(1);
  });

  it("requires the correct cause to be one of the options", async () => {
    await expect(setOptions([{ id: "a", text: "x" }, { id: "b", text: "y" }], "z")).rejects.toThrow(/failure_cases_cause_options_shape/);
    await setOptions([{ id: "a", text: "x" }, { id: "b", text: "y" }], "b");
  });

  it("requires both columns together, at least two options, and an array", async () => {
    await expect(setOptions([{ id: "a", text: "x" }, { id: "b", text: "y" }], null)).rejects.toThrow(/cause_options_shape/);
    await expect(setOptions(null, "a")).rejects.toThrow(/cause_options_shape/);
    await expect(setOptions([{ id: "a", text: "x" }], "a")).rejects.toThrow(/cause_options_shape/);
    await expect(setOptions({ id: "a", text: "x" }, "a")).rejects.toThrow(/cause_options_shape/);
    await setOptions(null, null);
  });
});

describe("0007 failure categories", () => {
  it("files Modules 6–8 under evaluation and monitoring", async () => {
    const { rows } = await t.db.query<{ category: string; n: number }>(
      `select category, count(*)::int as n from public.failure_cases where category in ('evaluation', 'monitoring') group by 1 order by 1`,
    );
    expect(rows).toEqual([
      { category: "evaluation", n: 5 },
      { category: "monitoring", n: 3 },
    ]);
  });

  it("still rejects unknown categories", async () => {
    await expect(t.db.query(`update public.failure_cases set category = 'vibes' where id = 'm01-f01'`)).rejects.toThrow(/failure_cases_category_check/);
  });
});

