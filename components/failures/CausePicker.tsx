"use client";

import { useMemo, useState } from "react";
import { orderCauseOptions, type CauseOption } from "@/lib/course/causes";

const primary =
  "rounded-md bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900";

/**
 * "What caused this?" multiple choice for a failure case. Calls onChecked once
 * the learner commits to an answer; the parent then reveals root cause + fix.
 */
export function CausePicker({
  caseId,
  options,
  correct,
  onChecked,
}: {
  caseId: string;
  options: CauseOption[];
  correct: string;
  onChecked: (isCorrect: boolean) => void;
}) {
  const ordered = useMemo(() => orderCauseOptions(caseId, options), [caseId, options]);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const isCorrect = selected === correct;
  const correctText = options.find((o) => o.id === correct)?.text;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!selected || checked) return;
        setChecked(true);
        onChecked(selected === correct);
      }}
      className="space-y-3"
    >
      <fieldset disabled={checked} className="space-y-2">
        <legend className="font-medium">What caused this?</legend>
        {ordered.map((o) => (
          <label key={o.id} className="flex items-start gap-2">
            <input
              type="radio"
              name={`cause-${caseId}`}
              value={o.id}
              checked={selected === o.id}
              onChange={() => setSelected(o.id)}
              className="mt-1"
            />
            <span>{o.text}</span>
          </label>
        ))}
      </fieldset>
      {!checked ? (
        <button type="submit" disabled={!selected} className={primary}>
          Check cause
        </button>
      ) : (
        <p
          role="status"
          className={`rounded-md px-3 py-2 text-sm font-medium ${
            isCorrect
              ? "bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100"
              : "bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100"
          }`}
        >
          {isCorrect ? "Correct" : `Not quite · The cause: ${correctText}`}
        </p>
      )}
    </form>
  );
}
