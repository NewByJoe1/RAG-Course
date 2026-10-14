import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { computeModuleLocks } from "@/lib/course/gating";
import { formatPercent } from "@/lib/course/quiz";

export default async function Home({ searchParams }: { searchParams: { locked?: string; gate_error?: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: modules } = await supabase
    .from("modules")
    .select("id, slug, title, summary, order_index, estimated_minutes")
    .order("order_index");

  const { data: progress } = user
    ? await supabase.from("progress").select("module_id, best_score, passed_at")
    : { data: [] };

  const passed = (progress ?? []).filter((p) => p.passed_at).map((p) => p.module_id);
  const locks = computeModuleLocks(modules ?? [], passed);
  const progressBy = new Map((progress ?? []).map((p) => [p.module_id, p]));

  return (
    <div className="space-y-8 py-10">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold">Retrieval-augmented generation, end to end</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Work through each module, pass its quiz with 80% or more, and the next one unlocks.
        </p>
        {!user && (
          <p>
            <Link href="/signup" className="underline">Create an account</Link> to track your progress.
          </p>
        )}
      </section>

      {searchParams.gate_error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          We couldn&apos;t check access to that module. Try again in a moment.
        </p>
      )}

      <ol className="space-y-3">
        {(modules ?? []).map((m) => {
          const lock = locks.get(m.id);
          const locked = Boolean(user) && lock && !lock.unlocked;
          const p = progressBy.get(m.id);
          return (
            <li key={m.id} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-medium">
                  {locked ? (
                    <span className="text-neutral-500">🔒 {m.order_index}. {m.title}</span>
                  ) : (
                    <Link href={`/modules/${m.slug}`} className="underline-offset-4 hover:underline">
                      {m.order_index}. {m.title}
                    </Link>
                  )}
                </h2>
                <span className="text-sm text-neutral-500">
                  {p?.passed_at ? `Passed · best ${formatPercent(p.best_score)}` : p?.best_score != null ? `Best ${formatPercent(p.best_score)}` : `${m.estimated_minutes} min`}
                </span>
              </div>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{m.summary}</p>
              {locked && <p className="mt-2 text-sm text-neutral-500">Pass the previous module&apos;s quiz to unlock.</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
