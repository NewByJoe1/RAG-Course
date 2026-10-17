"use client";

import Link from "next/link";
import { useState } from "react";
import { completeSetup } from "@/app/actions/setup";

/**
 * The last tab of Module 0: the learner ticks "My setup works" and presses the
 * button, which unlocks Module 1. There's no quiz to pass.
 */
export function SetupCheck({ checks, doneAt, nextHref }: { checks: string[]; doneAt: string | null; nextHref: string }) {
  const [ticked, setTicked] = useState(false);
  const [done, setDone] = useState<string | null>(doneAt);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const r = await completeSetup();
      if (r.status === "done") setDone(r.at);
      else setError(r.error);
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <section aria-labelledby="setup-checklist" className="space-y-3">
        <h2 id="setup-checklist" className="text-xl font-semibold tracking-tight">
          Everything that should work now
        </h2>
        <ol className="space-y-2">
          {checks.map((c, i) => (
            <li key={c} className="flex gap-3 rounded-xl border border-neutral-200 px-4 py-3 dark:border-neutral-800">
              <span aria-hidden className="tabular-nums text-neutral-400">
                {i + 1}
              </span>
              <span>{c}</span>
            </li>
          ))}
        </ol>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">If any of these doesn&apos;t work yet, go back to its part. Each one ends with what to do when it goes wrong.</p>
      </section>

      {done ? (
        <div role="status" className="space-y-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-950/40">
          <p className="font-semibold text-emerald-900 dark:text-emerald-100">✓ Your workshop is set up. Module 1 is unlocked.</p>
          <Link href={nextHref} className="inline-flex rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
            Start Module 1 →
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
          <label className="flex items-start gap-3 text-lg font-medium">
            <input type="checkbox" checked={ticked} onChange={(e) => setTicked(e.target.checked)} className="mt-1.5 h-5 w-5 accent-teal-700" />
            My setup works
          </label>
          <button
            type="submit"
            disabled={!ticked || pending}
            className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
          >
            {pending ? "Saving…" : "Unlock Module 1"}
          </button>
          {!ticked && <p className="text-sm text-neutral-500">Tick the box once every check above works.</p>}
          {error && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
