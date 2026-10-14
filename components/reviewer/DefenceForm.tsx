"use client";

import { useState } from "react";
import { recordDefence, type DefenceResult } from "@/app/actions/defence";
import { CLOSING_QUESTION, DEFENCE_QUESTION_COUNT, defenceVerdict } from "@/lib/capstone/defence";

type Slot = { question: string; citation_verified: boolean; passed: boolean | null; note: string };

const emptySlots = (): Slot[] =>
  Array.from({ length: DEFENCE_QUESTION_COUNT }, () => ({ question: "", citation_verified: false, passed: null, note: "" }));

const field =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";
const primary =
  "rounded-md bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900";

function PassFail({ name, value, onChange, label }: { name: string; value: boolean | null; onChange: (v: boolean) => void; label: string }) {
  return (
    <fieldset className="flex items-center gap-4 text-sm">
      <legend className="sr-only">{label}</legend>
      {[
        [true, "Pass"],
        [false, "Fail"],
      ].map(([v, text]) => (
        <label key={String(v)} className="flex items-center gap-1">
          <input type="radio" name={name} checked={value === v} onChange={() => onChange(v as boolean)} aria-label={`${label}: ${text}`} />
          {text as string}
        </label>
      ))}
    </fieldset>
  );
}

/** Six-question oral defence plus the closing question (Module 12, Day 5). */
export function DefenceForm({ learnerId, learnerName }: { learnerId: string; learnerName: string }) {
  const [slots, setSlots] = useState<Slot[]>(emptySlots);
  const [closingPassed, setClosingPassed] = useState<boolean | null>(null);
  const [closingNote, setClosingNote] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<DefenceResult | null>(null);

  const update = (i: number, patch: Partial<Slot>) => setSlots((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const [triedSubmit, setTriedSubmit] = useState(false);

  // What the form still needs, by name. Empty means it can be recorded.
  const missing = [
    ...slots.flatMap((s, i) => [
      ...(s.question.trim() ? [] : [`Question ${i + 1} text`]),
      ...(s.passed === null ? [`Question ${i + 1} pass/fail`] : []),
    ]),
    ...(closingPassed === null ? ["Closing question pass/fail"] : []),
  ];
  const complete = missing.length === 0;
  const verdict = complete
    ? defenceVerdict({ questions: slots.map((s) => ({ passed: s.passed!, citation_verified: s.citation_verified })), closing_passed: closingPassed! })
    : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (!complete) {
      setTriedSubmit(true);
      return;
    }
    setPending(true);
    setResult(null);
    try {
      const res = await recordDefence(learnerId, {
        questions: slots.map((s) => ({ question: s.question, citation_verified: s.citation_verified, passed: s.passed!, note: s.note || null })),
        closing_passed: closingPassed!,
        closing_note: closingNote || null,
      });
      setResult(res);
      if (res.status === "saved") {
        setSlots(emptySlots());
        setClosingPassed(null);
        setClosingNote("");
        setTriedSubmit(false);
      }
    } catch {
      setResult({ status: "error", error: "Couldn't reach the server. Reload the page and try again." });
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <ol className="space-y-4">
        {slots.map((s, i) => (
          <li key={i} className="space-y-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <label className="block space-y-1">
              <span className="text-sm font-medium">Question {i + 1}</span>
              <input
                className={field}
                value={s.question}
                onChange={(e) => update(i, { question: e.target.value })}
                placeholder="The question you asked"
                aria-label={`Question ${i + 1}`}
                maxLength={1000}
              />
            </label>
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={s.citation_verified}
                  onChange={(e) => update(i, { citation_verified: e.target.checked })}
                  aria-label={`Question ${i + 1}: answer had a verified citation`}
                />
                Answer had a verified citation
              </label>
              <PassFail name={`q${i}`} label={`Question ${i + 1}`} value={s.passed} onChange={(v) => update(i, { passed: v })} />
            </div>
            <textarea
              className={field}
              rows={2}
              value={s.note}
              onChange={(e) => update(i, { note: e.target.value })}
              placeholder="Note (optional)"
              aria-label={`Question ${i + 1} note`}
              maxLength={2000}
            />
          </li>
        ))}
      </ol>

      <div className="space-y-2 rounded-lg border border-neutral-300 p-4 dark:border-neutral-700">
        <p className="text-sm font-medium">Closing question</p>
        <p className="italic">&ldquo;{CLOSING_QUESTION}&rdquo;</p>
        <PassFail name="closing" label="Closing question" value={closingPassed} onChange={setClosingPassed} />
        <textarea
          className={field}
          rows={2}
          value={closingNote}
          onChange={(e) => setClosingNote(e.target.value)}
          placeholder="Note (optional)"
          aria-label="Closing question note"
          maxLength={2000}
        />
      </div>

      <p role="status" aria-live="polite" className="text-sm">
        {verdict === null ? (
          <span className="text-neutral-500">Still needed: {missing.join(", ")}.</span>
        ) : verdict.passed ? (
          <span className="font-medium text-green-700 dark:text-green-300">Defence criterion will be met.</span>
        ) : (
          <span className="font-medium text-red-700 dark:text-red-300">Defence criterion won&apos;t be met: {verdict.reasons.join("; ")}.</span>
        )}
      </p>

      {triedSubmit && !complete && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          Can&apos;t record yet. Missing: {missing.join("; ")}.
        </p>
      )}
      {result?.status === "error" && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {result.error}
        </p>
      )}
      {result?.status === "saved" && (
        <p className="rounded-md bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-900">
          Saved for {learnerName}: defence {result.passed ? "passed" : "not passed"}. Now {result.metCount}/6 on main
          {result.allMet ? " (capstone passed; mastery recorded)." : "."}
        </p>
      )}

      {/* Only disabled while saving: a click on an incomplete form explains what's missing. */}
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Saving…" : "Record defence"}
      </button>
    </form>
  );
}
