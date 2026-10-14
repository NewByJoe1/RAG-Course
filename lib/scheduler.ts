// Spaced-repetition scheduler for review_cards.
//
// Intervals (days), from the card's current interval:
//   good   next rung of the ladder 2 → 7 → 21, then round(interval × ease)
//   easy   skips ahead one interval: good applied twice (2 → 21, 7 → 53)
//   hard   repeats the current interval
//   again  always 1 day
//
// Ease starts at 2.5 with a floor of 1.3. Ratings nudge it SM-2 style
// (again −0.20, hard −0.15, easy +0.15); the interval for a rating is
// computed with the ease the card had *before* that rating.
//
// New cards start at interval 2, due 2 days after the module is passed.

export const RATINGS = ["again", "hard", "good", "easy"] as const;
export type Rating = (typeof RATINGS)[number];

export const isRating = (v: unknown): v is Rating => typeof v === "string" && (RATINGS as readonly string[]).includes(v);

export const LADDER_DAYS = [2, 7, 21] as const;
export const INITIAL_INTERVAL_DAYS = 2;
export const AGAIN_INTERVAL_DAYS = 1;
export const DEFAULT_EASE = 2.5;
export const MIN_EASE = 1.3; // matches the review_cards.ease_factor check constraint

const EASE_DELTA: Record<Rating, number> = { again: -0.2, hard: -0.15, good: 0, easy: 0.15 };
const DAY_MS = 86_400_000;
const LADDER_TOP = LADDER_DAYS[LADDER_DAYS.length - 1];

function goodInterval(interval: number, ease: number): number {
  if (interval < LADDER_TOP) return LADDER_DAYS.find((d) => d > interval)!;
  return Math.round(interval * ease);
}

/** Next interval in days for a card currently at `interval` days with `ease`. */
export function nextInterval(interval: number, ease: number, rating: Rating): number {
  const current = Math.max(0, Math.round(interval));
  switch (rating) {
    case "again":
      return AGAIN_INTERVAL_DAYS;
    case "hard":
      return Math.max(1, current);
    case "good":
      return goodInterval(current, ease);
    case "easy":
      return goodInterval(goodInterval(current, ease), ease);
  }
}

export function nextEase(ease: number, rating: Rating): number {
  return Math.round(Math.max(MIN_EASE, ease + EASE_DELTA[rating]) * 100) / 100;
}

export type CardSchedule = {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  lapses: number;
};

export type ScheduledCard = CardSchedule & { due_at: string; last_reviewed_at: string };

/** Apply a rating to a card and return the fields to write back to review_cards. */
export function schedule(card: CardSchedule, rating: Rating, now: Date = new Date()): ScheduledCard {
  const ease = Number(card.ease_factor) || DEFAULT_EASE;
  const interval = nextInterval(card.interval_days, ease, rating);
  return {
    ease_factor: nextEase(ease, rating),
    interval_days: interval,
    repetitions: rating === "again" ? 0 : card.repetitions + 1,
    lapses: rating === "again" ? card.lapses + 1 : card.lapses,
    due_at: new Date(now.getTime() + interval * DAY_MS).toISOString(),
    last_reviewed_at: now.toISOString(),
  };
}

/** Interval each rating would give, for button labels ("1d", "7d", …). */
export function previewIntervals(card: Pick<CardSchedule, "interval_days" | "ease_factor">): Record<Rating, string> {
  const ease = Number(card.ease_factor) || DEFAULT_EASE;
  return Object.fromEntries(RATINGS.map((r) => [r, formatDays(nextInterval(card.interval_days, ease, r))])) as Record<
    Rating,
    string
  >;
}

export function formatDays(days: number): string {
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${Math.round((days / 365) * 10) / 10}y`;
}

/** Most cards the review route serves in one session. */
export const REVIEW_BATCH_SIZE = 8;
