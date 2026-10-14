import { beforeEach, describe, expect, it, vi } from "vitest";

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

let user: { id: string } | null;
let insertResult: { data: unknown; error: { code: string; message: string } | null };
let mainCriteria: string[] | null;
const inserted: unknown[] = [];

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user } }) },
    from: (table: string) => {
      if (table === "capstone_defences") {
        return {
          insert: (row: unknown) => {
            inserted.push(row);
            return { select: () => ({ single: async () => insertResult }) };
          },
        };
      }
      const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: mainCriteria ? { criteria_met: mainCriteria } : null }) };
      return q;
    },
  }),
}));

import { recordDefence } from "@/app/actions/defence";

const LEARNER = "11111111-1111-4111-8111-111111111111";
const REVIEWER = "22222222-2222-4222-8222-222222222222";
const six = () => Array.from({ length: 6 }, (_, i) => ({ question: `Q${i + 1}`, citation_verified: true, passed: true, note: null }));

beforeEach(() => {
  vi.clearAllMocks();
  inserted.length = 0;
  user = { id: REVIEWER };
  insertResult = { data: { passed: true, recorded_at: "2026-10-15T10:00:00Z" }, error: null };
  mainCriteria = ["recall", "citation", "isolation", "nightly", "kill_switch", "defence"];
});

describe("recordDefence", () => {
  it("inserts only the answers and reports the new criteria count", async () => {
    const r = await recordDefence(LEARNER, { questions: six(), closing_passed: true, closing_note: "  " });
    expect(inserted).toEqual([{ learner_id: LEARNER, questions: six(), closing_passed: true, closing_note: null }]);
    expect(r).toEqual({ status: "saved", passed: true, metCount: 6, allMet: true, recordedAt: "2026-10-15T10:00:00Z" });
    expect(revalidatePath).toHaveBeenCalledWith(`/reviewer/${LEARNER}`);
  });

  it("refuses a reviewer's own defence before touching the database", async () => {
    user = { id: LEARNER };
    expect(await recordDefence(LEARNER, { questions: six(), closing_passed: true, closing_note: null })).toEqual({
      status: "error",
      error: "You can't record your own defence.",
    });
    expect(inserted).toHaveLength(0);
  });

  it("explains an RLS refusal (non-reviewer)", async () => {
    insertResult = { data: null, error: { code: "42501", message: "new row violates row-level security policy" } };
    const r = await recordDefence(LEARNER, { questions: six(), closing_passed: true, closing_note: null });
    expect(r).toEqual({ status: "error", error: "Only reviewers can record a defence, and never their own." });
  });

  it("validates input and the learner id", async () => {
    expect((await recordDefence("not-a-uuid", { questions: six(), closing_passed: true, closing_note: null })).status).toBe("error");
    expect((await recordDefence(LEARNER, { questions: six().slice(0, 5), closing_passed: true, closing_note: null })).status).toBe("error");
    expect(inserted).toHaveLength(0);
  });

  it("requires a session", async () => {
    user = null;
    expect((await recordDefence(LEARNER, { questions: six(), closing_passed: true, closing_note: null })).status).toBe("error");
  });
});
