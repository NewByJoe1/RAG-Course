import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { modules } from "@/content";
import { GLOSSARY, glossaryRow } from "@/content/glossary";

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

// Migrations marked "-- pglite: skip" need Supabase-only extensions (pg_cron, pg_net, Vault).
const migrationFiles = () =>
  readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .filter((f) => !/^-- pglite: skip/m.test(readFileSync(path.join(MIGRATIONS_DIR, f), "utf8")))
    .sort();

/**
 * Fresh database with content/ seeded. By default every migration is applied;
 * pass `upTo` (e.g. "0002") to stop there and apply the rest later with
 * `migrateRest()`, to test data migrations against existing rows. Pass
 * `modules` to seed only those content modules (e.g. the ones that existed
 * when an old migration ran).
 */
export async function createTestDb(opts: { upTo?: string; modules?: string[] } = {}) {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const files = migrationFiles();
  const cut = opts.upTo ? files.findIndex((f) => f.startsWith(`${opts.upTo}_`)) + 1 : files.length;
  if (cut === 0) throw new Error(`No migration ${opts.upTo}`);
  for (const file of files.slice(0, cut)) {
    await db.exec(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
  }

  // When stopping early (upTo), the schema predates some content fields
  // (e.g. 0006's cause_options): seed only the columns that exist yet, as the
  // live database would have held them. With every migration applied, an
  // unknown column still fails loudly.
  let existing: ((table: string, row: Record<string, unknown>) => Record<string, unknown>) | null = null;
  if (opts.upTo) {
    const { rows } = await db.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns where table_schema = 'public'`,
    );
    const cols = new Map<string, Set<string>>();
    for (const r of rows) cols.set(r.table_name, (cols.get(r.table_name) ?? new Set()).add(r.column_name));
    existing = (table, row) => Object.fromEntries(Object.entries(row).filter(([k]) => cols.get(table)?.has(k)));
  }
  const tableExists = async (table: string) =>
    (await db.query(`select 1 from information_schema.tables where table_schema = 'public' and table_name = $1`, [table])).rows.length > 0;
  const seed = (table: string, row: Record<string, unknown>) => insert(db, table, existing ? existing(table, row) : row);
  const hasLessonFormat = await tableExists("worked_example_steps");
  if (hasLessonFormat) for (const g of GLOSSARY) await seed("glossary_terms", glossaryRow(g));

  // Seed real course content as the superuser (like scripts/seed.ts with the service role).
  for (const m of modules.filter((x) => !opts.modules || opts.modules.includes(x.id))) {
    const { lesson_steps, quiz_items, failure_cases, worked_example, glossary, study_guide, ...row } = m;
    await seed("modules", row);
    if (hasLessonFormat) {
      for (const w of worked_example ?? []) await seed("worked_example_steps", { code_snippet: null, code_language: null, stage: null, query_state: null, ...w, module_id: m.id });
      for (const p of study_guide ?? []) await seed("study_guide_points", { ...p, module_id: m.id });
      const terms = glossary ?? [];
      for (let i = 0; i < terms.length; i++) await seed("module_glossary", { module_id: m.id, term_id: terms[i], order_index: i + 1 });
    }
    for (const s of lesson_steps) {
      // Before 0010 there was no 'warm_up' kind; warm-ups were plain exercises.
      const kind = !hasLessonFormat && s.kind === "warm_up" ? "exercise" : s.kind;
      await seed("lesson_steps", { code_snippet: null, code_language: null, ...s, kind, module_id: m.id });
    }
    for (const q of quiz_items) await seed("quiz_items", { lesson_step_id: null, ...q, module_id: m.id });
    for (const f of failure_cases) await seed("failure_cases", { cause_options: null, correct_cause: null, ...f, module_id: m.id });
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
