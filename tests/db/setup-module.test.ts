import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./pglite";

// Module 0 ("Set up your workshop") has no quiz: ticking "My setup works"
// (public.complete_setup()) passes it, and that unlocks Module 1 through the
// usual gate. Migration 0011 also keeps Module 1 open for learners who had
// already started the course.

const NEW = "00000000-0000-0000-0000-00000000a0a1";
const OTHER = "00000000-0000-0000-0000-00000000a0b1";
let t: TestDb;

const gate = (userId: string, slug: string) =>
  t.as("authenticated", userId, async () => {
    const { rows } = await t.db.query<{ unlocked: boolean; prev_slug: string | null }>(`select unlocked, prev_slug from public.module_gate($1)`, [slug]);
    return rows[0];
  });
const passedSetup = async (userId: string) =>
  (await t.db.query(`select 1 from public.progress where user_id = $1 and module_id = 'm00' and passed_at is not null`, [userId])).rows.length === 1;

beforeAll(async () => {
  t = await createTestDb();
  await t.createUser(NEW, "new@example.com");
  await t.createUser(OTHER, "other@example.com");
});

describe("0011 set-up module", () => {
  it("is open to everyone, and locks Module 1 until set-up is done", async () => {
    expect(await gate(NEW, "setup")).toEqual({ unlocked: true, prev_slug: null });
    expect(await gate(NEW, "rag-foundations")).toEqual({ unlocked: false, prev_slug: "setup" });
  });

  it("unlocks Module 1 when the learner ticks \"My setup works\", for that learner only", async () => {
    await t.completeSetup(NEW);
    expect(await passedSetup(NEW)).toBe(true);
    expect(await gate(NEW, "rag-foundations")).toEqual({ unlocked: true, prev_slug: "setup" });
    expect(await gate(OTHER, "rag-foundations")).toMatchObject({ unlocked: false });
    expect(await gate(NEW, "pre-retrieval")).toMatchObject({ unlocked: false }); // Module 2 still needs Module 1's quiz
  });

  it("can be ticked again without changing the first pass time", async () => {
    const first = await t.db.query<{ passed_at: string }>(`select passed_at from public.progress where user_id = $1 and module_id = 'm00'`, [NEW]);
    await t.completeSetup(NEW);
    const again = await t.db.query<{ passed_at: string }>(`select passed_at from public.progress where user_id = $1 and module_id = 'm00'`, [NEW]);
    expect(again.rows[0].passed_at).toEqual(first.rows[0].passed_at);
  });

  it("refuses visitors who aren't signed in, and learners can't write progress themselves", async () => {
    await expect(t.as("anon", null, () => t.db.query(`select public.complete_setup()`))).rejects.toThrow(/permission denied/);
    await expect(
      t.as("authenticated", OTHER, () => t.db.query(`insert into public.progress (user_id, module_id, passed_at) values ($1, 'm00', now())`, [OTHER])),
    ).rejects.toThrow(/permission denied/);
    expect(await passedSetup(OTHER)).toBe(false);
  });
});

describe("0011 backfill", () => {
  it("keeps Module 1 open for learners who had already started the course", async () => {
    const db = await createTestDb({ upTo: "0010" });
    await db.createUser(OTHER, "earlier@example.com");
    await db.db.query(`insert into public.progress (user_id, module_id, status, started_at) values ($1, 'm01', 'in_progress', now())`, [OTHER]);
    await db.migrateRest();
    const { rows } = await db.db.query(`select passed_at from public.progress where user_id = $1 and module_id = 'm00'`, [OTHER]);
    expect(rows).toHaveLength(1);
    expect(rows[0].passed_at).not.toBeNull();
  });
});
