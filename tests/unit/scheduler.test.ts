import { describe, expect, it } from "vitest";
import {
  DEFAULT_EASE,
  MIN_EASE,
  nextEase,
  nextInterval,
  previewIntervals,
  RATINGS,
  schedule,
} from "@/lib/scheduler";

describe("nextInterval: the spec's rules", () => {
  it("good climbs 2 → 7 → 21, then rounds interval × ease", () => {
    expect(nextInterval(2, 2.5, "good")).toBe(7);
    expect(nextInterval(7, 2.5, "good")).toBe(21);
    expect(nextInterval(21, 2.5, "good")).toBe(53); // round(52.5)
    expect(nextInterval(53, 2.5, "good")).toBe(133); // round(132.5)
  });

  it("good uses the card's ease past the ladder", () => {
    expect(nextInterval(21, 1.3, "good")).toBe(27); // round(27.3)
    expect(nextInterval(21, 2.0, "good")).toBe(42);
  });

  it("good from a 1-day interval (after again) restarts at 2", () => {
    expect(nextInterval(1, 2.5, "good")).toBe(2);
  });

  it("again is always 1 day", () => {
    for (const i of [1, 2, 7, 21, 53, 400]) expect(nextInterval(i, 2.5, "again")).toBe(1);
  });

  it("hard repeats the current interval", () => {
    for (const i of [1, 2, 7, 21, 53]) expect(nextInterval(i, 2.5, "hard")).toBe(i);
  });

  it("easy skips ahead one interval", () => {
    expect(nextInterval(2, 2.5, "easy")).toBe(21); // skips 7
    expect(nextInterval(7, 2.5, "easy")).toBe(53); // skips 21
    expect(nextInterval(21, 2.5, "easy")).toBe(133); // skips 53
    expect(nextInterval(1, 2.5, "easy")).toBe(7); // skips 2
  });

  it("orders again < hard < good < easy for every rung", () => {
    for (const i of [2, 7, 21, 53]) {
      const [again, hard, good, easy] = RATINGS.map((r) => nextInterval(i, 2.5, r));
      expect(again).toBeLessThanOrEqual(hard);
      expect(hard).toBeLessThan(good);
      expect(good).toBeLessThan(easy);
    }
  });
});

describe("ease", () => {
  it("starts at 2.5", () => expect(DEFAULT_EASE).toBe(2.5));

  it("never drops below 1.3", () => {
    let ease = DEFAULT_EASE;
    for (let n = 0; n < 20; n++) ease = nextEase(ease, "again");
    expect(ease).toBe(MIN_EASE);
    expect(nextEase(1.35, "hard")).toBe(MIN_EASE);
  });

  it("good leaves ease alone; easy raises it", () => {
    expect(nextEase(2.5, "good")).toBe(2.5);
    expect(nextEase(2.5, "easy")).toBe(2.65);
    expect(nextEase(2.5, "again")).toBe(2.3);
    expect(nextEase(2.5, "hard")).toBe(2.35);
  });
});

describe("schedule", () => {
  const now = new Date("2026-10-13T12:00:00.000Z");
  const fresh = { ease_factor: 2.5, interval_days: 2, repetitions: 0, lapses: 0 };

  it("rating good on a new card schedules 7 days out", () => {
    expect(schedule(fresh, "good", now)).toEqual({
      ease_factor: 2.5,
      interval_days: 7,
      repetitions: 1,
      lapses: 0,
      due_at: "2026-10-20T12:00:00.000Z",
      last_reviewed_at: "2026-10-13T12:00:00.000Z",
    });
  });

  it("again resets repetitions, counts a lapse, and is due tomorrow", () => {
    const s = schedule({ ...fresh, interval_days: 21, repetitions: 3 }, "again", now);
    expect(s).toMatchObject({ interval_days: 1, repetitions: 0, lapses: 1, ease_factor: 2.3, due_at: "2026-10-14T12:00:00.000Z" });
  });

  it("computes the interval with the ease from before the rating", () => {
    // easy from 21 at ease 2.5 → 133, even though ease becomes 2.65
    expect(schedule({ ...fresh, interval_days: 21 }, "easy", now)).toMatchObject({ interval_days: 133, ease_factor: 2.65 });
  });

  it("accepts ease as a numeric string from Postgres", () => {
    expect(schedule({ ...fresh, ease_factor: "2.50" as unknown as number, interval_days: 21 }, "good", now).interval_days).toBe(53);
  });

  it("walks the full good path 2 → 7 → 21 → 53", () => {
    let card = { ...fresh };
    const seen: number[] = [];
    for (let n = 0; n < 3; n++) {
      const s = schedule(card, "good", now);
      seen.push(s.interval_days);
      card = s;
    }
    expect(seen).toEqual([7, 21, 53]);
  });
});

describe("previewIntervals", () => {
  it("labels each button", () => {
    expect(previewIntervals({ interval_days: 2, ease_factor: 2.5 })).toEqual({ again: "1d", hard: "2d", good: "7d", easy: "21d" });
    expect(previewIntervals({ interval_days: 21, ease_factor: 2.5 })).toEqual({ again: "1d", hard: "21d", good: "2mo", easy: "4mo" });
  });
});
