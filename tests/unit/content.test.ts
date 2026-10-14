import { describe, expect, it } from "vitest";
import { z } from "zod";
import { modules } from "@/content";
import { moduleSchema, TODO_MARKER, type ModuleContent } from "@/content/types";

const parse = (m: ModuleContent) => moduleSchema.safeParse(m);

describe("course content", () => {
  it("validates every module", () => {
    const r = z.array(moduleSchema).safeParse(modules);
    expect(r.success ? "ok" : z.prettifyError(r.error)).toBe("ok");
  });

  it("never publishes a module that still has placeholders", () => {
    for (const m of modules.filter((m) => m.is_published)) {
      expect(JSON.stringify(m), `${m.id} is published`).not.toContain(TODO_MARKER);
    }
  });

  it("rejects publishing a draft and points at the placeholders", () => {
    const m01 = modules.find((m) => m.id === "m01")!;
    const draft = { ...m01, summary: `${TODO_MARKER} summary`, learning_objectives: [`${TODO_MARKER} objective`] };
    expect(parse({ ...draft, is_published: false }).success).toBe(true); // fine as an unpublished draft
    const r = parse(draft);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/m01 is published but still has \[TODO\] placeholders: summary, learning_objectives\[0\]/);
  });

  it("catches a placeholder left deep inside a published module", () => {
    const m01 = modules.find((m) => m.id === "m01")!;
    const broken = { ...m01, failure_cases: [{ ...m01.failure_cases[0], fix: "[TODO] write the fix" }, ...m01.failure_cases.slice(1)] };
    const r = parse(broken);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toContain("failure_cases[0].fix");
  });

  it("publishes Module 2 with Module 1's structure, except where noted", () => {
    const [m01, m02] = ["m01", "m02"].map((id) => modules.find((m) => m.id === id)!);
    expect(m02).toMatchObject({ is_published: true, order_index: 2, slug: "pre-retrieval" });
    expect(m02.lesson_steps).toHaveLength(m01.lesson_steps.length);
    expect(m02.quiz_items).toHaveLength(m01.quiz_items.length);
    expect(m02.failure_cases).toHaveLength(m01.failure_cases.length);
    // Deliberate differences: warm-up recall is an exercise, and Routing precedes the hands-on exercise.
    expect(m02.lesson_steps.map((s) => s.kind)).toEqual(["exercise", "concept", "concept", "example", "concept", "exercise", "reflection"]);
    // Module 1's quiz-type order except slot 6, since Module 2 has one multi-select.
    expect(m02.quiz_items.map((q) => q.kind)).toEqual(m01.quiz_items.map((q, i) => (i === 5 ? "single_choice" : q.kind)));
  });

  it.each(["m03", "m04", "m05"])("publishes %s with the same 7 / 7 / 3 structure", (id) => {
    const m = modules.find((x) => x.id === id)!;
    expect(m.is_published).toBe(true);
    expect([m.lesson_steps.length, m.quiz_items.length, m.failure_cases.length]).toEqual([7, 7, 3]);
    expect(m.lesson_steps.map((s) => s.kind)).toEqual(["exercise", "concept", "concept", "example", "exercise", "exercise", "reflection"]);
    expect(m.order_index).toBe(Number(id.slice(1)));
  });

  it("keeps module order contiguous for the published course", () => {
    const published = modules.filter((m) => m.is_published).map((m) => m.order_index);
    expect(published).toEqual([1, 2, 3, 4, 5]);
  });
});
