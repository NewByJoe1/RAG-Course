import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildMasteryGrid, type MasteryLevel } from "@/lib/course/mastery";
import { formatPercent } from "@/lib/course/quiz";

export const metadata = { title: "Mastery · RAG Course" };

const LEVELS: Record<MasteryLevel, { label: string; cls: string }> = {
  unseen: { label: "Not attempted", cls: "bg-neutral-200 dark:bg-neutral-800" },
  learning: { label: "Missed last time", cls: "bg-red-400 dark:bg-red-700" },
  correct: { label: "Correct once", cls: "bg-amber-300 dark:bg-amber-600" },
  mastered: { label: "Mastered (correct twice in a row)", cls: "bg-green-500 dark:bg-green-600" },
};

export default async function MasteryPage() {
  const supabase = createClient();
  const [{ data: modules }, { data: items }, { data: attempts }, { data: progress }] = await Promise.all([
    supabase.from("modules").select("id, slug, title, order_index").order("order_index"),
    supabase.from("quiz_items").select("id, module_id, order_index, prompt"),
    supabase.from("quiz_attempts").select("quiz_item_id, is_correct, attempted_at"),
    supabase.from("progress").select("module_id, best_score, passed_at"),
  ]);

  const rows = buildMasteryGrid(modules ?? [], items ?? [], attempts ?? [], progress ?? []);

  return (
    <div className="space-y-6 py-10">
      <h1 className="text-3xl font-semibold">Mastery</h1>

      <ul className="flex flex-wrap gap-4 text-sm">
        {Object.entries(LEVELS).map(([k, v]) => (
          <li key={k} className="flex items-center gap-2">
            <span className={`inline-block h-4 w-4 rounded ${v.cls}`} aria-hidden /> {v.label}
          </li>
        ))}
      </ul>

      <table className="w-full border-separate border-spacing-y-2 text-sm">
        <thead className="text-left text-neutral-500">
          <tr>
            <th className="font-medium">Module</th>
            <th className="font-medium">Questions</th>
            <th className="text-right font-medium">Best</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.module.id} className={row.unlocked ? "" : "opacity-50"}>
              <td className="pr-4 align-top">
                {row.unlocked ? (
                  <Link href={`/modules/${row.module.slug}`} className="underline-offset-4 hover:underline">
                    {row.module.order_index}. {row.module.title}
                  </Link>
                ) : (
                  <span>🔒 {row.module.order_index}. {row.module.title}</span>
                )}
                {row.passed && <span className="ml-2 text-green-700 dark:text-green-400">✓ passed</span>}
              </td>
              <td className="align-top">
                <div className="flex flex-wrap gap-1">
                  {row.cells.map((c, i) => (
                    <span
                      key={c.item.id}
                      title={`Q${i + 1}: ${c.item.prompt}\n${LEVELS[c.level].label} · ${c.attempts} attempt${c.attempts === 1 ? "" : "s"}`}
                      aria-label={`Question ${i + 1}: ${LEVELS[c.level].label}`}
                      className={`inline-block h-6 w-6 rounded ${LEVELS[c.level].cls}`}
                    />
                  ))}
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  {row.masteredCount}/{row.cells.length} mastered
                </p>
              </td>
              <td className="text-right align-top tabular-nums">{formatPercent(row.bestScore)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
