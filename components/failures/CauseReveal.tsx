"use client";

import { useState } from "react";
import { CausePicker } from "./CausePicker";
import type { CauseOption } from "@/lib/course/causes";

/**
 * Root cause + fix for a failure case. With cause options, the learner picks a
 * cause first; without them, both are shown straight away.
 */
export function CauseReveal({
  caseId,
  rootCause,
  fix,
  causeOptions,
  correctCause,
}: {
  caseId: string;
  rootCause: string;
  fix: string;
  causeOptions: CauseOption[] | null;
  correctCause: string | null;
}) {
  const hasOptions = Boolean(causeOptions?.length && correctCause);
  const [revealed, setRevealed] = useState(!hasOptions);

  return (
    <div className="mt-4 space-y-4 text-sm">
      {hasOptions && <CausePicker caseId={caseId} options={causeOptions!} correct={correctCause!} onChecked={() => setRevealed(true)} />}
      {revealed && (
        <dl className="space-y-4">
          <div>
            <dt className="font-medium">Root cause</dt>
            <dd className="mt-1">{rootCause}</dd>
          </div>
          <div>
            <dt className="font-medium">Fix</dt>
            <dd className="mt-1 rounded bg-green-50 p-2 dark:bg-green-950">{fix}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
