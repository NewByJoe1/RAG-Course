// Streaks: consecutive calendar days (in the learner's timezone) with at
// least one quiz or review answer. Day keys are "YYYY-MM-DD" strings.

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Calendar day of `date` in `tz` as YYYY-MM-DD. Unknown zones fall back to UTC. */
export function dayKey(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: isValidTimeZone(tz) ? tz : "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Shift a YYYY-MM-DD key by whole days (calendar arithmetic, DST-safe). */
export function addDays(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type Streak = {
  current: number;
  longest: number;
  activeToday: boolean;
  totalDays: number;
};

/**
 * `current` counts back from today, or from yesterday if the learner hasn't
 * studied yet today (the streak is still alive until today ends).
 */
export function computeStreak(activeDays: Iterable<string>, today: string): Streak {
  const days = new Set(activeDays);
  const activeToday = days.has(today);

  let current = 0;
  let cursor = activeToday ? today : addDays(today, -1);
  while (days.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of Array.from(days).sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }

  return { current, longest, activeToday, totalDays: days.size };
}

/**
 * Calendar grid for the last `weeks` weeks ending today, as columns of
 * Monday→Sunday cells. Cells after today are null.
 */
export function activityGrid(
  counts: Map<string, number>,
  today: string,
  weeks = 12,
): ({ key: string; count: number } | null)[][] {
  const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const start = addDays(today, -dow - (weeks - 1) * 7);
  const columns: ({ key: string; count: number } | null)[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: ({ key: string; count: number } | null)[] = [];
    for (let d = 0; d < 7; d++) {
      const key = addDays(start, w * 7 + d);
      col.push(key > today ? null : { key, count: counts.get(key) ?? 0 });
    }
    columns.push(col);
  }
  return columns;
}
