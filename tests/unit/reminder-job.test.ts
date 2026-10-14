import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runReminderJob } from "@/lib/reminder-job";
import type { ReminderCandidate } from "@/lib/reminders";

beforeEach(() => vi.stubEnv("CRON_SECRET", "test-secret"));

const nineAmUTC = new Date("2026-10-13T09:10:00Z");
const candidate = (over: Partial<ReminderCandidate> = {}): ReminderCandidate => ({
  user_id: "u1",
  email: "a@example.com",
  display_name: "Ada",
  timezone: "UTC",
  reminder_hour: 9,
  due_count: 2,
  last_review_reminder_at: null,
  ...over,
});

/** Fake admin client recording profile updates; `claimRows` controls whether the claim wins. */
function fakeAdmin(candidates: ReminderCandidate[], claimRows = 1) {
  const updates: { values: Record<string, unknown>; filters: [string, string, unknown][] }[] = [];
  const admin = {
    rpc: vi.fn(async () => ({ data: candidates, error: null })),
    from: () => ({
      update: (values: Record<string, unknown>) => {
        const entry = { values, filters: [] as [string, string, unknown][] };
        updates.push(entry);
        const q = {
          eq: (c: string, v: unknown) => (entry.filters.push(["eq", c, v]), q),
          is: (c: string, v: unknown) => (entry.filters.push(["is", c, v]), q),
          select: async () => ({ data: Array.from({ length: claimRows }, () => ({ id: "u1" })), error: null }),
          then: (r: (v: unknown) => void) => r({ error: null }),
        };
        return q;
      },
    }),
  };
  return { admin: admin as unknown as SupabaseClient, updates };
}

describe("runReminderJob", () => {
  it("dry run sends nothing and writes nothing", async () => {
    const { admin, updates } = fakeAdmin([candidate(), candidate({ user_id: "u2", due_count: 0 })]);
    const send = vi.fn();
    const s = await runReminderJob({ admin, siteUrl: "https://x", now: nineAmUTC, dryRun: true, send });
    expect(s).toMatchObject({ dryRun: true, candidates: 2, wouldSend: 1, sent: 0, skipped: { no_due_cards: 1 } });
    expect(send).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it("claims, then sends with unsubscribe headers and an idempotency key", async () => {
    const { admin, updates } = fakeAdmin([candidate()]);
    const send = vi.fn(async () => ({ ok: true as const, id: "e1" }));
    const s = await runReminderJob({ admin, siteUrl: "https://x", now: nineAmUTC, dryRun: false, send });

    expect(s).toMatchObject({ sent: 1, failed: 0 });
    expect(updates[0]).toEqual({
      values: { last_review_reminder_at: nineAmUTC.toISOString() },
      filters: [["eq", "id", "u1"], ["is", "last_review_reminder_at", null]],
    });
    const msg = (send.mock.calls[0] as unknown[])[0] as { to: string; idempotencyKey: string; headers: Record<string, string>; text: string };
    expect(msg.to).toBe("a@example.com");
    expect(msg.idempotencyKey).toBe("review-reminder/u1/2026-10-13");
    expect(msg.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(msg.headers["List-Unsubscribe"]).toMatch(/^<https:\/\/x\/api\/reminders\/unsubscribe\?u=u1&sig=/);
    expect(msg.text).toContain("https://x/review");
  });

  it("skips when another run already claimed the send", async () => {
    const { admin } = fakeAdmin([candidate()], 0);
    const send = vi.fn();
    const s = await runReminderJob({ admin, siteUrl: "https://x", now: nineAmUTC, dryRun: false, send });
    expect(s.skipped).toEqual({ claimed_elsewhere: 1 });
    expect(send).not.toHaveBeenCalled();
  });

  it("releases the claim when Resend fails so the next run can retry", async () => {
    const { admin, updates } = fakeAdmin([candidate({ last_review_reminder_at: "2026-10-12T09:05:00Z" })]);
    const send = vi.fn(async () => ({ ok: false as const, status: 500, error: "boom" }));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const s = await runReminderJob({ admin, siteUrl: "https://x", now: nineAmUTC, dryRun: false, send });
    expect(s).toMatchObject({ sent: 0, failed: 1 });
    expect(updates[1].values).toEqual({ last_review_reminder_at: "2026-10-12T09:05:00Z" });
    err.mockRestore();
  });

  it("doesn't email outside the learner's hour", async () => {
    const { admin } = fakeAdmin([candidate({ reminder_hour: 18 })]);
    const send = vi.fn();
    const s = await runReminderJob({ admin, siteUrl: "https://x", now: nineAmUTC, dryRun: false, send });
    expect(s.skipped).toEqual({ not_their_hour: 1 });
    expect(send).not.toHaveBeenCalled();
  });
});
