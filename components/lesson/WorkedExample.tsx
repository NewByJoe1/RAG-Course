"use client";

import { useId, useState } from "react";
import { stageLabel, type PipelineStageId } from "@/content/pipeline";
import { Markdown } from "./Markdown";

export type WorkedStep = {
  id: string;
  title: string;
  body_md: string;
  code_snippet: string | null;
  stage: PipelineStageId | null;
  query_state: string | null;
};

/** Step-through worked example following the running question through the pipeline. */
export function WorkedExample({ steps }: { steps: WorkedStep[] }) {
  const uid = useId();
  const [i, setI] = useState(0);
  const step = steps[i];
  if (!step) return null;
  const btn = "rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium disabled:opacity-40 dark:border-neutral-700";

  return (
    <section aria-labelledby={`${uid}-title`} className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`${uid}-title`} className="text-xl font-semibold tracking-tight">
          Worked example, step by step
        </h3>
        <p className="text-sm text-neutral-500" aria-live="polite">
          Step {i + 1} of {steps.length}
        </p>
      </div>

      <ol aria-label="Steps" className="flex flex-wrap gap-1.5">
        {steps.map((s, j) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => setI(j)}
              aria-current={j === i ? "step" : undefined}
              aria-label={`Step ${j + 1}: ${s.title}${j < i ? " (done)" : ""}`}
              className={`h-8 min-w-8 rounded-full border px-2 text-xs font-medium tabular-nums ${
                j === i
                  ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                  : j < i
                    ? "border-neutral-400 dark:border-neutral-500"
                    : "border-dashed border-neutral-300 dark:border-neutral-700"
              }`}
            >
              {j < i ? "✓" : j + 1}
            </button>
          </li>
        ))}
      </ol>

      <article className="space-y-4 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-semibold">{step.title}</h4>
          {step.stage && <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-mono text-xs dark:bg-neutral-800">{stageLabel(step.stage)}</span>}
        </div>
        <Markdown text={step.body_md} size="sm" />
        {step.code_snippet && (
          <pre className="overflow-x-auto rounded-lg bg-neutral-100 p-3 text-xs dark:bg-neutral-900">
            <code>{step.code_snippet}</code>
          </pre>
        )}
        {step.query_state && (
          <p className="rounded-lg border-l-4 border-teal-700 bg-teal-50 px-3 py-2 text-sm dark:border-teal-400 dark:bg-teal-950">
            <span className="font-medium">The question now: </span>
            <Markdown text={step.query_state} inline terms={false} />
          </p>
        )}
      </article>

      <div className="flex gap-3">
        <button type="button" className={btn} onClick={() => setI(i - 1)} disabled={i === 0}>
          ← Previous
        </button>
        <button type="button" className={btn} onClick={() => setI(i + 1)} disabled={i === steps.length - 1}>
          Next step →
        </button>
      </div>
    </section>
  );
}
