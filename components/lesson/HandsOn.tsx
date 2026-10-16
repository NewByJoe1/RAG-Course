"use client";

import { useEffect, useRef, useState } from "react";
import { TIER_COPY, type HandsOnPlan } from "@/lib/course/hands-on";
import { Markdown } from "./Markdown";

/** The three hands-on tiers, revealed one at a time: guided, then partial, then solo. */
export function HandsOn({ plan }: { plan: HandsOnPlan }) {
  const [shown, setShown] = useState(1);
  const latest = useRef<HTMLHeadingElement>(null);
  const revealed = useRef(false);

  // Move focus to a newly revealed tier (not on first render).
  useEffect(() => {
    if (revealed.current) latest.current?.focus();
  }, [shown]);

  const total = plan.tiers.length;
  return (
    <div className="space-y-6">
      {plan.intro && (
        <div className="rounded-2xl bg-neutral-50 px-5 py-4 dark:bg-neutral-900">
          <Markdown text={plan.intro} />
        </div>
      )}

      <ol aria-label="Try it yourself" className="space-y-4">
        {plan.tiers.slice(0, shown).map((t, i) => {
          const copy = TIER_COPY[t.level];
          const done = i < shown - 1;
          return (
            <li
              key={t.level}
              className={`space-y-3 rounded-2xl border p-5 ${done ? "border-neutral-200 dark:border-neutral-800" : "border-teal-700/40 shadow-sm dark:border-teal-400/40"}`}
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700 dark:text-teal-400">
                  Try this · {i + 1} of {total}
                  {done && <span className="ml-2 normal-case tracking-normal text-neutral-500">✓ done</span>}
                </p>
                <h4 ref={i === shown - 1 ? latest : undefined} tabIndex={-1} className="mt-1 text-lg font-semibold tracking-tight text-neutral-900 focus:outline-none dark:text-white">
                  {copy.title}
                </h4>
                <p className="text-sm text-neutral-500">{copy.hint}</p>
              </div>
              <Markdown text={t.text} />
            </li>
          );
        })}
      </ol>

      {shown < total ? (
        <button
          type="button"
          onClick={() => {
            revealed.current = true;
            setShown(shown + 1);
          }}
          className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          Done? Show the next step →
        </button>
      ) : (
        <p className="text-sm text-neutral-500">That&apos;s all three. Nice work.</p>
      )}

      {plan.outro && <Markdown text={plan.outro} />}

      {plan.project.length > 0 && (
        <details className="group rounded-xl border border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <summary className="cursor-pointer list-none text-sm font-medium text-neutral-900 dark:text-white [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="mr-2 inline-block text-neutral-400 transition-transform group-open:rotate-90">
              ›
            </span>
            Show more: saving your work in the course project
          </summary>
          <dl className="mt-3 space-y-4">
            {plan.project.map((p) => (
              <div key={p.label}>
                <dt className="text-sm font-semibold text-neutral-900 dark:text-white">{p.label}</dt>
                <dd className="mt-1">
                  <Markdown text={p.text} size="sm" />
                </dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </div>
  );
}
