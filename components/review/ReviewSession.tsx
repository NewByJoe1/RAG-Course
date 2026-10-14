"use client";

import { useState, type FormEvent } from "react";
import { answerReviewCard, rateReviewCard, type AnswerResult } from "@/app/actions/review";
import { describeAnswer, fieldName, type QuizKind } from "@/lib/course/quiz";
import { RATINGS, type Rating } from "@/lib/scheduler";
import { CausePicker } from "@/components/failures/CausePicker";
import type { CauseOption } from "@/lib/course/causes";

type Base = { id: string; module: string; previews: Record<Rating, string> };
export type SessionCard =
  | (Base & { type: "quiz"; quizItemId: string; kind: QuizKind; prompt: string; choices: { id: string; text: string }[] | null })
  | (Base & {
      type: "failure";
      title: string;
      user_query: string;
      retrieved_context: { source: string; text: string; score?: number }[];
      bad_output: string;
      root_cause: string;
      fix: string;
      cause_options?: CauseOption[] | null;
      correct_cause?: string | null;
      /** The failure case's own id, so options appear in the same order as in the gallery. */
      failureCaseId?: string;
    });

const RATING_LABEL: Record<Rating, string> = { again: "Again", hard: "Hard", good: "Good", easy: "Easy" };
const UNREACHABLE = "Couldn't reach the server. Reload the page and try again.";
const btn = "rounded-md px-4 py-2 font-medium disabled:opacity-40";
const primary = `${btn} bg-neutral-900 text-white dark:bg-white dark:text-neutral-900`;

export function ReviewSession({ cards, remainingAfter }: { cards: SessionCard[]; remainingAfter: number }) {
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState<Rating[]>([]);

  if (index >= cards.length) {
    const tally = RATINGS.map((r) => `${done.filter((d) => d === r).length} ${RATING_LABEL[r].toLowerCase()}`).join(" · ");
    return (
      <div className="space-y-3 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
        <p className="text-lg font-medium">Session complete: {done.length} card{done.length === 1 ? "" : "s"} reviewed.</p>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">{tally}</p>
        {remainingAfter > 0 ? (
          // Full navigation so the server fetches the next batch.
          <a href="/review" className={`inline-block ${primary}`}>Review {Math.min(remainingAfter, cards.length)} more</a>
        ) : (
          <a href="/streak" className="text-sm underline">See your streak</a>
        )}
      </div>
    );
  }

  const card = cards[index];
  const advance = (r: Rating) => {
    setDone((d) => [...d, r]);
    setIndex((i) => i + 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-neutral-500">
        <span>{card.module}</span>
        <span>
          Card {index + 1} of {cards.length}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800">
        <div className="h-full bg-neutral-900 dark:bg-white" style={{ width: `${(index / cards.length) * 100}%` }} />
      </div>
      {card.type === "quiz" ? <QuizCard key={card.id} card={card} onRated={advance} /> : <FailureCard key={card.id} card={card} onRated={advance} />}
    </div>
  );
}

function RatingButtons({
  cardId,
  previews,
  onlyAgain,
  onRated,
}: {
  cardId: string;
  previews: Record<Rating, string>;
  onlyAgain?: boolean;
  onRated: (r: Rating) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rate = async (r: Rating) => {
    setPending(true);
    setError(null);
    try {
      const res = await rateReviewCard(cardId, r);
      if (res.status === "rated") onRated(res.rating);
      else setError(res.error);
    } catch {
      setError(UNREACHABLE);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">How well did you know it?</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {RATINGS.map((r) => (
          <button
            key={r}
            type="button"
            disabled={pending || (onlyAgain && r !== "again")}
            onClick={() => rate(r)}
            className={`${btn} border border-neutral-300 dark:border-neutral-700`}
          >
            {RATING_LABEL[r]}
            <span className="block text-xs font-normal text-neutral-500">{previews[r]}</span>
          </button>
        ))}
      </div>
      {onlyAgain && <p className="text-xs text-neutral-500">Missed answers go back to a 1-day interval.</p>}
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
}

function QuizCard({ card, onRated }: { card: Extract<SessionCard, { type: "quiz" }>; onRated: (r: Rating) => void }) {
  // Selection lives in state so "Check answer" knows whether anything is
  // chosen, and the choice stays visible after the answer is revealed.
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [pending, setPending] = useState(false);
  const answered = result?.status === "answered" ? result : null;
  const hasAnswer = card.kind === "short_answer" ? text.trim().length > 0 : selected.length > 0;

  const toggle = (id: string) =>
    setSelected((cur) =>
      card.kind === "single_choice" ? [id] : cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );

  const check = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!hasAnswer || pending || answered) return;
    const fd = new FormData();
    if (card.kind === "short_answer") fd.append(fieldName(card.quizItemId), text);
    else selected.forEach((id) => fd.append(fieldName(card.quizItemId), id));

    setPending(true);
    try {
      setResult(await answerReviewCard(card.id, fd));
    } catch {
      setResult({ status: "error", error: UNREACHABLE });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <form onSubmit={check} className="space-y-3">
        <fieldset disabled={Boolean(answered)} className="space-y-3">
          <legend className="text-lg font-medium">
            {card.prompt}
            {card.kind === "multi_choice" && <span className="ml-2 text-sm font-normal text-neutral-500">(select all that apply)</span>}
          </legend>
          {card.kind === "short_answer" ? (
            <input
              aria-label="Your answer"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              autoFocus
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
            />
          ) : (
            card.choices?.map((c) => (
              <label key={c.id} className="flex items-start gap-2">
                <input
                  type={card.kind === "single_choice" ? "radio" : "checkbox"}
                  name={fieldName(card.quizItemId)}
                  value={c.id}
                  checked={selected.includes(c.id)}
                  onChange={() => toggle(c.id)}
                  className="mt-1"
                />
                <span>{c.text}</span>
              </label>
            ))
          )}
        </fieldset>
        {!answered && (
          <button type="submit" disabled={pending || !hasAnswer} className={primary}>
            {pending ? "Checking…" : "Check answer"}
          </button>
        )}
        {result?.status === "error" && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{result.error}</p>}
      </form>

      {answered && (
        <>
          <div
            className={`rounded-md px-3 py-2 text-sm ${
              answered.isCorrect ? "bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100" : "bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100"
            }`}
          >
            <p className="font-medium">
              {answered.isCorrect ? "Correct" : `Not quite · Answer: ${describeAnswer(card.choices, answered.correctAnswer)}`}
            </p>
            {answered.explanation && <p className="mt-1">{answered.explanation}</p>}
          </div>
          <RatingButtons cardId={card.id} previews={card.previews} onlyAgain={!answered.isCorrect} onRated={onRated} />
        </>
      )}
    </div>
  );
}

