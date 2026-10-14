import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./pglite";
import { modules } from "@/content";

const ALICE = "00000000-0000-0000-0000-0000000000a1";
const BOB = "00000000-0000-0000-0000-0000000000b1";

const m01 = modules.find((m) => m.id === "m01")!;

function answers(nCorrect: number) {
  return Object.fromEntries(
    m01.quiz_items.map((q, i) => {
      if (i >= nCorrect) return [q.id, { choice: "zzz", choices: ["zzz"], text: "zzz" }];
      if (q.kind === "single_choice") return [q.id, { choice: q.answer.choice }];
      if (q.kind === "multi_choice") return [q.id, { choices: q.answer.choices }];
      return [q.id, { text: q.answer.accepted[0] }];
    }),
  );
}

let t: TestDb;
const q = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => t.db.query<T>(sql, params);
const asUser = <T>(id: string, fn: () => Promise<T>) => t.as("authenticated", id, fn);
const submit = (id: string, nCorrect: number) =>
  asUser(id, () => q<{ r: { passed: boolean; cards_enrolled: number } }>(`select public.submit_module_quiz('m01', $1) as r`, [JSON.stringify(answers(nCorrect))])).then(
    (res) => res.rows[0].r,
  );

beforeAll(async () => {
  t = await createTestDb();
  await t.createUser(ALICE, "alice@example.com");
  await t.createUser(BOB, "bob@example.com");
});

describe("card enrolment", () => {
  it("creates no cards for a failed attempt, even for wrong answers", async () => {
    const r = await submit(ALICE, 3);
    expect(r).toMatchObject({ passed: false, cards_enrolled: 0 });
    const { rows } = await q(`select 1 from public.review_cards where user_id = $1`, [ALICE]);
    expect(rows).toHaveLength(0);
  });

  it("on first pass, creates one card per quiz item and per failure case, due in 2 days", async () => {
    const r = await submit(ALICE, 7);
    expect(r).toMatchObject({ passed: true, cards_enrolled: m01.quiz_items.length + m01.failure_cases.length });

    const { rows } = await q<{ quiz: number; failure: number; bad_interval: number; due_min: string; due_max: string }>(
      `select count(quiz_item_id)::int as quiz, count(failure_case_id)::int as failure,
              count(*) filter (where interval_days <> 2)::int as bad_interval,
              extract(epoch from min(due_at) - now())::text as due_min,
              extract(epoch from max(due_at) - now())::text as due_max
       from public.review_cards where user_id = $1`,
      [ALICE],
    );
    expect(rows[0]).toMatchObject({ quiz: 7, failure: 3, bad_interval: 0 });
    const twoDays = 2 * 86400;
    expect(Number(rows[0].due_min)).toBeCloseTo(twoDays, -1);
    expect(Number(rows[0].due_max)).toBeCloseTo(twoDays, -1);
  });

  it("doesn't re-enrol or reschedule cards on a later pass", async () => {
    await q(`update public.review_cards set due_at = now() - interval '1 hour', last_reviewed_at = now() where user_id = $1`, [ALICE]);
    const r = await submit(ALICE, 7);
    expect(r.cards_enrolled).toBe(0);
    const { rows } = await q<{ n: number }>(`select count(*)::int as n from public.review_cards where user_id = $1 and due_at < now()`, [ALICE]);
    expect(rows[0].n).toBe(10);
  });

  it("resets a never-reviewed legacy card to the 2-day start", async () => {
    // A card created by the old wrong-answer rule: due immediately, never reviewed.
    await q(`insert into public.review_cards (user_id, quiz_item_id, interval_days, due_at) values ($1, 'm01-q01', 0, now())`, [BOB]);
    await submit(BOB, 7);
    const { rows } = await q<{ interval_days: number; future: boolean }>(
      `select interval_days, due_at > now() + interval '47 hours' as future from public.review_cards where user_id = $1 and quiz_item_id = 'm01-q01'`,
      [BOB],
    );
    expect(rows[0]).toEqual({ interval_days: 2, future: true });
  });

  it("requires exactly one of quiz item or failure case", async () => {
    await expect(q(`insert into public.review_cards (user_id) values ($1)`, [ALICE])).rejects.toThrow(/review_cards_one_source/);
    await expect(
      q(`insert into public.review_cards (user_id, quiz_item_id, failure_case_id) values ($1, 'm01-q02', 'm01-f02')`, [BOB]),
    ).rejects.toThrow(/review_cards_one_source/);
  });

  it("won't let learners enrol cards through the internal function", async () => {
    await expect(asUser(ALICE, () => q(`select public.enroll_review_cards($1, 'm01')`, [ALICE]))).rejects.toThrow(/permission denied/);
  });
});

