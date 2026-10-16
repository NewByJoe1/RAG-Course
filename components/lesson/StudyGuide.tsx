import { Markdown } from "./Markdown";

export type StudyPoint = { id: string; point: string; narration: string };

/** Must-recall points. Each has a narration paragraph so the guide doubles as a video script. */
export function StudyGuide({ points, scriptHref, heading = true }: { points: StudyPoint[]; scriptHref: string; heading?: boolean }) {
  if (!points.length) return null;
  return (
    <section aria-labelledby={heading ? "study-guide-title" : undefined} aria-label={heading ? undefined : "Study guide points"} className="max-w-2xl space-y-5">
      {heading && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700 dark:text-teal-400">Remember</p>}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        {heading && (
          <h2 id="study-guide-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Study guide
          </h2>
        )}
        <a href={scriptHref} download className="text-sm underline">
          Download the narration script (.md)
        </a>
      </div>
      {heading && <p className="leading-relaxed text-neutral-600 dark:text-neutral-400">The points to remember. Check your warm-up answers against them.</p>}
      <ol className="space-y-3">
        {points.map((p, i) => (
          <li key={p.id} className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
            <p className="font-medium leading-relaxed">
              <span className="mr-2 tabular-nums text-neutral-500">{i + 1}.</span>
              <Markdown text={p.point} inline />
            </p>
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-neutral-500">Narration</summary>
              <p className="mt-2 leading-relaxed text-neutral-700 dark:text-neutral-300">{p.narration}</p>
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}
