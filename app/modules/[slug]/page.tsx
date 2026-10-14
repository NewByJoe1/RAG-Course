import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QuizForm, type QuizFormItem } from "@/components/quiz/QuizForm";
import { formatPercent } from "@/lib/course/quiz";

// Access (sign-in + unlock) is enforced by middleware and, for quiz
// submission, by public.submit_module_quiz().
export default async function ModulePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { locked?: string };
}) {
  const supabase = createClient();

  const { data: mod } = await supabase
    .from("modules")
    .select("id, slug, title, summary, learning_objectives, estimated_minutes")
    .eq("slug", params.slug)
    .maybeSingle();
  if (!mod) notFound();

  const [{ data: steps }, { data: items }, { data: progress }] = await Promise.all([
    supabase
      .from("lesson_steps")
      .select("id, order_index, kind, title, body_md, code_snippet, code_language")
      .eq("module_id", mod.id)
      .order("order_index"),
    supabase
      .from("quiz_items")
      .select("id, kind, prompt, choices, order_index")
      .eq("module_id", mod.id)
      .order("order_index"),
    supabase.from("progress").select("best_score, passed_at").eq("module_id", mod.id).maybeSingle(),
  ]);

  return (
    <article className="space-y-10 py-10">
      {searchParams.locked && (
        <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          That module is locked. Pass this module&apos;s quiz to unlock it.
        </p>
      )}

      <header className="space-y-3">
        <h1 className="text-3xl font-semibold">{mod.title}</h1>
        <p className="text-neutral-600 dark:text-neutral-400">{mod.summary}</p>
        {progress?.passed_at ? (
          <p className="text-sm font-medium text-green-700 dark:text-green-400">Passed · best score {formatPercent(progress.best_score)}</p>
        ) : progress?.best_score != null ? (
          <p className="text-sm text-neutral-500">Best score so far {formatPercent(progress.best_score)}</p>
        ) : null}
        {mod.learning_objectives.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {mod.learning_objectives.map((o: string) => <li key={o}>{o}</li>)}
          </ul>
        )}
      </header>

      <section className="space-y-8">
        {(steps ?? []).map((s) => (
          <div key={s.id} className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{s.kind}</p>
            <h2 className="text-xl font-semibold">{s.title}</h2>
            <div className="whitespace-pre-wrap leading-relaxed">{s.body_md}</div>
            {s.code_snippet && (
              <pre className="overflow-x-auto rounded-md bg-neutral-100 p-4 text-sm dark:bg-neutral-900">
                <code>{s.code_snippet}</code>
              </pre>
            )}
          </div>
        ))}
      </section>

      {items && items.length > 0 && (
        <section className="space-y-4 border-t border-neutral-200 pt-8 dark:border-neutral-800">
          <h2 className="text-2xl font-semibold">Module quiz</h2>
          <QuizForm moduleId={mod.id} slug={mod.slug} items={items as QuizFormItem[]} />
        </section>
      )}
    </article>
  );
}
