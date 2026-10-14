/** Display copy only. The database (quiz_pass_threshold()) is authoritative. */
export const PASS_THRESHOLD = 0.8;

export type QuizKind = "single_choice" | "multi_choice" | "short_answer";

export type QuizResponse =
  | { choice: string }
  | { choices: string[] }
  | { text: string };

export type QuizItemRef = { id: string; kind: QuizKind };

/** Form field name for a quiz item. */
export const fieldName = (itemId: string) => `q:${itemId}`;

/**
 * Turn submitted form data into the { [itemId]: response } shape that
 * submit_module_quiz expects. Unanswered items are omitted (graded as wrong).
 * Fields for ids not in `items` are ignored.
 */
export function parseQuizFormData(formData: FormData, items: QuizItemRef[]): Record<string, QuizResponse> {
  const out: Record<string, QuizResponse> = {};
  for (const item of items) {
    const key = fieldName(item.id);
    const values = formData.getAll(key).filter((v): v is string => typeof v === "string");
    if (item.kind === "single_choice") {
      if (values[0]) out[item.id] = { choice: values[0] };
    } else if (item.kind === "multi_choice") {
      if (values.length) out[item.id] = { choices: Array.from(new Set(values)) };
    } else {
      const text = (values[0] ?? "").trim();
      if (text) out[item.id] = { text: text.slice(0, 500) };
    }
  }
  return out;
}

export type { QuizResult } from "./quiz-result";

export function formatPercent(score: number | null | undefined): string {
  if (score == null) return "—";
  return `${Math.round(score * 100)}%`;
}

/** Human-readable correct answer, using choice text where available. */
export function describeAnswer(choices: { id: string; text: string }[] | null, answer: unknown): string {
  const a = (answer ?? {}) as { choice?: string; choices?: string[]; accepted?: string[] };
  const label = (id: string) => choices?.find((c) => c.id === id)?.text ?? id;
  if (a.choice) return label(a.choice);
  if (a.choices) return a.choices.map(label).join("; ");
  if (a.accepted) return a.accepted[0];
  return "";
}
