import { beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createTestLearner, deleteTestLearner, TEST_ACCOUNT_MARKER } from "../../scripts/lib/test-learner";

/** In-memory stand-in for the parts of the Supabase admin API the scripts use. */
function fakeAdmin() {
  const users: { id: string; email: string; app_metadata: Record<string, unknown>; password?: string }[] = [];
  const tables: Record<string, Record<string, unknown>[]> = {
    profiles: [],
    progress: [],
    quiz_attempts: [],
    review_cards: [],
    review_log: [],
    capstone_checks: [],
    capstone_defences: [],
  };
  const calls: string[] = [];
  let n = 0;

  const query = (table: string) => {
    let rows = () => tables[table];
    const filters: ((r: Record<string, unknown>) => boolean)[] = [];
    let op: { kind: "select" | "update"; values?: Record<string, unknown>; head?: boolean } = { kind: "select" };
    const run = () => {
      const hit = rows().filter((r) => filters.every((f) => f(r)));
      if (op.kind === "update") {
        hit.forEach((r) => Object.assign(r, op.values));
        calls.push(`update ${table} ${JSON.stringify(op.values)} x${hit.length}`);
        return { data: hit, error: null };
      }
      return op.head ? { count: hit.length, error: null } : { data: hit, error: null };
    };
    const b: Record<string, unknown> = {
      select: (_c?: string, o?: { head?: boolean }) => ((op = { ...op, head: o?.head }), b),
      update: (values: Record<string, unknown>) => ((op = { kind: "update", values }), b),
      upsert: async (input: Record<string, unknown>[]) => {
        for (const r of input) {
          const i = tables[table].findIndex((x) => x.user_id === r.user_id && x.module_id === r.module_id);
          if (i >= 0) tables[table][i] = r;
          else tables[table].push(r);
        }
        calls.push(`upsert ${table} x${input.length}`);
        return { error: null };
      },
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), b),
      in: (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), b),
      not: (c: string) => (filters.push((r) => r[c] != null), b),
      then: (res: (v: unknown) => void) => res(run()),
    };
    void rows;
    return b;
  };

  const admin = {
    from: (t: string) => query(t),
    auth: {
      admin: {
        listUsers: async () => ({ data: { users }, error: null }),
        createUser: async (o: { email: string; password: string; app_metadata: Record<string, unknown>; email_confirm: boolean }) => {
          const u = { id: `u${++n}`, email: o.email, app_metadata: o.app_metadata, password: o.password };
          users.push(u);
          tables.profiles.push({ id: u.id, email: o.email, github_repo: null }); // signup trigger
          calls.push(`createUser confirm=${o.email_confirm}`);
          return { data: { user: u }, error: null };
        },
        updateUserById: async (id: string, o: { password: string }) => {
          users.find((u) => u.id === id)!.password = o.password;
          calls.push("updateUserById");
          return { error: null };
        },
        deleteUser: async (id: string) => {
          users.splice(users.findIndex((u) => u.id === id), 1);
          for (const [t, rows] of Object.entries(tables)) {
            const col = t === "profiles" ? "id" : t === "capstone_defences" ? "learner_id" : "user_id";
            tables[t] = rows.filter((r) => r[col] !== id); // ON DELETE CASCADE
          }
          calls.push("deleteUser");
          return { error: null };
        },
      },
    },
  };
  return { admin: admin as unknown as SupabaseClient, users, tables, calls };
}

const MODULES = Array.from({ length: 11 }, (_, i) => `m${String(i + 1).padStart(2, "0")}`);
const base = { email: "me+test-learner@example.com", password: "pw-123456", repo: "NewByJoe1/capstone-test-2", moduleIds: MODULES };

let f: ReturnType<typeof fakeAdmin>;
beforeEach(() => {
  f = fakeAdmin();
});

