import { describe, expect, it } from "vitest";
import { buildMasteryGrid, masteryLevel, type Attempt } from "@/lib/course/mastery";

const at = (quiz_item_id: string, is_correct: boolean, minute: number): Attempt => ({
  quiz_item_id,
  is_correct,
  attempted_at: `2026-10-13T12:${String(minute).padStart(2, "0")}:00.000Z`,
});

describe("masteryLevel", () => {
  it("is unseen with no attempts", () => expect(masteryLevel([])).toBe("unseen"));
  it("is learning when the latest attempt is wrong", () => {
    expect(masteryLevel([at("q", true, 1), at("q", false, 2)])).toBe("learning");
  });
  it("is correct after one right answer", () => expect(masteryLevel([at("q", true, 1)])).toBe("correct"));
  it("is correct when right after a miss", () => {
    expect(masteryLevel([at("q", false, 1), at("q", true, 2)])).toBe("correct");
  });
  it("is mastered after two right in a row", () => {
    expect(masteryLevel([at("q", false, 1), at("q", true, 2), at("q", true, 3)])).toBe("mastered");
  });
  it("orders by time, not input order", () => {
    expect(masteryLevel([at("q", true, 3), at("q", false, 1), at("q", true, 2)])).toBe("mastered");
    expect(masteryLevel([at("q", false, 3), at("q", true, 1), at("q", true, 2)])).toBe("learning");
  });
});

describe("buildMasteryGrid", () => {
  const modules = [
    { id: "m02", slug: "two", title: "Two", order_index: 2 },
    { id: "m01", slug: "one", title: "One", order_index: 1 },
  ];
  const items = [
    { id: "m01-q02", module_id: "m01", order_index: 2, prompt: "b" },
    { id: "m01-q01", module_id: "m01", order_index: 1, prompt: "a" },
    { id: "m02-q01", module_id: "m02", order_index: 1, prompt: "c" },
  ];

  it("orders modules and items, and fills levels, lock and score", () => {
    const rows = buildMasteryGrid(
      modules,
      items,
      [at("m01-q01", true, 1), at("m01-q01", true, 2), at("m01-q02", false, 3)],
      [{ module_id: "m01", best_score: 0.5, passed_at: null }],
    );

    expect(rows.map((r) => r.module.id)).toEqual(["m01", "m02"]);
    expect(rows[0].cells.map((c) => [c.item.id, c.level, c.attempts])).toEqual([
      ["m01-q01", "mastered", 2],
      ["m01-q02", "learning", 1],
    ]);
    expect(rows[0]).toMatchObject({ unlocked: true, passed: false, bestScore: 0.5, masteredCount: 1 });
    expect(rows[1]).toMatchObject({ unlocked: false, passed: false, bestScore: null });
    expect(rows[1].cells[0].level).toBe("unseen");
  });

  it("unlocks the next module once the previous is passed", () => {
    const rows = buildMasteryGrid(modules, items, [], [{ module_id: "m01", best_score: 0.86, passed_at: "2026-10-13T12:00:00Z" }]);
    expect(rows[0].passed).toBe(true);
    expect(rows[1].unlocked).toBe(true);
  });
});
