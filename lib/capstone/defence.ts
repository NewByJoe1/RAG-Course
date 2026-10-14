// Capstone oral defence (Module 12, Day 5): six questions plus a closing
// question. Mirrors public.capstone_defences; the database computes the
// stored result, this copy drives the form's live preview. (The zod schema is
// in defence-schema.ts so the client form doesn't bundle zod.)

export const DEFENCE_QUESTION_COUNT = 6;
export const CLOSING_QUESTION = "What would make this answer wrong, and how would you know?";

export type DefenceQuestion = { question: string; citation_verified: boolean; passed: boolean; note?: string | null };
export type DefenceInput = { questions: DefenceQuestion[]; closing_passed: boolean; closing_note?: string | null };

export type DefenceVerdict = { passed: boolean; reasons: string[] };

/**
 * Met only if all six questions pass with a verified citation AND the
 * closing question passes. Same rule as the database trigger.
 */
export function defenceVerdict(d: { questions: Pick<DefenceQuestion, "passed" | "citation_verified">[]; closing_passed: boolean }): DefenceVerdict {
  const reasons: string[] = [];
  d.questions.forEach((q, i) => {
    if (!q.passed) reasons.push(`Question ${i + 1} failed`);
    else if (!q.citation_verified) reasons.push(`Question ${i + 1} had no verified citation`);
  });
  if (d.questions.length !== DEFENCE_QUESTION_COUNT) reasons.push(`Needs ${DEFENCE_QUESTION_COUNT} questions`);
  if (!d.closing_passed) reasons.push("Closing question failed");
  return { passed: reasons.length === 0, reasons };
}
