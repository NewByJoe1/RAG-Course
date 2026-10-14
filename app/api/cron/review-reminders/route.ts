import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runReminderJob } from "@/lib/reminder-job";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/**
 * Hourly cron: emails learners whose chosen reminder hour it is and who have
 * cards due. Real sends need REVIEW_REMINDERS_ENABLED=true; otherwise (or
 * with ?dry_run=1) it only reports what it would do.
 */
export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const dryRun =
    process.env.REVIEW_REMINDERS_ENABLED !== "true" || request.nextUrl.searchParams.get("dry_run") === "1";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;

  try {
    const summary = await runReminderJob({ admin: createAdminClient(), siteUrl, dryRun });
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[reminders] job failed:", err);
    return NextResponse.json({ error: "job failed" }, { status: 500 });
  }
}
