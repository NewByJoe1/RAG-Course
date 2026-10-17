"use client";

import { useSyncExternalStore } from "react";
import { OPERATING_SYSTEMS, type OperatingSystem } from "@/lib/course/markdown";

// The learner's kind of computer, remembered in this browser. Until they pick
// one we guess from the browser, and say so. Steps that differ by system show
// only the chosen (or guessed) system's version.

const KEY = "course-system";
const EVENT = "course-system-change";

export const SYSTEM_LABEL: Record<OperatingSystem, string> = { mac: "Mac", windows: "Windows", linux: "Linux" };

function stored(): OperatingSystem | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return (OPERATING_SYSTEMS as readonly string[]).includes(v ?? "") ? (v as OperatingSystem) : null;
  } catch {
    return null;
  }
}

function guess(): OperatingSystem | null {
  const ua = `${(navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? ""} ${navigator.userAgent}`;
  if (/Android|iPhone|iPad/i.test(ua)) return null;
  if (/Mac/i.test(ua)) return "mac";
  if (/Win/i.test(ua)) return "windows";
  if (/Linux|X11|CrOS/i.test(ua)) return "linux";
  return null;
}

// Snapshot as a string so React can compare it cheaply: "mac", "guess:mac" or "".
const snapshot = () => {
  const s = stored();
  if (s) return s;
  const g = guess();
  return g ? `guess:${g}` : "";
};

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

export function setSystem(os: OperatingSystem) {
  try {
    window.localStorage.setItem(KEY, os);
  } catch {
    // Storage blocked: the choice lasts until the page is closed.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** The system to show (null on the server and before we know), and whether the learner chose it. */
export function useSystem(): { os: OperatingSystem | null; chosen: boolean } {
  const snap = useSyncExternalStore(subscribe, snapshot, () => "");
  if (!snap) return { os: null, chosen: false };
  return snap.startsWith("guess:") ? { os: snap.slice(6) as OperatingSystem, chosen: false } : { os: snap as OperatingSystem, chosen: true };
}

/** "Your computer: Mac / Windows / Linux", shown at the top of pages with system-specific steps. */
export function SystemPicker() {
  const { os, chosen } = useSystem();
  return (
    <div className="max-w-2xl rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p id="system-picker-label" className="text-sm font-medium text-neutral-900 dark:text-white">
          Your computer:
        </p>
        <div role="radiogroup" aria-labelledby="system-picker-label" className="flex gap-1.5">
          {OPERATING_SYSTEMS.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={os === s}
              onClick={() => setSystem(s)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                os === s
                  ? "border-teal-700 bg-teal-700 text-white dark:border-teal-400 dark:bg-teal-400 dark:text-neutral-950"
                  : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300"
              }`}
            >
              {SYSTEM_LABEL[s]}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1.5 text-xs text-neutral-500">
        {os && chosen
          ? `Showing the steps for ${SYSTEM_LABEL[os]}. We'll remember this on this browser.`
          : os
            ? `We guessed ${SYSTEM_LABEL[os]}. Pick yours to be sure, and we'll remember it.`
            : "Pick the kind of computer you're using, and we'll show only its steps."}
      </p>
    </div>
  );
}

/** One system's version of a step. Shown when it matches; all versions show, labelled, until we know. */
export function OsBlock({ os, children }: { os: OperatingSystem; children: React.ReactNode }) {
  const { os: current } = useSystem();
  if (current && current !== os) return null;
  return (
    <div data-os={os} className="space-y-3">
      <p className="inline-flex rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
        {current ? `On ${SYSTEM_LABEL[os]}` : `If you're on ${SYSTEM_LABEL[os]}`}
      </p>
      {children}
    </div>
  );
}