function FailureCard({ card, onRated }: { card: Extract<SessionCard, { type: "failure" }>; onRated: (r: Rating) => void }) {
  // Cases with cause options are diagnosed first; others keep the plain reveal.
  const hasOptions = Boolean(card.cause_options?.length && card.correct_cause);
  const [revealed, setRevealed] = useState(false);
  const [pickedCorrect, setPickedCorrect] = useState(true);
  return (
    <div className="space-y-4 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Failure case · {card.title}</p>
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="font-medium">User query</dt>
          <dd className="mt-1 rounded bg-neutral-100 p-2 font-mono dark:bg-neutral-900">{card.user_query}</dd>
        </div>
        {card.retrieved_context.length > 0 && (
        <div>
            <dt className="font-medium">Retrieved context</dt>
            <dd className="mt-1 space-y-2">
              {card.retrieved_context.map((r, i) => (
                <p key={i} className="rounded border border-neutral-200 p-2 dark:border-neutral-800">
                  <span className="block text-xs text-neutral-500">[{i + 1}] {r.source}</span>
                  {r.text}
                </p>
              ))}
            </dd>
          </div>
        )}
        <div>
          <dt className="font-medium">Broken output</dt>
          <dd className="mt-1 rounded bg-red-50 p-2 dark:bg-red-950">{card.bad_output}</dd>
        </div>
      </dl>

      {hasOptions && (
        <CausePicker
          caseId={card.failureCaseId ?? card.id}
          options={card.cause_options!}
          correct={card.correct_cause!}
          onChecked={(ok) => {
            setPickedCorrect(ok);
            setRevealed(true);
          }}
        />
      )}

      {!revealed ? (
        !hasOptions && <div className="space-y-2">
          <p className="font-medium">What went wrong, and how would you fix it?</p>
          <button type="button" onClick={() => setRevealed(true)} className={primary}>Show answer</button>
        </div>
      ) : (
        <>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-medium">Root cause</dt>
              <dd className="mt-1">{card.root_cause}</dd>
            </div>
            <div>
              <dt className="font-medium">Fix</dt>
              <dd className="mt-1 rounded bg-green-50 p-2 dark:bg-green-950">{card.fix}</dd>
            </div>
          </dl>
          <RatingButtons cardId={card.id} previews={card.previews} onlyAgain={hasOptions && !pickedCorrect} onRated={onRated} />
        </>
      )}
    </div>
  );
}
