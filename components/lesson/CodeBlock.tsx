"use client";

import { useState } from "react";

// What each code box is for, said plainly above it. "prompt" means text to
// paste into Claude Code rather than a command.
const LABELS: Record<string, string> = {
  bash: "Type this in your terminal",
  sh: "Type this in your terminal",
  zsh: "Type this in your terminal",
  powershell: "Type this in PowerShell",
  prompt: "Paste this into Claude Code",
  output: "What you should see",
};

/** A code box with a Copy button, so learners paste exactly the right thing. */
export function CodeBlock({ lang, text }: { lang: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const label = LABELS[lang];
  const isOutput = lang === "output";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <figure className={`overflow-hidden rounded-xl border ${isOutput ? "border-dashed border-neutral-300 dark:border-neutral-700" : "border-neutral-200 dark:border-neutral-800"}`}>
      <figcaption className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs dark:border-neutral-800 dark:bg-neutral-900">
        <span className="font-medium text-neutral-600 dark:text-neutral-300">{label ?? lang}</span>
        {!isOutput && (
          <button
            type="button"
            onClick={copy}
            aria-label={copied ? "Copied" : `Copy: ${label ?? "code"}`}
            className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 font-medium text-neutral-800 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        )}
      </figcaption>
      <pre className="overflow-x-auto bg-white p-4 text-sm leading-relaxed text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <code>{text}</code>
      </pre>
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied to the clipboard" : ""}
      </span>
    </figure>
  );
}
