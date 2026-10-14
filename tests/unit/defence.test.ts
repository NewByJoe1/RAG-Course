import { describe, expect, it } from "vitest";
import { defenceVerdict, DEFENCE_QUESTION_COUNT } from "@/lib/capstone/defence";
import { defenceSchema } from "@/lib/capstone/defence-schema";

const q = (over: object = {}) => ({ question: "Q", citation_verified: true, passed: true, note: null, ...over });
const six = (i?: number, over: object = {}) => Array.from({ length: 6 }, (_, j) => (j === i ? q(over) : q()));

describe("defenceVerdict", () => {
  it("is met only when all six pass with verified citations and the closing question passes", () => {
    expect(defenceVerdict({ questions: six(), closing_passed: true })).toEqual({ passed: true, reasons: [] });
  });

  it("fails on any failed question", () => {
    expect(defenceVerdict({ questions: six(2, { passed: false }), closing_passed: true })).toEqual({ passed: false, reasons: ["Question 3 failed"] });
  });

  it("fails on an unverified claim, even when the question passed", () => {
    expect(defenceVerdict({ questions: six(4, { citation_verified: false }), closing_passed: true }).reasons).toEqual([
      "Question 5 had no verified citation",
    ]);
  });

  it("fails when the closing question fails", () => {
    expect(defenceVerdict({ questions: six(), closing_passed: false })).toEqual({ passed: false, reasons: ["Closing question failed"] });
  });

  it("needs exactly six questions", () => {
    expect(defenceVerdict({ questions: six().slice(0, 5), closing_passed: true }).passed).toBe(false);
    expect(DEFENCE_QUESTION_COUNT).toBe(6);
  });
});

describe("defenceSchema", () => {
  it("accepts a complete defence and normalises blank notes to null", () => {
    const r = defenceSchema.parse({ questions: six(0, { note: "  " }), closing_passed: true, closing_note: "" });
    expect(r.questions[0].note).toBeNull();
    expect(r.closing_note).toBeNull();
  });

  it("rejects a blank question and the wrong number of questions", () => {
    expect(defenceSchema.safeParse({ questions: six(1, { question: "   " }), closing_passed: true, closing_note: null }).success).toBe(false);
    expect(defenceSchema.safeParse({ questions: six().slice(0, 5), closing_passed: true, closing_note: null }).success).toBe(false);
  });
});
