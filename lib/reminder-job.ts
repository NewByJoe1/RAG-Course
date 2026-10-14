import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, type EmailMessage, type SendResult } from "./email/resend";
import {
  reminderDecision,
  reminderIdempotencyKey,
  renderReminderEmail,
  signUnsubscribe,
  unsubscribeUrl,
  type ReminderCandidate,
  type SkipReason,
} from "./reminders";

export type ReminderRunSummary = {
  dryRun: boolean;
  candidates: number;
  sent: number;
  wouldSend: number;
  failed: number;
  skipped: Partial<Record<SkipReason | "claimed_elsewhere", number>>;
};

/**
 * One pass of the daily-reminder job. With dryRun, nothing is sent and the
 * database isn't written; the summary says who would have been emailed.
 */
export async function runReminderJob(opts: {
  admin: SupabaseClient;
  siteUrl: string;
  now?: Date;
  dryRun: boolean;
  send?: (msg: EmailMessage) => Promise<SendResult>;
}): Promise<ReminderRunSummary> {
  const { admin, siteUrl, dryRun } = opts;
  const now = opts.now ?? new Date();
  const send = opts.send ?? ((m: EmailMessage) => sendEmail(m));

  const { data, error } = await admin.rpc("review_reminder_candidates", { p_now: now.toISOString() });
  if (error) throw new Error(`review_reminder_candidates: ${error.message}`);
  const candidates = (data ?? []) as ReminderCandidate[];

  const summary: ReminderRunSummary = { dryRun, candidates: candidates.length, sent: 0, wouldSend: 0, failed: 0, skipped: {} };
  const skip = (r: SkipReason | "claimed_elsewhere") => (summary.skipped[r] = (summary.skipped[r] ?? 0) + 1);

  for (const c of candidates) {
    const decision = reminderDecision(c, now);
    if (!decision.send) {
      skip(decision.reason);
      continue;
    }
    if (dryRun) {
      summary.wouldSend++;
      continue;
    }

    // Claim the send so an overlapping run can't email the same person.
    let claim = admin.from("profiles").update({ last_review_reminder_at: now.toISOString() }).eq("id", c.user_id);
    claim = c.last_review_reminder_at ? claim.eq("last_review_reminder_at", c.last_review_reminder_at) : claim.is("last_review_reminder_at", null);
    const { data: claimed, error: claimError } = await claim.select("id");
    if (claimError || !claimed?.length) {
      skip("claimed_elsewhere");
      continue;
    }

    const email = renderReminderEmail({
      displayName: c.display_name,
      dueCount: c.due_count,
      reviewUrl: new URL("/review", siteUrl).toString(),
      unsubscribeUrl: unsubscribeUrl(siteUrl, c.user_id),
    });
    const oneClick = new URL("/api/reminders/unsubscribe", siteUrl);
    oneClick.searchParams.set("u", c.user_id);
    oneClick.searchParams.set("sig", signUnsubscribe(c.user_id));

    const result = await send({
      to: c.email!,
      ...email,
      headers: { "List-Unsubscribe": `<${oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      idempotencyKey: reminderIdempotencyKey(c.user_id, now, c.timezone),
    });

    if (result.ok) {
      summary.sent++;
    } else {
      summary.failed++;
      console.error(`[reminders] send failed for ${c.user_id}: ${result.status} ${result.error}`);
      // Release the claim so the next hourly run can retry today.
      await admin.from("profiles").update({ last_review_reminder_at: c.last_review_reminder_at }).eq("id", c.user_id);
    }
  }

  return summary;
}
