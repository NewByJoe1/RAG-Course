import { beforeEach, describe, expect, it, vi } from "vitest";

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

/**
 * Chainable fake of the supabase-js query builder. Each terminal call
 * (maybeSingle / select-after-update / insert / await) resolves from `db`
 * by table + operation, and every call is recorded for assertions.
 */
type Op = { table: string; op: string; values?: unknown; filters: [string, ...unknown[]][] };
let ops: Op[];
let db: {
  user: { id: string } | null;
  card: Record<string, unknown> | null;
  attempt: { is_correct: boolean; attempted_at: string } | null;
  updatedRows: number;
};

function builder(table: string) {
  const op: Op = { table, op: "select", filters: [] };
  ops.push(op);
  const resolve = () => {
    if (table === "review_cards" && op.op === "select") return { data: db.card, error: null };
    if (table === "quiz_attempts") return { data: db.attempt, error: null };
    if (table === "review_cards" && op.op === "update") return { data: Array.from({ length: db.updatedRows }, () => ({ id: "c1" })), error: null };
    return { data: null, error: null };
  };
  const q: Record<string, unknown> = {
    select: (..._a: unknown[]) => (op.op === "update" ? Promise.resolve(resolve()) : q),
    update: (values: unknown) => ((op.op = "update"), (op.values = values), q),
    insert: (values: unknown) => ((op.op = "insert"), (op.values = values), Promise.resolve({ error: null })),
    eq: (...a: unknown[]) => (op.filters.push(["eq", ...a]), q),
    gte: (...a: unknown[]) => (op.filters.push(["gte", ...a]), q),
    order: () => q,
    limit: () => q,
    maybeSingle: () => Promise.resolve(resolve()),
  };
  return q;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: db.user } }) },
    from: (t: string) => builder(t),
  }),
}));

import { rateReviewCard } from "@/app/actions/review";

const past = "2026-10-01T00:00:00.000Z";
const quizCard = { id: "c1", quiz_item_id: "m01-q01", failure_case_id: null, ease_factor: "2.50", interval_days: 2, repetitions: 0, lapses: 0, due_at: past };
const failureCard = { ...quizCard, quiz_item_id: null, failure_case_id: "m01-f01" };

beforeEach(() => {
  vi.clearAllMocks();
  ops = [];
  db = { user: { id: "u1" }, card: quizCard, attempt: { is_correct: true, attempted_at: "2026-10-13T00:00:00Z" }, updatedRows: 1 };
});

const update = () => ops.find((o) => o.table === "review_cards" && o.op === "update")!;
const log = () => ops.find((o) => o.table === "review_log");

describe("rateReviewCard", () => {
  it("schedules good on a new card 7 days out and logs it", async () => {
    const res = await rateReviewCard("c1", "good");
    expect(res).toMatchObject({ status: "rated", rating: "good", intervalDays: 7 });
    expect(update().values).toMatchObject({ interval_days: 7, repetitions: 1, ease_factor: 2.5 });
    // Conditional update guards against double-rating.
    expect(update().filters).toEqual([["eq", "id", "c1"], ["eq", "due_at", past]]);
    expect(log()?.values).toEqual({ card_id: "c1", rating: "good", interval_days: 7 });
    expect(revalidatePath).toHaveBeenCalledWith("/streak");
  });

  it("requires a quiz answer since the card fell due", async () => {
    db.attempt = null;
    expect(await rateReviewCard("c1", "good")).toEqual({ status: "error", error: "Answer the question before rating it." });
    const attemptQuery = ops.find((o) => o.table === "quiz_attempts")!;
    expect(attemptQuery.filters).toContainEqual(["gte", "attempted_at", past]);
    expect(ops.some((o) => o.op === "update")).toBe(false);
  });

  it("forces again after a wrong answer, whatever was clicked", async () => {
    db.attempt = { is_correct: false, attempted_at: "2026-10-13T00:00:00Z" };
    const res = await rateReviewCard("c1", "easy");
    expect(res).toMatchObject({ status: "rated", rating: "again", intervalDays: 1 });
    expect(update().values).toMatchObject({ interval_days: 1, repetitions: 0, lapses: 1 });
  });

  it("lets failure-case cards be self-rated without a quiz attempt", async () => {
    db.card = failureCard;
    db.attempt = null;
    const res = await rateReviewCard("c1", "easy");
    expect(res).toMatchObject({ status: "rated", rating: "easy", intervalDays: 21 });
    expect(ops.some((o) => o.table === "quiz_attempts")).toBe(false);
  });

  it("refuses cards that aren't due", async () => {
    db.card = { ...quizCard, due_at: "2999-01-01T00:00:00.000Z" };
    expect(await rateReviewCard("c1", "good")).toEqual({ status: "error", error: "This card isn't due yet." });
  });

  it("reports a card that was already rated", async () => {
    db.updatedRows = 0;
    expect(await rateReviewCard("c1", "good")).toEqual({ status: "error", error: "This card was already rated." });
    expect(log()).toBeUndefined();
  });

  it("validates the rating and the session", async () => {
    expect(await rateReviewCard("c1", "perfect")).toEqual({ status: "error", error: "Unknown rating." });
    db.user = null;
    expect((await rateReviewCard("c1", "good")).status).toBe("error");
  });
});
