"use client";

import { useId, useState } from "react";
import { exampleFor, moduleNumber, PIPELINE, type PipelineStage, type PipelineStageId } from "@/content/pipeline";
import { Markdown } from "@/components/lesson/Markdown";

type Status = { kind: "here" } | { kind: "earlier"; module: number } | { kind: "later"; module: number } | null;

/** Where a stage sits relative to the module being read. */
function statusOf(stage: PipelineStage, current: PipelineStageId[], moduleId?: string): Status {
  if (current.includes(stage.id)) return { kind: "here" };
  if (!moduleId) return null;
  const at = moduleNumber(moduleId);
  const nums = stage.modules.map(moduleNumber);
  const earlier = nums.filter((n) => n < at);
  if (earlier.length) return { kind: "earlier", module: earlier[0] };
  const later = nums.filter((n) => n > at);
  return later.length ? { kind: "later", module: later[0] } : null;
}

/**
 * The course's reference spine: the RAG pipeline with "you are here" markers.
 * Every stage shows a plain one-liner and the module that covers it in depth.
 * Hover (mouse) previews a stage; tap, click, Enter or Space pins it open;
 * Escape closes. The current stages are marked with an icon and the words
 * "You are here", not colour alone; stages a later module adds are faded.
 */
export function PipelineDiagram({
  current = [],
  moduleId,
  title = "Where you are in the pipeline",
}: {
  current?: PipelineStageId[];
  /** The module being read, e.g. "m01", to mark earlier and later stages. */
  moduleId?: string;
  title?: string;
}) {
  const uid = useId();
  const panelId = `${uid}-panel`;
  const [pinned, setPinned] = useState<PipelineStageId | null>(current[0] ?? null);
  const [hovered, setHovered] = useState<PipelineStageId | null>(null);
  const activeId = hovered ?? pinned;
  const active = PIPELINE.find((s) => s.id === activeId) ?? null;

  const toggle = (id: PipelineStageId) => {
    setHovered(null);
    setPinned((p) => (p === id ? null : id));
  };

  return (
    <section aria-labelledby={`${uid}-title`} className="space-y-5" onKeyDown={(e) => e.key === "Escape" && (setPinned(null), setHovered(null))}>
      <div className="space-y-2">
        <h3 id={`${uid}-title`} className="text-xl font-semibold tracking-tight">
          {title}
        </h3>
        <p className="max-w-2xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          A finished contract assistant has seven stages.
          {current.length > 0 && " 📍 marks what this module builds. Faded stages are added in later modules, each one to fix a mistake you'll meet along the way."}{" "}
          Hover, tap or press Enter on a stage to see how it works.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
        <ol aria-label="RAG pipeline stages" className="space-y-2">
          {PIPELINE.map((s) => {
            const status = statusOf(s, current, moduleId);
            const isCurrent = status?.kind === "here";
            const isLater = status?.kind === "later";
            const isActive = activeId === s.id;
            const isBranch = s.id === "routing";
            return (
              <li key={s.id} className={isBranch ? "pl-6" : undefined}>
                <button
                  type="button"
                  aria-expanded={isActive}
                  aria-controls={panelId}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`[${s.number}] ${s.label}${isCurrent ? ", you are here" : ""}`}
                  onClick={() => toggle(s.id)}
                  onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(s.id)}
                  onPointerLeave={(e) => e.pointerType === "mouse" && setHovered(null)}
                  className={[
                    "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 dark:focus-visible:ring-white",
                    isCurrent ? "border-2 border-teal-700 dark:border-teal-400" : `border ${isBranch ? "border-dashed" : ""} border-neutral-200 dark:border-neutral-800`,
                    isActive ? "bg-neutral-100 dark:bg-neutral-800" : "bg-white hover:bg-neutral-50 dark:bg-neutral-950 dark:hover:bg-neutral-900",
                    isLater && !isActive ? "opacity-60" : "",
                  ].join(" ")}
                >
                  <span
                    aria-hidden
                    className={`mt-0.5 flex h-7 min-w-7 items-center justify-center rounded-full px-1 font-mono text-xs font-semibold ${
                      isCurrent ? "bg-teal-700 text-white dark:bg-teal-400 dark:text-neutral-950" : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                    }`}
                  >
                    {s.number}
                  </span>
                  <span className="min-w-0 space-y-0.5">
                    <span className="block font-semibold text-neutral-900 dark:text-white">
                      {isBranch && <span aria-hidden className="mr-1 text-neutral-400">↳</span>}
                      {s.label}
                    </span>
                    <span className="block text-sm leading-snug text-neutral-600 dark:text-neutral-400">{s.plain}</span>
                    <span className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-xs">
                      {isCurrent && (
                        <span className="font-semibold text-teal-800 dark:text-teal-300">
                          <span aria-hidden>📍 </span>You are here
                        </span>
                      )}
                      {status?.kind === "later" && (
                        <span className="font-medium text-neutral-600 dark:text-neutral-400">
                          Not built yet{status.module !== moduleNumber(s.coveredIn) && `: added in Module ${status.module}`}
                        </span>
                      )}
                      {status?.kind === "earlier" && <span className="font-medium text-neutral-600 dark:text-neutral-400">Built in Module {status.module}</span>}
                      <span className="text-neutral-500">Covered in Module {moduleNumber(s.coveredIn)}</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div id={panelId} role="region" aria-live="polite" aria-label="Stage details" className="rounded-2xl border border-neutral-200 p-5 md:sticky md:top-20 dark:border-neutral-800">
          {active ? (
            <StageDetails stage={active} status={statusOf(active, current, moduleId)} moduleId={moduleId} />
          ) : (
            <p className="text-sm text-neutral-500">Choose a stage to see what it does, why it&apos;s there and how it&apos;s done.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function StageDetails({ stage, status, moduleId }: { stage: PipelineStage; status: Status; moduleId?: string }) {
  // The running example as of this module; the finished pipeline for stages not built yet.
  const sofar = moduleId && status?.kind !== "later" ? exampleFor(stage, moduleId) : null;
  const example: [string, string] = sofar
    ? [`The subcontractor question, as of Module ${moduleNumber(moduleId!)}`, sofar.text]
    : [moduleId ? "Once it's built" : "With the whole pipeline built", stage.example];
  const rows: [string, string][] = [["What it does", stage.does], ["Why it's there", stage.why], example];
  const others = stage.modules.filter((m) => m !== stage.coveredIn).map(moduleNumber);
  const seen = new Set<string>(); // underline each term once per panel
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <div className="space-y-1">
        <p className="font-mono text-xs text-neutral-500">Stage [{stage.number}]</p>
        <p className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">
          {stage.label}
          {status?.kind === "here" && <span className="ml-2 text-sm font-medium text-teal-700 dark:text-teal-300">· this module</span>}
        </p>
        <p className="text-neutral-700 dark:text-neutral-300">
          <Markdown text={stage.plain} inline seen={seen} />
        </p>
      </div>
      <dl className="space-y-3">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="font-medium text-neutral-900 dark:text-white">{k}</dt>
            <dd className="mt-0.5 text-neutral-700 dark:text-neutral-300">
              <Markdown text={v} inline seen={seen} />
            </dd>
          </div>
        ))}
      </dl>
      <details className="group rounded-xl border border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <summary className="cursor-pointer list-none font-medium text-neutral-900 dark:text-white [&::-webkit-details-marker]:hidden">
          <span aria-hidden className="mr-2 inline-block text-neutral-400 transition-transform group-open:rotate-90">
            ›
          </span>
          Show more: how it&apos;s done
        </summary>
        <div className="mt-3">
          <Markdown text={stage.how} size="sm" seen={seen} />
        </div>
      </details>
      <p className="text-xs text-neutral-500">
        Covered in Module {moduleNumber(stage.coveredIn)}
        {others.length > 0 && `, and also in Module${others.length > 1 ? "s" : ""} ${others.join(" and ")}`}.
      </p>
    </div>
  );
}
