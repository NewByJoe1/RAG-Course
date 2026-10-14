import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { runReminderJob } = vi.hoisted(() => ({ runReminderJob: vi.fn() }));
vi.mock("@/lib/reminder-job", () => ({ runReminderJob }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

import { GET } from "@/app/api/cron/review-reminders/route";

const req = (auth?: string, query = "") =>
  new NextRequest(`http://localhost:3000/api/cron/review-reminders${query}`, { headers: auth ? { authorization: auth } : {} });

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("CRON_SECRET", "s3cret");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://course.example.com");
  runReminderJob.mockResolvedValue({ dryRun: true, candidates: 0, sent: 0, wouldSend: 0, failed: 0, skipped: {} });
});

describe("GET /api/cron/review-reminders", () => {
  it("rejects missing or wrong secrets", async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer wrong"))).status).toBe(401);
    expect(runReminderJob).not.toHaveBeenCalled();
  });

  it("rejects everything when CRON_SECRET isn't configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(req("Bearer "))).status).toBe(401);
  });

  it("is a dry run unless REVIEW_REMINDERS_ENABLED is exactly true", async () => {
    for (const v of [undefined, "", "false", "TRUE", "1"]) {
      vi.stubEnv("REVIEW_REMINDERS_ENABLED", v as string);
      await GET(req("Bearer s3cret"));
      expect(runReminderJob).toHaveBeenLastCalledWith(expect.objectContaining({ dryRun: true }));
    }
  });

  it("sends when enabled, unless ?dry_run=1", async () => {
    vi.stubEnv("REVIEW_REMINDERS_ENABLED", "true");
    await GET(req("Bearer s3cret"));
    expect(runReminderJob).toHaveBeenLastCalledWith(expect.objectContaining({ dryRun: false, siteUrl: "https://course.example.com" }));
    await GET(req("Bearer s3cret", "?dry_run=1"));
    expect(runReminderJob).toHaveBeenLastCalledWith(expect.objectContaining({ dryRun: true }));
  });

  it("returns 500 without details when the job throws", async () => {
    runReminderJob.mockRejectedValueOnce(new Error("db down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "job failed" });
    err.mockRestore();
  });
});
