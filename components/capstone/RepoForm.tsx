"use client";

import { useFormState, useFormStatus } from "react-dom";
import { setGithubRepo } from "@/app/actions/capstone";

function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900">
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

export function RepoForm({ current }: { current: string | null }) {
  const [state, action] = useFormState(setGithubRepo, {});
  return (
    <form action={action} className="space-y-2">
      <label className="block space-y-1">
        <span className="text-sm font-medium">Your capstone repo</span>
        <div className="flex flex-wrap gap-2">
          <input
            name="github_repo"
            defaultValue={current ?? ""}
            placeholder="owner/name"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
          <Save />
        </div>
      </label>
      {current && <p className="text-xs text-neutral-500">Changing it clears the CI results recorded for the old repo.</p>}
      {state.error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{state.error}</p>}
      {state.message && <p role="status" className="text-sm text-green-700 dark:text-green-300">{state.message}</p>}
    </form>
  );
}
