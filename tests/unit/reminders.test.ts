import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  localHour,
  reminderDecision,
  reminderIdempotencyKey,
  renderReminderEmail,
  signUnsubscribe,
  unsubscribeUrl,
  verifyUnsubscribe,
  type ReminderCandidate,
} from "@/lib/reminders";
import { sendEmail } from "@/lib/email/resend";

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "test-secret");
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("RESEND_FROM_EMAIL", "RAG Course <reminders@example.com>");
});

const base: ReminderCandidate = {
  user_id: "u1",
  email: "learner@example.com",
  display_name: "Ada",
  timezone: "America/New_York",
  reminder_hour: 9,
  due_count: 3,
  last_review_reminder_at: null,
};

// 13:00 UTC on 2026-10-13 is 09:00 in New York (EDT, UTC-4).
const nineAmNY = new Date("2026-10-13T13:00:00Z");

describe("reminderDecision", () => {
  it("sends at the learner's chosen local hour", () => {
    expect(localHour(nineAmNY, "America/New_York")).toBe(9);
    expect(reminderDecision(base, nineAmNY)).toEqual({ send: true });
  });

  it("waits for their hour", () => {
    expect(reminderDecision(base, new Date("2026-10-13T12:00:00Z"))).toEqual({ send: false, reason: "not_their_hour" });
    expect(reminderDecision({ ...base, reminder_hour: 18 }, nineAmNY)).toEqual({ send: false, reason: "not_their_hour" });
  });

  it("skips learners with nothing due", () => {
    expect(reminderDecision({ ...base, due_count: 0 }, nineAmNY)).toEqual({ send: false, reason: "no_due_cards" });
  });

  it("sends once per local day", () => {
    // Already sent at 09:00 local today
    expect(reminderDecision({ ...base, last_review_reminder_at: "2026-10-13T13:00:00Z" }, new Date("2026-10-13T13:40:00Z"))).toEqual({
      send: false,
      reason: "already_sent_today",
    });
    // Sent yesterday local time: OK to send today
    expect(reminderDecision({ ...base, last_review_reminder_at: "2026-10-12T13:00:00Z" }, nineAmNY)).toEqual({ send: true });
  });

  it("judges 'today' in the learner's timezone, not UTC", () => {
    // 23:30 local on Oct 12 in New York = 03:30 UTC Oct 13. Same UTC day as nineAmNY, different local day.
    const lastNight = "2026-10-13T03:30:00Z";
    expect(reminderDecision({ ...base, last_review_reminder_at: lastNight }, nineAmNY)).toEqual({ send: true });
  });

  it("defaults to 9am UTC for missing settings", () => {
    const c = { ...base, timezone: null, reminder_hour: null };
    expect(reminderDecision(c, new Date("2026-10-13T09:15:00Z"))).toEqual({ send: true });
    expect(reminderDecision({ ...c, timezone: "Not/AZone" }, new Date("2026-10-13T09:15:00Z"))).toEqual({ send: true });
  });

  it("needs an email address", () => {
    expect(reminderDecision({ ...base, email: null }, nineAmNY)).toEqual({ send: false, reason: "no_email" });
  });
});

describe("unsubscribe links", () => {
  it("round-trips a signed user id", () => {
    expect(verifyUnsubscribe("u1", signUnsubscribe("u1"))).toBe(true);
  });

  it("rejects tampering", () => {
    expect(verifyUnsubscribe("u2", signUnsubscribe("u1"))).toBe(false);
    expect(verifyUnsubscribe("u1", "nope")).toBe(false);
    expect(verifyUnsubscribe(null, null)).toBe(false);
  });

  it("stops verifying when the secret rotates", () => {
    const sig = signUnsubscribe("u1");
    vi.stubEnv("CRON_SECRET", "rotated");
    expect(verifyUnsubscribe("u1", sig)).toBe(false);
  });

  it("builds a link on the site", () => {
    const url = new URL(unsubscribeUrl("https://course.example.com", "u1"));
    expect(url.pathname).toBe("/unsubscribe");
    expect(verifyUnsubscribe(url.searchParams.get("u"), url.searchParams.get("sig"))).toBe(true);
  });
});

describe("renderReminderEmail", () => {
  it("pluralises and links to review", () => {
    const e = renderReminderEmail({ displayName: "Ada", dueCount: 1, reviewUrl: "https://x/review", unsubscribeUrl: "https://x/u" });
    expect(e.subject).toBe("1 review card ready for review");
    expect(e.text).toContain("https://x/review");
    expect(e.html).toContain('href="https://x/u"');
    expect(renderReminderEmail({ displayName: null, dueCount: 5, reviewUrl: "r", unsubscribeUrl: "u" }).text).toMatch(/^Hi there,/);
  });

  it("escapes the display name in HTML", () => {
    const e = renderReminderEmail({ displayName: '<img src=x onerror="alert(1)">', dueCount: 2, reviewUrl: "r", unsubscribeUrl: "u" });
    expect(e.html).not.toContain("<img");
    expect(e.html).toContain("&lt;img");
  });
});

describe("reminderIdempotencyKey", () => {
  it("is stable within a local day", () => {
    expect(reminderIdempotencyKey("u1", nineAmNY, "America/New_York")).toBe("review-reminder/u1/2026-10-13");
  });
});

describe("sendEmail", () => {
  it("posts to Resend with auth, sender and idempotency key", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "email_123" }), { status: 200 }));
    const res = await sendEmail(
      { to: "a@example.com", subject: "s", html: "<p>h</p>", text: "t", idempotencyKey: "k1", headers: { "List-Unsubscribe": "<u>" } },
      fetchMock as unknown as typeof fetch,
    );
    expect(res).toEqual({ ok: true, id: "email_123" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers).toMatchObject({ Authorization: "Bearer re_test", "Idempotency-Key": "k1" });
    expect(JSON.parse(init.body as string)).toEqual({
      from: "RAG Course <reminders@example.com>",
      to: ["a@example.com"],
      subject: "s",
      html: "<p>h</p>",
      text: "t",
      headers: { "List-Unsubscribe": "<u>" },
    });
  });

  it("reports API errors", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ message: "domain not verified" }), { status: 403 }));
    expect(await sendEmail({ to: "a@example.com", subject: "s", html: "h", text: "t" }, fetchMock as unknown as typeof fetch)).toEqual({
      ok: false,
      status: 403,
      error: "domain not verified",
    });
  });

  it("refuses to send without configuration", async () => {
    vi.stubEnv("RESEND_FROM_EMAIL", "");
    const fetchMock = vi.fn();
    const res = await sendEmail({ to: "a@example.com", subject: "s", html: "h", text: "t" }, fetchMock as unknown as typeof fetch);
    expect(res.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
