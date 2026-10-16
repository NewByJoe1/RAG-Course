"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { submitQuiz } from "@/app/actions/quiz";
import type { QuizResult } from "@/lib/course/quiz-result";
import { describeAnswer, fieldName, formatPercent, PASS_THRESHOLD, type QuizKind } from "@/lib/course/quiz";

export type QuizRunnerItem = {
  id: string;
  kind: QuizKind;
  prompt: string;
  choices: { id: string; text: string }[] | null;
};

type Answer = { selected: string[]; text: string };
type Stage = { kind: "question"; index: number } | { kind: "review" } | { kind: "result"; result: QuizResult };

const blank: Answer = { selected: [], text: "" };
const storageKey = (moduleId: string) => `quiz-answers:${moduleId}`;

export function isAnswered(item: QuizRunnerItem, a: Answer | undefined): boolean {
  if (!a) return false;
  return item.kind === "short_answer" ? a.text.trim().length > 0 : a.selected.length > 0;
}

/** First question without an answer; items.length when all are answered. */
export function firstUnanswered(items: QuizRunnerItem[], answers: Record<string, Answer>): number {
  const i = items.findIndex((it) => !isAnswered(it, answers[it.id]));
  return i === -1 ? items.length : i;
}

/**
 * Where a requested position may land: never past the first unanswered
 * question (no skipping ahead); "review" only once everything is answered.
 */
export function clampPosition(requested: string | null | undefined, items: QuizRunnerItem[], answers: Record<string, Answer>): number | "review" {
  const limit = firstUnanswered(items, answers);
  if (requested === "review") return limit === items.length ? "review" : limit;
  const n = Number(requested);
  const index = Number.isInteger(n) && n >= 1 ? n - 1 : 0;
  return Math.min(index, limit, items.length - 1);
}

function loadAnswers(moduleId: string): Record<string, Answer> {
  try {
    const raw = window.sessionStorage.getItem(storageKey(moduleId));
    return raw ? (JSON.parse(raw) as Record<string, Answer>) : {};
  } catch {
    return {};
  }
}

function saveAnswers(moduleId: string, answers: Record<string, Answer> | null) {
  try {
    if (answers) window.sessionStorage.setItem(storageKey(moduleId), JSON.stringify(answers));
    else window.sessionStorage.removeItem(storageKey(moduleId));
  } catch {
    // Storage can be unavailable (private mode); answers then live in memory only.
  }
}

const primary =
  "rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900";
const secondary = "rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-medium disabled:opacity-40 dark:border-neutral-700";

/**
 * One question per screen. Back is always allowed; Next needs an answer; the
 * URL (?q=N, ?q=review) can't jump past the first unanswered question.
 * Submits through the same submitQuiz action as before, so grading and the
 * 80% gate are unchanged.
 */