describe("reviewing", () => {
  it("lets learners reschedule and log their own cards only", async () => {
    const { rows: cards } = await q<{ id: string }>(`select id from public.review_cards where user_id = $1 limit 1`, [ALICE]);
    const card = cards[0].id;

    const upd = await asUser(ALICE, () => q(`update public.review_cards set interval_days = 7 where id = $1 returning id`, [card]));
    expect(upd.rows).toHaveLength(1);
    await asUser(ALICE, () => q(`insert into public.review_log (card_id, rating, interval_days) values ($1, 'good', 7)`, [card]));

    const bobUpd = await asUser(BOB, () => q(`update public.review_cards set interval_days = 99 where id = $1 returning id`, [card]));
    expect(bobUpd.rows).toHaveLength(0);
    await expect(
      asUser(BOB, () => q(`insert into public.review_log (card_id, rating, interval_days) values ($1, 'good', 7)`, [card])),
    ).rejects.toThrow(/row-level security/);
    const bobSees = await asUser(BOB, () => q(`select 1 from public.review_log`));
    expect(bobSees.rows).toHaveLength(0);
  });

  it("rejects unknown ratings", async () => {
    const { rows } = await q<{ id: string }>(`select id from public.review_cards where user_id = $1 limit 1`, [ALICE]);
    await expect(
      asUser(ALICE, () => q(`insert into public.review_log (card_id, rating, interval_days) values ($1, 'perfect', 7)`, [rows[0].id])),
    ).rejects.toThrow(/check constraint/);
  });
});

describe("reminder settings", () => {
  it("lets learners change timezone, hour and opt-out", async () => {
    const r = await asUser(ALICE, () =>
      q(`update public.profiles set timezone = 'America/New_York', reminder_hour = 7, review_reminders = false where id = $1 returning timezone`, [ALICE]),
    );
    expect(r.rows).toEqual([{ timezone: "America/New_York" }]);
  });

  it("keeps last_review_reminder_at server-only and the hour in range", async () => {
    await expect(asUser(ALICE, () => q(`update public.profiles set last_review_reminder_at = now() where id = $1`, [ALICE]))).rejects.toThrow(
      /permission denied/,
    );
    await expect(asUser(ALICE, () => q(`update public.profiles set reminder_hour = 24 where id = $1`, [ALICE]))).rejects.toThrow(/check constraint/);
  });

  it("lists only opted-in learners with due cards, for the service role only", async () => {
    await q(`update public.review_cards set due_at = now() - interval '1 minute' where user_id = $1`, [BOB]);
    const { rows } = await t.as("service_role", null, () =>
      q<{ user_id: string; due_count: number; reminder_hour: number }>(`select user_id, due_count, reminder_hour from public.review_reminder_candidates()`),
    );
    // Alice opted out above; Bob has 10 due cards and the default 9am hour.
    expect(rows).toEqual([{ user_id: BOB, due_count: 10, reminder_hour: 9 }]);

    await expect(asUser(BOB, () => q(`select * from public.review_reminder_candidates()`))).rejects.toThrow(/permission denied/);
    await expect(t.as("anon", null, () => q(`select * from public.review_reminder_candidates()`))).rejects.toThrow(/permission denied/);
  });
});

describe("streak history", () => {
  const CAROL = "00000000-0000-0000-0000-0000000000c1";

  it("buckets quiz attempts and reviews by the learner's local day", async () => {
    await t.createUser(CAROL, "carol@example.com");
    await q(`update public.profiles set timezone = 'America/Los_Angeles' where id = $1`, [CAROL]);
    await q(`insert into public.review_cards (user_id, quiz_item_id) values ($1, 'm01-q01')`, [CAROL]);
    const { rows: c } = await q<{ id: string }>(`select id from public.review_cards where user_id = $1`, [CAROL]);
    // 03:30 UTC Oct 14 = 20:30 Oct 13 in Los Angeles
    await q(`insert into public.quiz_attempts (user_id, quiz_item_id, response, is_correct, attempted_at) values ($1, 'm01-q01', '{}', true, '2026-10-14T03:30:00Z')`, [CAROL]);
    await q(`insert into public.review_log (user_id, card_id, rating, interval_days, reviewed_at) values ($1, $2, 'good', 7, '2026-10-12T18:00:00Z')`, [CAROL, c[0].id]);
    await q(`insert into public.review_log (user_id, card_id, rating, interval_days, reviewed_at) values ($1, $2, 'good', 7, '2026-10-12T19:00:00Z')`, [CAROL, c[0].id]);

    const { rows } = await asUser(CAROL, () => q<{ day: Date; events: number }>(`select day::text as day, events from public.my_activity_days()`));
    expect(rows).toEqual([
      { day: "2026-10-12", events: 2 },
      { day: "2026-10-13", events: 1 },
    ]);

    const since = await asUser(CAROL, () => q(`select day from public.my_activity_days('2026-10-13')`));
    expect(since.rows).toHaveLength(1);
  });

  it("falls back to UTC for an unknown timezone", async () => {
    await q(`update public.profiles set timezone = 'Mars/Olympus' where id = $1`, [CAROL]);
    const { rows } = await asUser(CAROL, () => q<{ day: string }>(`select day::text as day from public.my_activity_days()`));
    expect(rows.map((r) => r.day)).toEqual(["2026-10-12", "2026-10-14"]);
  });

  it("is not callable anonymously", async () => {
    await expect(t.as("anon", null, () => q(`select * from public.my_activity_days()`))).rejects.toThrow(/permission denied/);
  });
});
