import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { modules } from "@/content";

const MIGRATIONS_DIR = path.join(__dirname, "../../supabase/migrations");

// Minimal stand-ins for what Supabase provides: API roles, auth.users and
// auth.uid() reading the JWT subject from a session setting.
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
`;

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;

const migrationFiles = () => readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();

/**
 * Fresh database with content/ seeded. By default every migration is applied;
 * pass `upTo` (e.g. "0002") to stop there and apply the rest later with
 * `migrateRest()`, to test data migrations against existing rows.
 */
export async function createTestDb(opts: { upTo?: string } = {}) {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const files = migrationFiles();
  const cut = opts.upTo ? files.findIndex((f) => f.startsWith(`${opts.upTo}_`)) + 1 : files.length;
  if (cut === 0) throw new Error(`No migration ${opts.upTo}`);
  for (const file of files.slice(0, cut)) {
    await db.exec(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
  }

  // Seed real course content as the superuser (like scripts/seed.ts with the service role).
  for (const m of modules) {
    const { lesson_steps, quiz_items, failure_cases, ...row } = m;
    await insert(db, "modules", row);
    for (const s of lesson_steps) await insert(db, "lesson_steps", { code_snippet: null, code_language: null, ...s, module_id: m.id });
    for (const q of quiz_items) await insert(db, "quiz_items", { lesson_step_id: null, ...q, module_id: m.id });
    for (const f of failure_cases) await insert(db, "failure_cases", { ...f, module_id: m.id });
  }

  /** Run queries as an API role, optionally as a signed-in user. */
  async function as<T>(role: "anon" | "authenticated" | "service_role" | "superuser", userId: string | null, fn: () => Promise<T>): Promise<T> {
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? ""]);
    if (role !== "superuser") await db.exec(`set role ${role}`);
    try {
      return await fn();
    } finally {
      await db.exec("reset role");
    }
  }

  async function createUser(id: string, email: string) {
    await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, email]);
  }

  async function migrateRest() {
    for (const file of files.slice(cut)) {
      await db.exec(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
    }
  }

  return { db, as, createUser, migrateRest };
}

export async function insert(db: PGlite, table: string, row: Record<string, unknown>) {
  const cols = Object.keys(row);
  const values = cols.map((c) => {
    const v = row[c];
    return v !== null && typeof v === "object" && !Array.isArray(v) ? JSON.stringify(v) : Array.isArray(v) && typeof v[0] === "object" ? JSON.stringify(v) : v;
  });
  await db.query(
    `insert into public.${table} (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")})`,
    values,
  );
}
