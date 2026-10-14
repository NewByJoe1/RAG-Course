import { describe, expect, it } from "vitest";
import { fieldName, formatPercent, parseQuizFormData, PASS_THRESHOLD, type QuizItemRef } from "@/lib/course/quiz";

const items: QuizItemRef[] = [
  { id: "m01-q01", kind: "single_choice" },
  { id: "m01-q02", kind: "multi_choice" },
  { id: "m01-q03", kind: "short_answer" },
];

function form(entries: [string, string][]) {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

describe("parseQuizFormData", () => {
  it("maps each kind to the shape the grader expects", () => {
    const fd = form([
      [fieldName("m01-q01"), "b"],
      [fieldName("m01-q02"), "a"],
      [fieldName("m01-q02"), "c"],
      [fieldName("m01-q03"), "  cosine similarity  "],
    ]);
    expect(parseQuizFormData(fd, items)).toEqual({
      "m01-q01": { choice: "b" },
      "m01-q02": { choices: ["a", "c"] },
      "m01-q03": { text: "cosine similarity" },
    });
  });

  it("omits unanswered and blank items", () => {
    expect(parseQuizFormData(form([[fieldName("m01-q03"), "   "]]), items)).toEqual({});
  });

  it("dedupes multi-choice values and ignores unknown fields", () => {
    const fd = form([
      [fieldName("m01-q02"), "a"],
      [fieldName("m01-q02"), "a"],
      [fieldName("m99-q01"), "x"],
      ["q:../../etc", "x"],
    ]);
    expect(parseQuizFormData(fd, items)).toEqual({ "m01-q02": { choices: ["a"] } });
  });

  it("caps short answers at 500 characters", () => {
    const out = parseQuizFormData(form([[fieldName("m01-q03"), "x".repeat(2000)]]), items);
    expect((out["m01-q03"] as { text: string }).text).toHaveLength(500);
  });
});

describe("threshold and formatting", () => {
  it("passes at 80%", () => expect(PASS_THRESHOLD).toBe(0.8));
  it("formats scores", () => {
    expect(formatPercent(6 / 7)).toBe("86%");
    expect(formatPercent(0.8)).toBe("80%");
    expect(formatPercent(null)).toBe("—");
  });
});
