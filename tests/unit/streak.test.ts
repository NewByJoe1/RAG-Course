import { describe, expect, it } from "vitest";
import { activityGrid, addDays, computeStreak, dayKey, isValidTimeZone } from "@/lib/streak";

describe("dayKey", () => {
  it("buckets by the learner's timezone", () => {
    const t = new Date("2026-10-14T03:30:00Z");
    expect(dayKey(t, "UTC")).toBe("2026-10-14");
    expect(dayKey(t, "America/Los_Angeles")).toBe("2026-10-13");
    expect(dayKey(t, "Asia/Tokyo")).toBe("2026-10-14");
  });
  it("falls back to UTC for unknown zones", () => {
    expect(dayKey(new Date("2026-10-14T03:30:00Z"), "Mars/Olympus")).toBe("2026-10-14");
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("Europe/London")).toBe(true);
  });
});

describe("addDays", () => {
  it("crosses month, year and DST boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
  });
});

describe("computeStreak", () => {
  const today = "2026-10-13";

  it("is zero with no activity", () => {
    expect(computeStreak([], today)).toEqual({ current: 0, longest: 0, activeToday: false, totalDays: 0 });
  });

  it("counts consecutive days ending today", () => {
    expect(computeStreak(["2026-10-11", "2026-10-12", "2026-10-13"], today)).toMatchObject({ current: 3, activeToday: true });
  });

  it("stays alive through today if yesterday was active", () => {
    expect(computeStreak(["2026-10-11", "2026-10-12"], today)).toMatchObject({ current: 2, activeToday: false });
  });

  it("breaks after a missed day", () => {
    expect(computeStreak(["2026-10-10", "2026-10-11"], today).current).toBe(0);
  });

  it("tracks the longest run separately", () => {
    const s = computeStreak(["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-10-13"], today);
    expect(s).toMatchObject({ current: 1, longest: 4, totalDays: 5 });
  });

  it("ignores duplicate days", () => {
    expect(computeStreak(["2026-10-13", "2026-10-13"], today)).toMatchObject({ current: 1, totalDays: 1 });
  });
});

describe("activityGrid", () => {
  it("builds Monday-first week columns ending today", () => {
    // 2026-10-13 is a Tuesday
    const grid = activityGrid(new Map([["2026-10-13", 4]]), "2026-10-13", 2);
    expect(grid).toHaveLength(2);
    expect(grid[0][0]?.key).toBe("2026-10-05"); // Monday of the previous week
    expect(grid[1][0]?.key).toBe("2026-10-12");
    expect(grid[1][1]).toEqual({ key: "2026-10-13", count: 4 });
    expect(grid[1].slice(2)).toEqual([null, null, null, null, null]);
  });
});
