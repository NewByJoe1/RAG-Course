import { createHmac, timingSafeEqual } from "node:crypto";
import { dayKey, isValidTimeZone } from "./streak";

// Daily review reminders. The cron job runs hourly; a learner is emailed once
// per local calendar day, during the hour they chose (profiles.reminder_hour),
// and only if they have at least one card due.

export const DEFAULT_REMINDER_HOUR = 9;

export type ReminderCandidate = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  timezone: string | null;
  reminder_hour: number | null;
  due_count: number;
  last_review_reminder_at: string | null;
};

export function localHour(now: Date, tz: string | null): number {
  const h = new Intl.DateTimeFormat("en-US", {
    timeZone: isValidTimeZone(tz) ? tz : "UTC",
    hour: "numeric",
    hourCycle: "h23",
  }).format(now);
  return Number(h);
}

export type SkipReason = "no_due_cards" | "no_email" | "not_their_hour" | "already_sent_today";

export function reminderDecision(c: ReminderCandidate, now: Date): { send: true } | { send: false; reason: SkipReason } {
  const tz = isValidTimeZone(c.timezone) ? c.timezone : "UTC";
  if (c.due_count <= 0) return { send: false, reason: "no_due_cards" };
  if (!c.email || !c.email.includes("@")) return { send: false, reason: "no_email" };
  if (localHour(now, tz) !== (c.reminder_hour ?? DEFAULT_REMINDER_HOUR)) return { send: false, reason: "not_their_hour" };
  if (c.last_review_reminder_at && dayKey(new Date(c.last_review_reminder_at), tz) === dayKey(now, tz)) {
    return { send: false, reason: "already_sent_today" };
  }
  return { send: true };
}

// --- Unsubscribe tokens ----------------------------------------------------

function unsubscribeKey(): string {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET is required to sign unsubscribe links");
  return `unsubscribe-v1:${secret}`; // domain-separated from the cron bearer token
}

export function signUnsubscribe(userId: string): string {
  return createHmac("sha256", unsubscribeKey()).update(userId).digest("base64url");
}

export function verifyUnsubscribe(userId: string | null, sig: string | null): boolean {
  if (!userId || !sig) return false;
  const expected = Buffer.from(signUnsubscribe(userId));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function unsubscribeUrl(siteUrl: string, userId: string): string {
  const u = new URL("/unsubscribe", siteUrl);
  u.searchParams.set("u", userId);
  u.searchParams.set("sig", signUnsubscribe(userId));
  return u.toString();
}

// --- Email content ---------------------------------------------------------

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderReminderEmail(args: {
  displayName: string | null;
  dueCount: number;
  reviewUrl: string;
  unsubscribeUrl: string;
}) {
  const { dueCount, reviewUrl } = args;
  const name = args.displayName?.trim() || "there";
  const cards = `${dueCount} review card${dueCount === 1 ? "" : "s"}`;
  const subject = `${cards} ready for review`;

  const text = [
    `Hi ${name},`,
    "",
    `You have ${cards} due in your RAG course. A few minutes now keeps them from slipping.`,
    "",
    `Start reviewing: ${reviewUrl}`,
    "",
    `Stop these reminders: ${args.unsubscribeUrl}`,
  ].join("\n");

  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#171717">
<p>Hi ${escapeHtml(name)},</p>
<p>You have <strong>${escapeHtml(cards)}</strong> due in your RAG course. A few minutes now keeps them from slipping.</p>
<p><a href="${escapeHtml(reviewUrl)}" style="display:inline-block;background:#171717;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Start reviewing</a></p>
<p style="font-size:12px;color:#737373"><a href="${escapeHtml(args.unsubscribeUrl)}" style="color:#737373">Stop these reminders</a></p>
</body></html>`;

  return { subject, text, html };
}

/** Idempotency key so a retried run can't email someone twice in a day. */
export function reminderIdempotencyKey(userId: string, now: Date, tz: string | null): string {
  return `review-reminder/${userId}/${dayKey(now, tz ?? "UTC")}`;
}
