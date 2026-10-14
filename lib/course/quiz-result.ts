import { z } from "zod";

// Shape of public.submit_module_quiz() output. Kept out of quiz.ts so the
// client quiz form doesn't bundle zod.
export const quizResultSchema = z.object({
  module_id: z.string(),
  correct: z.number(),
  total: z.number(),
  score: z.coerce.number(),
  threshold: z.coerce.number(),
  passed: z.boolean(),
  best_score: z.coerce.number().nullable(),
  passed_at: z.string().nullable(),
  cards_enrolled: z.number().optional(),
  results: z.array(
    z.object({
      quiz_item_id: z.string(),
      answered: z.boolean(),
      is_correct: z.boolean(),
      correct_answer: z.unknown(),
      explanation: z.string(),
    }),
  ),
});

export type QuizResult = z.infer<typeof quizResultSchema>;