export function QuizRunner({
  moduleId,
  slug,
  moduleTitle,
  items,
  initialPosition,
}: {
  moduleId: string;
  slug: string;
  moduleTitle: string;
  items: QuizRunnerItem[];
  initialPosition?: string;
}) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [stage, setStage] = useState<Stage>({ kind: "question", index: 0 });
  const [hydrated, setHydrated] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Restore answers saved in this tab, then honour the URL within the rules.
  useEffect(() => {
    const saved = loadAnswers(moduleId);
    setAnswers(saved);
    const pos = clampPosition(initialPosition, items, saved);
    setStage(pos === "review" ? { kind: "review" } : { kind: "question", index: pos });
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  // Keep the URL in step (no server round-trip) and move focus to the new screen.
  useEffect(() => {
    if (!hydrated) return;
    const q = stage.kind === "question" ? String(stage.index + 1) : stage.kind === "review" ? "review" : "result";
    const url = new URL(window.location.href);
    url.searchParams.set("q", q);
    window.history.replaceState(null, "", url);
    headingRef.current?.focus();
  }, [stage, hydrated]);

  const update = (id: string, a: Answer) =>
    setAnswers((cur) => {
      const next = { ...cur, [id]: a };
      saveAnswers(moduleId, next);
      return next;
    });

  const total = items.length;
  const answeredCount = useMemo(() => items.filter((it) => isAnswered(it, answers[it.id])).length, [items, answers]);

  const submit = async () => {
    setPending(true);
    setError(null);
    const fd = new FormData();
    for (const it of items) {
      const a = answers[it.id] ?? blank;
      if (it.kind === "short_answer") fd.append(fieldName(it.id), a.text);
      else a.selected.forEach((v) => fd.append(fieldName(it.id), v));
    }
    try {
      const res = await submitQuiz(moduleId, slug, { status: "idle" }, fd);
      if (res.status === "graded") {
        saveAnswers(moduleId, null);
        setStage({ kind: "result", result: res.result });
      } else if (res.status === "error") {
        setError(res.error);
      }
    } catch {
      setError("Couldn't reach the server. Your answers are kept in this tab; try again.");
    } finally {
      setPending(false);
    }
  };

  const retake = () => {
    saveAnswers(moduleId, null);
    setAnswers({});
    setStage({ kind: "question", index: 0 });
  };

  if (!hydrated) return <p className="text-neutral-500">Loading quiz…</p>;

  // --- Result ----------------------------------------------------------------
  if (stage.kind === "result") {
    const r = stage.result;
    const byId = new Map(r.results.map((x) => [x.quiz_item_id, x]));
    return (
      <section aria-labelledby="quiz-heading" className="space-y-6">
        <h2 id="quiz-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight focus:outline-none">
          {r.passed ? "Passed" : "Not passed yet"}: {r.correct}/{r.total} ({formatPercent(r.score)})
        </h2>
        <p role="status" className="text-neutral-600 dark:text-neutral-400">
          {r.passed
            ? "The next module is unlocked."
            : `You need ${formatPercent(r.threshold)} to pass. Read the explanations, revisit the lesson, and try again.`}
        </p>
        <ol className="space-y-3">
          {items.map((it, i) => {
            const x = byId.get(it.id);
            return (
              <li key={it.id} className="rounded-xl border border-neutral-200 p-4 text-sm dark:border-neutral-800">
                <p className="font-medium">
                  {i + 1}. {it.prompt}
                </p>
                <p className={x?.is_correct ? "mt-1 text-green-700 dark:text-green-300" : "mt-1 text-red-700 dark:text-red-300"}>
                  {x?.is_correct ? "✓ Correct" : `✗ ${x?.answered ? "Incorrect" : "Not answered"} · Answer: ${describeAnswer(it.choices, x?.correct_answer)}`}
                </p>
                {x?.explanation && <p className="mt-1 text-neutral-600 dark:text-neutral-400">{x.explanation}</p>}
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={retake} className={secondary}>
            Retake quiz
          </button>
          <Link href={`/modules/${slug}`} className={secondary}>
            Back to the lesson
          </Link>
          <Link href="/" className={primary}>
            Course home
          </Link>
        </div>
      </section>
    );
  }

  // --- Review ----------------------------------------------------------------
  if (stage.kind === "review") {
    return (
      <section aria-labelledby="quiz-heading" className="space-y-6">
        <h2 id="quiz-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight focus:outline-none">
          Check your answers
        </h2>
        <ol className="space-y-3">
          {items.map((it, i) => {
            const a = answers[it.id] ?? blank;
            const shown =
              it.kind === "short_answer" ? a.text : a.selected.map((id) => it.choices?.find((c) => c.id === id)?.text ?? id).join("; ");
            return (
              <li key={it.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-neutral-200 p-4 text-sm dark:border-neutral-800">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {i + 1}. {it.prompt}
                  </p>
                  <p className="mt-1 text-neutral-600 dark:text-neutral-400">Your answer: {shown}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setStage({ kind: "question", index: i })}
                  aria-label={`Change answer to question ${i + 1}`}
                  className="text-sm underline"
                >
                  Change
                </button>
              </li>
            );
          })}
        </ol>
        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => setStage({ kind: "question", index: total - 1 })} className={secondary}>
            ← Back
          </button>
          <button type="button" onClick={submit} disabled={pending} className={primary}>
            {pending ? "Grading…" : "Submit answers"}
          </button>
        </div>
        <p className="text-sm text-neutral-500">You need {formatPercent(PASS_THRESHOLD)} or more to pass and unlock the next module.</p>
      </section>
    );
  }

  // --- One question ----------------------------------------------------------
  const item = items[stage.index];
  const a = answers[item.id] ?? blank;
  const answered = isAnswered(item, a);
  const isLast = stage.index === total - 1;
  const toggle = (id: string) =>
    update(item.id, {
      ...a,
      selected: item.kind === "single_choice" ? [id] : a.selected.includes(id) ? a.selected.filter((x) => x !== id) : [...a.selected, id],
    });

  return (
    <section aria-labelledby="quiz-heading" className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-neutral-500">
          {moduleTitle} · Question {stage.index + 1} of {total}
        </p>
        <div
          role="progressbar"
          aria-label="Quiz progress"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={answeredCount}
          aria-valuetext={`${answeredCount} of ${total} answered`}
          className="h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
        >
          <div className="h-full bg-neutral-900 transition-[width] dark:bg-white" style={{ width: `${(answeredCount / total) * 100}%` }} />
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!answered) return;
          setStage(isLast ? { kind: "review" } : { kind: "question", index: stage.index + 1 });
        }}
        className="space-y-5"
      >
        <fieldset className="space-y-3">
          <legend className="w-full">
            <h2 id="quiz-heading" ref={headingRef} tabIndex={-1} className="text-xl font-semibold leading-snug focus:outline-none">
              {item.prompt}
            </h2>
            {item.kind === "multi_choice" && <span className="text-sm text-neutral-500">Select all that apply.</span>}
          </legend>
          {item.kind === "short_answer" ? (
            <input
              aria-label="Your answer"
              value={a.text}
              onChange={(e) => update(item.id, { ...a, text: e.target.value })}
              maxLength={500}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
            />
          ) : (
            item.choices?.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-200 p-3 has-[:checked]:border-neutral-900 dark:border-neutral-800 dark:has-[:checked]:border-white"
              >
                <input
                  type={item.kind === "single_choice" ? "radio" : "checkbox"}
                  name={fieldName(item.id)}
                  value={c.id}
                  checked={a.selected.includes(c.id)}
                  onChange={() => toggle(c.id)}
                  className="mt-1"
                />
                <span>{c.text}</span>
              </label>
            ))
          )}
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setStage({ kind: "question", index: stage.index - 1 })}
            disabled={stage.index === 0}
            className={secondary}
          >
            ← Back
          </button>
          <button type="submit" disabled={!answered} className={primary}>
            {isLast ? "Review answers" : "Next →"}
          </button>
          {!answered && <span className="text-sm text-neutral-500">Answer this question to continue.</span>}
        </div>
      </form>
    </section>
  );
}
