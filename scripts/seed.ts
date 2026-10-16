/**
 * Seeds course content (modules, lesson_steps, quiz_items, failure_cases)
 * from content/ into Supabase.
 *
 *   npm run seed            upsert all modules
 *   npm run seed -- --dry-run   validate content only, no network
 *   npm run seed -- --prune     also delete rows in seeded modules that are no
 *                               longer in content/ (cascades to learner data
 *                               such as quiz_attempts for removed quiz items)
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The service
 * role bypasses RLS, so never run this from the browser or expose the key.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { modules as rawModules } from "../content";
import { moduleSchema } from "../content/types";
import { GLOSSARY, glossaryRow } from "../content/glossary";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const prune = args.has("--prune");

function validate() {
  const parsed = z.array(moduleSchema).safeParse(rawModules);
  if (!parsed.success) {
    console.error("Content validation failed:\n" + z.prettifyError(parsed.error));
    process.exit(1);
  }
  const ids = parsed.data.map((m) => m.id);
  if (new Set(ids).size !== ids.length) {
    console.error("Duplicate module ids in content/index.ts");
    process.exit(1);
  }
  return parsed.data;
}

async function main() {
  const modules = validate();

  for (const m of modules) {
    const extras = m.hook ? `; lesson format: ${m.worked_example.length} worked steps, ${m.glossary.length} glossary terms, ${m.study_guide.length} study points` : "";
    console.log(
      `${m.id} ${m.title}: ${m.lesson_steps.length} steps, ${m.quiz_items.length} quiz items, ${m.failure_cases.length} failure cases${extras}`,
    );
  }
  if (dryRun) {
    console.log("Dry run: content is valid, nothing written.");
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (see .env.example).");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const check = (label: string, error: { message: string } | null) => {
    if (error) throw new Error(`${label}: ${error.message}`);
  };

  // The shared glossary first: modules point at its terms.
  check("glossary_terms", (await supabase.from("glossary_terms").upsert(GLOSSARY.map(glossaryRow), { onConflict: "id" })).error);

  for (const m of modules) {
    const { lesson_steps, quiz_items, failure_cases, worked_example, glossary, study_guide, ...moduleRow } = m;

    // Parents before children so foreign keys resolve.
    check(`modules ${m.id}`, (await supabase.from("modules").upsert(moduleRow, { onConflict: "id" })).error);

    const steps = lesson_steps.map((s) => ({ ...s, module_id: m.id }));
    const quizzes = quiz_items.map((q) => ({ ...q, module_id: m.id }));
    const failures = failure_cases.map((f) => ({ ...f, module_id: m.id }));
    const worked = worked_example.map((w) => ({ ...w, module_id: m.id }));
    const points = study_guide.map((p) => ({ ...p, module_id: m.id }));

    if (prune) {
      for (const [table, rows] of [
        ["quiz_items", quizzes],
        ["failure_cases", failures],
        ["lesson_steps", steps],
        ["worked_example_steps", worked],
        ["study_guide_points", points],
      ] as const) {
        const keep = rows.map((r) => r.id);
        let q = supabase.from(table).delete().eq("module_id", m.id);
        if (keep.length) q = q.not("id", "in", `(${keep.join(",")})`);
        check(`prune ${table} ${m.id}`, (await q).error);
      }
    }

    // order_index is unique per module, so reordering existing rows can collide
    // mid-upsert. Park current rows at negative indexes first.
    for (const table of ["lesson_steps", "quiz_items", "failure_cases", "worked_example_steps", "study_guide_points"] as const) {
      const { data, error } = await supabase.from(table).select("id, order_index").eq("module_id", m.id);
      check(`read ${table} ${m.id}`, error);
      for (const row of data ?? []) {
        check(
          `park ${table} ${row.id}`,
          (await supabase.from(table).update({ order_index: -1 - row.order_index }).eq("id", row.id)).error,
        );
      }
    }

    if (steps.length) check(`lesson_steps ${m.id}`, (await supabase.from("lesson_steps").upsert(steps, { onConflict: "id" })).error);
    if (quizzes.length) check(`quiz_items ${m.id}`, (await supabase.from("quiz_items").upsert(quizzes, { onConflict: "id" })).error);
    if (failures.length) check(`failure_cases ${m.id}`, (await supabase.from("failure_cases").upsert(failures, { onConflict: "id" })).error);
    if (worked.length) check(`worked_example_steps ${m.id}`, (await supabase.from("worked_example_steps").upsert(worked, { onConflict: "id" })).error);
    if (points.length) check(`study_guide_points ${m.id}`, (await supabase.from("study_guide_points").upsert(points, { onConflict: "id" })).error);
    // The module's glossary list is a plain mapping: replace it.
    check(`module_glossary ${m.id}`, (await supabase.from("module_glossary").delete().eq("module_id", m.id)).error);
    if (glossary.length) {
      const rows = glossary.map((term_id, i) => ({ module_id: m.id, term_id, order_index: i + 1 }));
      check(`module_glossary ${m.id}`, (await supabase.from("module_glossary").insert(rows)).error);
    }

    console.log(`Seeded ${m.id}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
