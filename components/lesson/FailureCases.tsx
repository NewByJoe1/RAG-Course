import { CauseReveal } from "@/components/failures/CauseReveal";
import type { CauseOption } from "@/lib/course/causes";
import { Markdown } from "./Markdown";

export type LessonFailureCase = {
  id: string;
  title: string;
  user_query: string;
  retrieved_context: { source: string; text: string; score?: number }[];
  bad_output: string;
  symptom: string;
  root_cause: string;
  fix: string;
  cause_options: CauseOption[] | null;
  correct_cause: string | null;
};

/** The module's failure cases inline, each with the "what caused this?" picker. */
export function FailureCases({ cases, heading = true }: { cases: LessonFailureCase[]; heading?: boolean }) {
  if (!cases.length) return null;
  return (
    <section aria-labelledby={heading ? "failure-cases-title" : undefined} aria-label={heading ? undefined : "Failure cases"} className="space-y-4">
      {heading && (
        <>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700 dark:text-teal-400">Practice</p>
      <h2 id="failure-cases-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
        When it goes wrong
      </h2>
      <p className="max-w-2xl text-neutral-600 dark:text-neutral-400">Three ways the subcontractor question goes wrong. For each one, read what came back and pick the cause before you reveal it.</p>
        </>
      )}
      <ol className="space-y-6 pt-2">
        {cases.map((c, i) => (
          <li key={c.id} id={c.id} className="space-y-4 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
            <h3 className="font-semibold">
              <span className="mr-2 text-neutral-500">{i + 1}.</span>
              {c.title}
            </h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="font-medium">Question</dt>
                <dd className="mt-1 rounded bg-neutral-100 p-2 font-mono dark:bg-neutral-900">{c.user_query}</dd>
              </div>
              {c.retrieved_context.length > 0 && (
                <div>
                  <dt className="font-medium">Retrieved</dt>
                  <dd className="mt-1 space-y-2">
                    {c.retrieved_context.map((r, j) => (
                      <p key={j} className="rounded border border-neutral-200 p-2 dark:border-neutral-800">
                        <span className="block text-xs text-neutral-500">
                          [{j + 1}] {r.source}
                          {r.score != null && ` · score ${r.score.toFixed(2)}`}
                        </span>
                        <Markdown text={r.text} inline />
                      </p>
                    ))}
                  </dd>
                </div>
              )}
              <div>
                <dt className="font-medium">Broken output</dt>
                <dd className="mt-1 rounded bg-red-50 p-2 dark:bg-red-950">{c.bad_output}</dd>
              </div>
            </dl>
            <CauseReveal caseId={c.id} rootCause={c.root_cause} fix={c.fix} causeOptions={c.cause_options} correctCause={c.correct_cause} />
          </li>
        ))}
      </ol>
    </section>
  );
}
