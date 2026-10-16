"use client";

import { useId, useState } from "react";
import { saveExplainBack } from "@/app/actions/explain-back";

/** "Explain it back": the learner's answer is saved privately for spaced review. */
export function ExplainBack({ moduleId, prompt, previous }: { moduleId: string; prompt: string; previous: { response: string; created_at: string } | null }) {
  const uid = useId();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState<{ response: string; at: string } | null>(previous ? { response: previous.response, at: previous.created_at } : null);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const r = await saveExplainBack(moduleId, text);
      if (r.status === "saved") {
        setSaved({ response: text.trim(), at: r.createdAt });
        setText("");
      } else setError(r.error);
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <section aria-labelledby={`${uid}-title`} className="max-w-2xl space-y-3">
      <h3 id={`${uid}-title`} className="text-xl font-semibold tracking-tight">
        Explain it back
      </h3>
      <form onSubmit={save} className="space-y-3">
        <label htmlFor={`${uid}-answer`} className="block text-sm leading-relaxed">
          {prompt}
        </label>
        <textarea
          id={`${uid}-answer`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={4000}
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
          >
            {pending ? "Saving…" : "Save my explanation"}
          </button>
          <span className="text-xs text-neutral-500">Only you can see this. It&apos;s kept for your spaced review.</span>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
      </form>
      {saved && (
        <div role="status" className="rounded-lg bg-neutral-100 p-3 text-sm dark:bg-neutral-900">
          <p className="text-xs text-neutral-500">Your last explanation, saved {new Date(saved.at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p>
          <p className="mt-1 whitespace-pre-wrap">{saved.response}</p>
        </div>
      )}
    </section>
  );
}
