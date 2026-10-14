import { describe, expect, it } from "vitest";
import { z } from "zod";
import { modules } from "@/content";
import { moduleSchema, TODO_MARKER, type ModuleContent } from "@/content/types";
import { THRESHOLDS } from "@/supabase/functions/_shared/capstone";

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

  it.each(["m03", "m04", "m05", "m06", "m07", "m08", "m09", "m10", "m11"])("publishes %s with the same 7 / 7 / 3 structure", (id) => {
    const m = modules.find((x) => x.id === id)!;
    expect(m.is_published).toBe(true);
    expect([m.lesson_steps.length, m.quiz_items.length, m.failure_cases.length]).toEqual([7, 7, 3]);
    expect(m.lesson_steps.map((s) => s.kind)).toEqual(["exercise", "concept", "concept", "example", "exercise", "exercise", "reflection"]);
    expect(m.order_index).toBe(Number(id.slice(1)));
  });

  it("keeps module order contiguous for the published course", () => {
    const published = modules.filter((m) => m.is_published).map((m) => m.order_index);
    expect(published).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  describe("failure cause options", () => {
    const m03 = modules.find((m) => m.id === "m03")!;
    const base = m03.failure_cases[0];
    const withCase = (fc: object) => parse({ ...m03, failure_cases: [{ ...base, ...fc }, ...m03.failure_cases.slice(1)] });

    it("gives every failure case three options with a valid correct cause", () => {
      for (const m of modules.filter((x) => x.failure_cases.length)) {
        for (const f of m.failure_cases) {
          expect(f.cause_options, f.id).toHaveLength(3);
          expect(f.cause_options!.map((o) => o.id)).toContain(f.correct_cause);
        }
      }
    });

    it("keeps the full root cause as the post-pick explanation, separate from the short option", () => {
      for (const f of modules.flatMap((m) => m.failure_cases).filter((x) => x.cause_options)) {
        const correct = f.cause_options!.find((o) => o.id === f.correct_cause)!.text;
        expect(f.root_cause.length, f.id).toBeGreaterThan(0);
        expect(correct.length, `${f.id} correct option should be short`).toBeLessThanOrEqual(60);
      }
    });

    it("doesn't give away the answer by length: the correct option is the longest in a third of cases or fewer", () => {
      const cases = modules.flatMap((m) => m.failure_cases).filter((f) => f.cause_options);
      const longest = cases.filter((f) => {
        const len = f.cause_options!.find((o) => o.id === f.correct_cause)!.text.length;
        return f.cause_options!.every((o) => o.id === f.correct_cause || o.text.length < len);
      });
      // Reported on every run so content authors can see the number.
      console.info(`[cause options] correct option is the longest in ${longest.length} of ${cases.length}: ${longest.map((f) => f.id).join(", ") || "none"}`);
      expect(longest.length).toBeLessThanOrEqual(Math.ceil(cases.length / 3));
    });

    it("rejects options without a correct cause, or the reverse", () => {
      expect(withCase({ correct_cause: null }).success).toBe(false);
      expect(withCase({ cause_options: null }).success).toBe(false);
    });

    it("rejects a correct cause that isn't an option, duplicate ids, and a single option", () => {
      expect(withCase({ correct_cause: "z" }).success).toBe(false);
      expect(withCase({ cause_options: [{ id: "a", text: "x" }, { id: "a", text: "y" }], correct_cause: "a" }).success).toBe(false);
      expect(withCase({ cause_options: [{ id: "a", text: "x" }], correct_cause: "a" }).success).toBe(false);
    });

    it("gives every published failure case cause options", () => {
      const missing = modules
        .filter((m) => m.is_published)
        .flatMap((m) => m.failure_cases)
        .filter((f) => !f.cause_options)
        .map((f) => f.id);
      expect(missing).toEqual([]);
    });

  });

  it("publishes the capstone (m12) as the last module, graded by CI rather than a quiz", () => {
    const m12 = modules.find((m) => m.id === "m12")!;
    expect(m12).toMatchObject({ is_published: true, order_index: 12, slug: "capstone" });
    expect([m12.lesson_steps.length, m12.quiz_items.length, m12.failure_cases.length]).toEqual([0, 0, 0]);
    // Its objectives state the same thresholds the grader uses.
    const text = m12.learning_objectives.join(" ");
    expect(text).toContain(`recall@3 ≥ ${THRESHOLDS.recall_at_3}`);
    expect(text).toContain(`citation accuracy ≥ ${THRESHOLDS.citation_accuracy}`);
    expect(text).toContain(`${THRESHOLDS.concurrent_users_tested}+ concurrent users`);
  });
});

