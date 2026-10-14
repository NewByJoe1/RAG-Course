import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitQuiz } from "@/app/actions/quiz";

const { revalidatePath, rpc, eq } = vi.hoisted(() => ({ revalidatePath: vi.fn(), rpc: vi.fn(), eq: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));

type Fake = {
  user: { id: string } | null;
  items: { id: string; kind: string }[] | null;
  itemsError?: { message: string } | null;
  rpc: { data: unknown; error: { message: string; hint?: string } | null };
};
let fake: Fake;

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: fake.user } }) },
    from: () => ({
      select: () => ({
        eq: async (...args: unknown[]) => {
          eq(...args);
          return { data: fake.items, error: fake.itemsError ?? null };
        },
      }),
    }),
    rpc: async (...args: unknown[]) => {
      rpc(...args);
      return fake.rpc;
    },
  }),
}));

const graded = {
  module_id: "m01",
  correct: 6,
  total: 7,
  score: "0.8571",
  threshold: "0.80",
  passed: true,
  best_score: "0.8571",
  passed_at: "2026-10-13T12:00:00Z",
  results: [{ quiz_item_id: "m01-q01", answered: true, is_correct: true, correct_answer: { choice: "b" }, explanation: "" }],
};

function form(entries: [string, string][]) {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  fake = {
    user: { id: "u1" },
    items: [
      { id: "m01-q01", kind: "single_choice" },
      { id: "m01-q03", kind: "short_answer" },
    ],
    rpc: { data: graded, error: null },
  };
});

describe("submitQuiz", () => {
  it("rejects signed-out users without calling the grader", async () => {
    fake.user = null;
    const state = await submitQuiz("m01", "rag-foundations", { status: "idle" }, form([]));
    expect(state).toEqual({ status: "error", error: expect.stringMatching(/log in/i) });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects an empty submission", async () => {
    const state = await submitQuiz("m01", "rag-foundations", { status: "idle" }, form([]));
    expect(state).toMatchObject({ status: "error", error: expect.stringMatching(/at least one/i) });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sends parsed responses to submit_module_quiz and returns the graded result", async () => {
    const state = await submitQuiz(
      "m01",
      "rag-foundations",
      { status: "idle" },
      form([
        ["q:m01-q01", "b"],
        ["q:m01-q03", " cosine "],
      ]),
    );

    expect(eq).toHaveBeenCalledWith("module_id", "m01");
    expect(rpc).toHaveBeenCalledWith("submit_module_quiz", {
      p_module_id: "m01",
      p_responses: { "m01-q01": { choice: "b" }, "m01-q03": { text: "cosine" } },
    });
    expect(state).toMatchObject({ status: "graded", result: { passed: true, score: 0.8571, threshold: 0.8 } });
    expect(revalidatePath).toHaveBeenCalledWith("/modules/rag-foundations");
    expect(revalidatePath).toHaveBeenCalledWith("/mastery");
  });

  it("explains a locked module", async () => {
    fake.rpc = { data: null, error: { message: "module m02 is locked", hint: "module_locked" } };
    const state = await submitQuiz("m02", "next", { status: "idle" }, form([["q:m01-q01", "a"]]));
    expect(state).toMatchObject({ status: "error", error: expect.stringMatching(/locked/i) });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("hides database error details", async () => {
    fake.rpc = { data: null, error: { message: "relation does not exist" } };
    const state = await submitQuiz("m01", "rag-foundations", { status: "idle" }, form([["q:m01-q01", "a"]]));
    expect(state).toEqual({ status: "error", error: "Couldn't submit your answers. Try again." });
  });

  it("rejects a malformed grader response", async () => {
    fake.rpc = { data: { nope: true }, error: null };
    const state = await submitQuiz("m01", "rag-foundations", { status: "idle" }, form([["q:m01-q01", "a"]]));
    expect(state).toMatchObject({ status: "error" });
  });
});
