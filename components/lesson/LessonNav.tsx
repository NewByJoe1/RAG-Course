"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { currentTab, type LessonTab } from "@/lib/course/lesson-tabs";

const storageKey = (moduleId: string) => `lesson-visited:${moduleId}`;

function readVisited(moduleId: string): string[] {
  try {
    const raw = window.localStorage.getItem(storageKey(moduleId));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((k): k is string => typeof k === "string") : [];
  } catch {
    return [];
  }
}

function writeVisited(moduleId: string, keys: string[]) {
  try {
    window.localStorage.setItem(storageKey(moduleId), JSON.stringify(keys));
  } catch {
    // Private mode or blocked storage: ticks just won't persist.
  }
}

/**
 * The lesson's tab sidebar: one link per page, the current one highlighted,
 * visited ones ticked (remembered in this browser only). Below the md
 * breakpoint it collapses into a menu at the top of the page.
 */
export function LessonNav({ moduleId, moduleNumber, title, tabs }: { moduleId: string; moduleNumber: number; title: string; tabs: LessonTab[] }) {
  const pathname = usePathname();
  const listId = `${useId()}-tabs`;
  const [open, setOpen] = useState(false);
  const [visited, setVisited] = useState<string[]>([]);
  const current = currentTab(tabs, pathname ?? "");
  const position = current ? tabs.indexOf(current) + 1 : null;

  // Record the page being viewed, and close the mobile menu after navigating.
  useEffect(() => {
    setOpen(false);
    const seen = readVisited(moduleId);
    if (current && !seen.includes(current.key)) seen.push(current.key);
    writeVisited(moduleId, seen);
    setVisited(seen);
  }, [moduleId, current?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <nav aria-label="Lesson pages" className="rounded-2xl border border-neutral-200 bg-white p-4 md:sticky md:top-6 md:border-0 md:bg-transparent md:p-0 dark:border-neutral-800 dark:bg-neutral-950 md:dark:bg-transparent">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700 dark:text-teal-400">Module {moduleNumber}</p>
          <p className="font-semibold tracking-tight text-neutral-900 dark:text-white">{title}</p>
          {current && position && (
            <p className="mt-0.5 truncate text-sm text-neutral-500 md:hidden">
              Page {position} of {tabs.length}: {current.label}
            </p>
          )}
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium md:hidden dark:border-neutral-700"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      <ol id={listId} className={`${open ? "block" : "hidden"} mt-4 space-y-0.5 md:block`}>
        {tabs.map((t, i) => {
          const isCurrent = current?.key === t.key;
          const isVisited = visited.includes(t.key) && !isCurrent;
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                aria-current={isCurrent ? "page" : undefined}
                className={[
                  "flex items-start gap-2.5 rounded-lg px-3 py-2 text-sm leading-snug transition-colors",
                  isCurrent
                    ? "bg-teal-50 font-semibold text-teal-900 ring-1 ring-inset ring-teal-700/30 dark:bg-teal-950/50 dark:text-teal-100 dark:ring-teal-400/30"
                    : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-white",
                ].join(" ")}
              >
                <span
                  aria-hidden
                  className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.7rem] tabular-nums ${
                    isVisited ? "bg-teal-700 font-bold text-white dark:bg-teal-400 dark:text-neutral-950" : "border border-neutral-300 text-neutral-500 dark:border-neutral-700"
                  }`}
                >
                  {isVisited ? "✓" : i + 1}
                </span>
                <span>
                  {t.label}
                  {isVisited && <span className="sr-only"> (visited)</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
