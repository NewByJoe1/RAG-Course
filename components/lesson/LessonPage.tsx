import Link from "next/link";
import { neighbours, type LessonTab } from "@/lib/course/lesson-tabs";
import type { LessonStepRow } from "@/lib/course/lesson-data";
import { parseHandsOn } from "@/lib/course/hands-on";
import { Markdown } from "./Markdown";
import { HandsOn } from "./HandsOn";
import { SystemPicker } from "./System";

/** True when the text has steps that differ by kind of computer. */
export const hasSystemSteps = (md: string) => /^:::(mac|windows|linux)\s*$/m.test(md);

// Building blocks shared by every tab page of the lesson.

export const eyebrow = "text-xs font-semibold uppercase tracking-[0.14em] text-teal-700 dark:text-teal-400";

/** The page's title (its only h1), with a small label above and an optional intro. */
export function TabHeader({ kicker, title, intro }: { kicker: string; title: string; intro?: string }) {
  return (
    <header className="max-w-2xl space-y-2">
      <p className={eyebrow}>{kicker}</p>
      <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-white">{title}</h1>
      {intro && <p className="text-lg leading-relaxed text-neutral-600 dark:text-neutral-400">{intro}</p>}
    </header>
  );
}

/** Back and Next at the bottom of every page, so learners can go straight through. */
export function LessonPager({ tabs, current }: { tabs: LessonTab[]; current: string }) {
  const { prev, next } = neighbours(tabs, current);
  const link = "group flex min-w-0 flex-1 flex-col rounded-2xl border border-neutral-200 px-4 py-3 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600";
  return (
    <nav aria-label="Back and next" className="flex max-w-2xl gap-3 border-t border-neutral-200 pt-8 dark:border-neutral-800">
      {prev ? (
        <Link href={prev.href} rel="prev" className={link}>
          <span className="text-xs text-neutral-500">← Back</span>
          <span className="truncate font-medium text-neutral-900 dark:text-white">{prev.label}</span>
        </Link>
      ) : (
        <span className="flex-1" />
      )}
      {next ? (
        <Link href={next.href} rel="next" className={`${link} items-end text-right`}>
          <span className="text-xs text-neutral-500">Next →</span>
          <span className="max-w-full truncate font-medium text-neutral-900 dark:text-white">{next.label}</span>
        </Link>
      ) : (
        <span className="flex-1" />
      )}
    </nav>
  );
}

function Code({ s }: { s: LessonStepRow }) {
  if (!s.code_snippet) return null;
  const isCode = !["markdown", "text"].includes(s.code_language ?? "");
  return (
    <details className="group max-w-2xl rounded-xl border border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <summary className="cursor-pointer list-none text-sm font-medium text-neutral-900 dark:text-white [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="mr-2 inline-block text-neutral-400 transition-transform group-open:rotate-90">
          ›
        </span>
        {isCode ? "Show more: the code" : "Show more: the whole file"}
      </summary>
      <pre className="mt-3 overflow-x-auto rounded-xl bg-neutral-100 p-4 text-sm leading-relaxed dark:bg-neutral-900">
        <code>{s.code_snippet}</code>
      </pre>
    </details>
  );
}

/** A lesson step's body at reading width: hands-on steps reveal their tiers one at a time. */
export function StepBody({ s }: { s: LessonStepRow }) {
  const plan = s.kind === "exercise" ? parseHandsOn(s.body_md) : null;
  return (
    <div className="max-w-2xl space-y-6">
      {hasSystemSteps(s.body_md) && <SystemPicker />}
      {plan ? <HandsOn plan={plan} /> : <Markdown text={s.body_md} />}
      <Code s={s} />
    </div>
  );
}
