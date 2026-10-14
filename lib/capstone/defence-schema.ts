import { z } from "zod";
import { DEFENCE_QUESTION_COUNT } from "./defence";

// Server-side validation for recorded defences.
export const defenceQuestionSchema = z.object({
  question: z.string().trim().min(1, "Write down the question you asked.").max(1000),
  citation_verified: z.boolean(),
  passed: z.boolean(),
  note: z
    .string()
    .trim()
    .max(2000)
    .nullable()
    .transform((v) => (v ? v : null)),
});

export const defenceSchema = z.object({
  questions: z.array(defenceQuestionSchema).length(DEFENCE_QUESTION_COUNT),
  closing_passed: z.boolean(),
  closing_note: z
    .string()
    .trim()
    .max(2000)
    .nullable()
    .transform((v) => (v ? v : null)),
});
