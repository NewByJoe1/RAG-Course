import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Failure gallery · RAG Course" };

const CATEGORIES = {
  retrieval_miss: "Retrieval miss",
  chunking: "Chunking",
  ranking: "Ranking",
  context_overflow: "Context overflow",
  hallucination: "Hallucination",
  stale_index: "Stale index",
  prompt: "Prompt",
} as const;
type Category = keyof typeof CATEGORIES;

const isCategory = (v: string | undefined): v is Category => !!v && v in CATEGORIES;

type ContextChunk = { source: string; text: string; score?: number };

export default async function FailureGallery({ searchParams }: { searchParams: { category?: string } }) {
  const category = isCategory(searchParams.category) ? searchParams.category : undefined;
  const supabase = createClient();

  let query = supabase
    .from("failure_cases")
    .select("id, title, category, user_query, retrieved_context, bad_output, symptom, root_cause, fix, order_index, modules!inner(title, slug, order_index)")
    .order("order_index", { referencedTable: "modules" })
    .order("order_index");
  if (category) query = query.eq("category", category);
  const { data: cases, error } = await query;

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 ${active ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900" : "border-neutral-300 dark:border-neutral-700"}`;

  return (
    <div className="space-y-6 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Failure gallery</h1>
        <p className="text-neutral-600 dark:text-neutral-400">Real ways RAG pipelines go wrong, what it looks like, and how to fix it.</p>
      </header>

      <nav aria-label="Filter by category" className="flex flex-wrap gap-2 text-sm">
        <Link href="/failures" className={chip(!category)}>All</Link>
        {Object.entries(CATEGORIES).map(([k, label]) => (
          <Link key={k} href={`/failures?category=${k}`} className={chip(category === k)}>{label}</Link>
        ))}
      </nav>

      {error && <p role="alert" className="text-red-700">Couldn&apos;t load failure cases.</p>}
      {cases && cases.length === 0 && <p className="text-neutral-500">No failure cases in this category yet.</p>}

      <ul className="space-y-4">
        {(cases ?? []).map((c) => {
          const mod = c.modules as unknown as { title: string; slug: string };
          return (
            <li key={c.id} id={c.id} className="rounded-lg border border-neutral-200 dark:border-neutral-800">
              <details className="group p-4">
                <summary className="cursor-pointer list-none space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded bg-neutral-100 px-2 py-0.5 dark:bg-neutral-800">{CATEGORIES[c.category as Category]}</span>
                    <span className="text-neutral-500">{mod.title}</span>
                  </div>
                  <h2 className="text-lg font-medium">{c.title}</h2>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">{c.symptom}</p>
                  <span className="text-sm underline group-open:hidden">Show the full case</span>
                </summary>

                <dl className="mt-4 space-y-4 text-sm">
                  <div>
                    <dt className="font-medium">User query</dt>
                    <dd className="mt-1 rounded bg-neutral-100 p-2 font-mono dark:bg-neutral-900">{c.user_query}</dd>
                  </div>
                  <div>
                    <dt className="font-medium">Retrieved context</dt>
                    <dd className="mt-1 space-y-2">
                      {(c.retrieved_context as ContextChunk[]).map((r, i) => (
                        <div key={i} className="rounded border border-neutral-200 p-2 dark:border-neutral-800">
                          <p className="text-xs text-neutral-500">
                            [{i + 1}] {r.source}
                            {r.score != null && ` · score ${r.score.toFixed(2)}`}
                          </p>
                          <p>{r.text}</p>
                        </div>
                      ))}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium">Model output</dt>
                    <dd className="mt-1 rounded bg-red-50 p-2 dark:bg-red-950">{c.bad_output}</dd>
                  </div>
                  <div>
                    <dt className="font-medium">Root cause</dt>
                    <dd className="mt-1">{c.root_cause}</dd>
                  </div>
                  <div>
                    <dt className="font-medium">Fix</dt>
                    <dd className="mt-1 rounded bg-green-50 p-2 dark:bg-green-950">{c.fix}</dd>
                  </div>
                </dl>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
