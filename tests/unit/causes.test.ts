import { describe, expect, it } from "vitest";
import { orderCauseOptions } from "@/lib/course/causes";
import { modules } from "@/content";

const opts = [
  { id: "a", text: "A" },
  { id: "b", text: "B" },
  { id: "c", text: "C" },
];

describe("orderCauseOptions", () => {
  it("is a stable permutation per case", () => {
    const once = orderCauseOptions("m03-f01", opts);
    expect(orderCauseOptions("m03-f01", opts)).toEqual(once);
    expect([...once].sort((x, y) => x.id.localeCompare(y.id))).toEqual(opts);
    expect(opts.map((o) => o.id)).toEqual(["a", "b", "c"]); // input untouched
  });

  it("stops the authored correct answer from usually being first", () => {
    const cases = modules.flatMap((m) => m.failure_cases).filter((f) => f.cause_options && f.correct_cause);
    expect(cases.length).toBe(15);
    const authoredFirst = cases.filter((f) => f.cause_options![0].id === f.correct_cause).length;
    const shownFirst = cases.filter((f) => orderCauseOptions(f.id, f.cause_options!)[0].id === f.correct_cause).length;
    expect(authoredFirst).toBe(13); // as authored: 7 of 9 in Modules 3–5, plus 6 of 6 in Modules 1–2
    expect(shownFirst).toBeLessThanOrEqual(Math.ceil(cases.length / 2));
  });
});