describe("createTestLearner", () => {
  it("creates a confirmed, tagged account with 11 passed modules and the repo linked", async () => {
    const r = await createTestLearner(f.admin, base);
    expect(r.created).toBe(true);
    expect(f.calls).toContain("createUser confirm=true");
    expect(f.users[0].app_metadata).toEqual({ test_account: TEST_ACCOUNT_MARKER });
    expect(f.tables.profiles[0]).toMatchObject({ github_repo: base.repo, display_name: "Test Learner" });
    expect(f.tables.progress.map((p) => p.module_id)).toEqual(MODULES);
    expect(f.tables.progress.every((p) => p.passed_at && p.status === "completed")).toBe(true);
  });

  it("is safe to re-run: reuses the account, resets the password, no duplicate rows", async () => {
    await createTestLearner(f.admin, base);
    const r = await createTestLearner(f.admin, { ...base, password: "new-pass-789" });
    expect(r.created).toBe(false);
    expect(f.users).toHaveLength(1);
    expect(f.users[0].password).toBe("new-pass-789");
    expect(f.tables.progress).toHaveLength(11);
  });

  it("refuses a repo linked to someone else, changing nothing", async () => {
    f.tables.profiles.push({ id: "owner", email: "owner@example.com", github_repo: "newbyjoe1/Capstone-Test-2" });
    await expect(createTestLearner(f.admin, base)).rejects.toThrow(/already linked to owner@example.com.*--take-over-repo/);
    expect(f.users).toHaveLength(0);
  });

  it("matches repo names exactly, not as a LIKE pattern", async () => {
    f.tables.profiles.push({ id: "other", email: "o@example.com", github_repo: "a/bxc" });
    await expect(createTestLearner(f.admin, { ...base, repo: "a/b_c" })).resolves.toMatchObject({ created: true });
  });

  it("can take the repo over, unlinking the previous holder", async () => {
    f.tables.profiles.push({ id: "owner", email: "owner@example.com", github_repo: base.repo });
    await createTestLearner(f.admin, { ...base, takeOverRepo: true });
    expect(f.tables.profiles.find((p) => p.id === "owner")!.github_repo).toBeNull();
    expect(f.tables.profiles.find((p) => p.id !== "owner")!.github_repo).toBe(base.repo);
  });

  it("never touches a real account that already uses the email", async () => {
    f.users.push({ id: "real", email: base.email, app_metadata: {} });
    await expect(createTestLearner(f.admin, base)).rejects.toThrow(/real \(non-test\) account/);
    expect(f.calls).toEqual([]);
  });
});

describe("deleteTestLearner", () => {
  it("deletes the account and verifies every learner table is empty", async () => {
    const { userId } = await createTestLearner(f.admin, base);
    f.tables.capstone_checks.push({ user_id: userId, check_key: "main" });
    const r = await deleteTestLearner(f.admin, { email: base.email });
    expect(r.deleted).toBe(true);
    expect(r.before).toMatchObject({ profiles: 1, progress: 11, capstone_checks: 1 });
    expect(Object.values(r.after!).every((n) => n === 0)).toBe(true);
    expect(f.users).toHaveLength(0);
  });

  it("refuses an account that isn't tagged as the test learner", async () => {
    f.users.push({ id: "real", email: base.email, app_metadata: {} });
    await expect(deleteTestLearner(f.admin, { email: base.email })).rejects.toThrow(/not tagged as the test learner/);
    expect(f.calls).not.toContain("deleteUser");
  });

  it("refuses if the account has recorded defences as a reviewer", async () => {
    const { userId } = await createTestLearner(f.admin, base);
    f.tables.capstone_defences.push({ learner_id: "someone", reviewer_id: userId });
    await expect(deleteTestLearner(f.admin, { email: base.email })).rejects.toThrow(/recorded 1 defence/);
  });

  it("is a no-op when the account doesn't exist", async () => {
    expect(await deleteTestLearner(f.admin, { email: base.email })).toEqual({ deleted: false, before: null, after: null });
  });
});
