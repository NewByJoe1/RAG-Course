import type { ModuleContent } from "@/content/types";

/**
 * Everything a learner reads in a lesson-format module, in page order (code
 * excluded): hook, objectives, lesson, failure cases, worked example,
 * explain-back, study guide, quiz.
 */
export function learnerText(m: ModuleContent): string[] {
  return [
    m.hook ?? "",
    ...m.learning_objectives,
    ...m.lesson_steps.flatMap((s) => [s.title, s.body_md]),
    ...m.failure_cases.flatMap((f) => [
      f.title,
      f.user_query,
      ...f.retrieved_context.map((r) => r.text),
      f.bad_output,
      f.symptom,
      f.root_cause,
      f.fix,
      ...(f.cause_options ?? []).map((o) => o.text),
    ]),
    ...(m.worked_example ?? []).flatMap((w) => [w.title, w.body_md, w.query_state ?? ""]),
    m.explain_back_prompt ?? "",
    ...(m.study_guide ?? []).flatMap((p) => [p.point, p.narration]),
    ...m.quiz_items.flatMap((q) => [q.prompt, ...(q.choices ?? []).map((c) => c.text), q.explanation ?? ""]),
  ].filter(Boolean);
}

/** Code removed (code boxes, inline code): commands and file names aren't prose. */
export const prose = (t: string) => t.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^(```|~~~)\s*$/gm, " ").replace(/`[^`]*`/g, " ");
