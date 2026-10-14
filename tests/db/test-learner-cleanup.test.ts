import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./pglite";
import { LEARNER_TABLES } from "../../scripts/lib/test-learner";

const LEARNER = "00000000-0000-0000-0000-00000000f001";
const REVIEWER = "00000000-0000-0000-0000-00000000f002";
let t: TestDb;
const q = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => t.db.query<T>(sql, params);

beforeAll(async () => {
  t = await createTestDb();
  await t.createUser(LEARNER, "test-learner@example.com");
  await t.createUser(REVIEWER, "rev@example.com");
  await q(`update public.profiles set github_repo = 'o/capstone', is_reviewer = false where id = $1`, [LEARNER]);
  await q(`update public.profiles set is_reviewer = true where id = $1`, [REVIEWER]);

  // A row in every learner table.
  await q(`insert into public.progress (user_id, module_id, status, passed_at) values ($1, 'm01', 'completed', now())`, [LEARNER]);
  await q(`insert into public.quiz_attempts (user_id, quiz_item_id, response, is_correct) values ($1, 'm01-q01', '{}', true)`, [LEARNER]);
  const card = await q<{ id: string }>(`insert into public.review_cards (user_id, quiz_item_id) values ($1, 'm01-q01') returning id`, [LEARNER]);
  await q(`insert into public.review_log (user_id, card_id, rating, interval_days) values ($1, $2, 'good', 7)`, [LEARNER, card.rows[0].id]);
  await q(`insert into public.capstone_checks (user_id, check_key, ci_status) values ($1, 'main', 'success')`, [LEARNER]);
  const six = JSON.stringify(Array.from({ length: 6 }, () => ({ question: "Q", citation_verified: true, passed: true })));
  await t.as("authenticated", REVIEWER, () =>
    q(`insert into public.capstone_defences (learner_id, questions, closing_passed) values ($1, $2, true)`, [LEARNER, six]),
  );
});

describe("deleting the test learner's auth account", () => {
  it("lists every table that references profiles", async () => {
    const { rows } = await q<{ table_name: string; column_name: string }>(`
      select kcu.table_name, kcu.column_name
      from information_schema.referential_constraints rc
      join information_schema.key_column_usage kcu on kcu.constraint_name = rc.constraint_name and kcu.table_schema = 'public'
      join information_schema.constraint_column_usage ccu on ccu.constraint_name = rc.unique_constraint_name
      where ccu.table_name = 'profiles' and ccu.table_schema = 'public'`);
    const referencing = rows.map((r) => `${r.table_name}.${r.column_name}`).sort();
    const covered = LEARNER_TABLES.filter(([t]) => t !== "profiles").map(([t, c]) => `${t}.${c}`);
    // capstone_defences.reviewer_id is deliberately excluded: the delete script refuses reviewer accounts.
    expect(referencing).toEqual([...covered, "capstone_defences.reviewer_id"].sort());
  });

  it("removes every one of its rows by cascade", async () => {
    const count = async () => {
      const out: Record<string, number> = {};
      for (const [table, col] of LEARNER_TABLES) {
        const { rows } = await q<{ n: number }>(`select count(*)::int as n from public.${table} where ${col} = $1`, [LEARNER]);
        out[table] = rows[0].n;
      }
      return out;
    };
    expect(Object.values(await count()).every((n) => n === 1)).toBe(true);

    await q(`delete from auth.users where id = $1`, [LEARNER]);

    expect(await count()).toEqual(Object.fromEntries(LEARNER_TABLES.map(([table]) => [table, 0])));
    // The reviewer is untouched.
    expect((await q(`select 1 from public.profiles where id = $1`, [REVIEWER])).rows).toHaveLength(1);
  });
});
