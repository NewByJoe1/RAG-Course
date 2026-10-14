"use client";

import { useFormState, useFormStatus } from "react-dom";
import { submitQuiz, type QuizState } from "@/app/actions/quiz";
import { describeAnswer, fieldName, formatPercent, PASS_THRESHOLD, type QuizKind } from "@/lib/course/quiz";

export type QuizFormItem = {
  id: string;
  kind: QuizKind;
  prompt: string;
  choices: { id: string; text: string }[] | null;
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
    >
      {pending ? "Grading…" : "Submit answers"}
    </button>
  );
}

export function QuizForm({ moduleId, slug, items }: { moduleId: string; slug: string; items: QuizFormItem[] }) {
  const [state, action] = useFormState<QuizState, FormData>(submitQuiz.bind(null, moduleId, slug), { status: "idle" });
  const results = state.status === "graded" ? new Map(state.result.results.map((r) => [r.quiz_item_id, r])) : null;

  return (
    <form action={action} className="space-y-6">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Score {formatPercent(PASS_THRESHOLD)} or higher to pass and unlock the next module. Unanswered questions count as wrong.
      </p>

      <ol className="space-y-6">
        {items.map((item, i) => {
          const r = results?.get(item.id);
          return (
            <li key={item.id} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <fieldset className="space-y-3">
                <legend className="font-medium">
                  {i + 1}. {item.prompt}
                  {item.kind === "multi_choice" && <span className="ml-2 text-sm font-normal text-neutral-500">(select all that apply)</span>}
                </legend>

                {item.kind === "short_answer" ? (
                  <input
                    name={fieldName(item.id)}
                    maxLength={500}
                    className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
                  />
                ) : (
                  item.choices?.map((c) => (
                    <label key={c.id} className="flex items-start gap-2">
                      <input
                        type={item.kind === "single_choice" ? "radio" : "checkbox"}
                        name={fieldName(item.id)}
                        value={c.id}
                        className="mt-1"
                      />
                      <span>{c.text}</span>
                    </label>
                  ))
                )}

                {r && (
                  <div
                    className={`rounded-md px-3 py-2 text-sm ${
                      r.is_correct
                        ? "bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100"
                        : "bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100"
                    }`}
                  >
                    <p className="font-medium">
                      {r.is_correct ? "Correct" : r.answered ? "Incorrect" : "Not answered"}
                      {!r.is_correct && <> · Answer: {describeAnswer(item.choices, r.correct_answer)}</>}
                    </p>
                    {r.explanation && <p className="mt-1">{r.explanation}</p>}
                  </div>
                )}
              </fieldset>
            </li>
          );
        })}
      </ol>

      {state.status === "error" && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {state.error}
        </p>
      )}
      {state.status === "graded" && (
        <p
          role="status"
          className={`rounded-md px-3 py-2 font-medium ${
            state.result.passed
              ? "bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100"
              : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100"
          }`}
        >
          {state.result.correct}/{state.result.total} correct ({formatPercent(state.result.score)}).{" "}
          {state.result.passed
            ? "Passed. The next module is unlocked."
            : `You need ${formatPercent(state.result.threshold)} to pass. Review the explanations and try again.`}
        </p>
      )}

      <Submit />
    </form>
  );
}
