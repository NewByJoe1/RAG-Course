import { z } from "zod";

// Schemas mirror supabase/migrations/0001_init.sql. Content uses stable text
// ids (m01, m01-s01, m01-q01, m01-f01) so reseeding upserts in place.

export const lessonStepSchema = z.object({
  id: z.string().regex(/^m\d{2}-s\d{2}$/),
  order_index: z.number().int().nonnegative(),
  kind: z.enum(["concept", "example", "exercise", "reflection"]),
  title: z.string().min(1),
  body_md: z.string().min(1),
  code_snippet: z.string().nullable().default(null),
  code_language: z.string().nullable().default(null),
});

const choiceSchema = z.object({ id: z.string().min(1), text: z.string().min(1) });

const quizBase = {
  id: z.string().regex(/^m\d{2}-q\d{2}$/),
  lesson_step_id: z.string().nullable().default(null),
  order_index: z.number().int().nonnegative(),
  prompt: z.string().min(1),
  explanation: z.string().default(""),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
};

export const quizItemSchema = z
  .discriminatedUnion("kind", [
    z.object({
      ...quizBase,
      kind: z.literal("single_choice"),
      choices: z.array(choiceSchema).min(2),
      answer: z.object({ choice: z.string() }),
    }),
    z.object({
      ...quizBase,
      kind: z.literal("multi_choice"),
      choices: z.array(choiceSchema).min(2),
      answer: z.object({ choices: z.array(z.string()).min(1) }),
    }),
    z.object({
      ...quizBase,
      kind: z.literal("short_answer"),
      choices: z.null().default(null),
      answer: z.object({ accepted: z.array(z.string().min(1)).min(1) }),
    }),
  ])
  .superRefine((item, ctx) => {
    if (item.kind === "short_answer") return;
    const ids = new Set(item.choices.map((c) => c.id));
    const keys = item.kind === "single_choice" ? [item.answer.choice] : item.answer.choices;
    for (const k of keys) {
      if (!ids.has(k)) ctx.addIssue({ code: "custom", message: `${item.id}: answer "${k}" is not a choice id` });
    }
  });

export const failureCaseSchema = z.object({
  id: z.string().regex(/^m\d{2}-f\d{2}$/),
  order_index: z.number().int().nonnegative(),
  title: z.string().min(1),
  category: z.enum([
    "retrieval_miss",
    "chunking",
    "ranking",
    "context_overflow",
    "hallucination",
    "stale_index",
    "prompt",
  ]),
  user_query: z.string().min(1),
  retrieved_context: z.array(z.object({ source: z.string(), text: z.string(), score: z.number().optional() })),
  bad_output: z.string().min(1),
  symptom: z.string().min(1),
  root_cause: z.string().min(1),
  fix: z.string().min(1),
});

export const moduleSchema = z
  .object({
    id: z.string().regex(/^m\d{2}$/),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    order_index: z.number().int().nonnegative(),
    title: z.string().min(1),
    summary: z.string(),
    learning_objectives: z.array(z.string()),
    estimated_minutes: z.number().int().nonnegative(),
    is_published: z.boolean(),
    lesson_steps: z.array(lessonStepSchema),
    quiz_items: z.array(quizItemSchema),
    failure_cases: z.array(failureCaseSchema),
  })
  .superRefine((m, ctx) => {
    const stepIds = new Set(m.lesson_steps.map((s) => s.id));
    const check = (label: string, rows: { id: string; order_index: number }[]) => {
      const ids = new Set<string>();
      const orders = new Set<number>();
      for (const r of rows) {
        if (!r.id.startsWith(`${m.id}-`)) ctx.addIssue({ code: "custom", message: `${r.id} must be prefixed with ${m.id}-` });
        if (ids.has(r.id)) ctx.addIssue({ code: "custom", message: `duplicate ${label} id ${r.id}` });
        if (orders.has(r.order_index)) ctx.addIssue({ code: "custom", message: `duplicate ${label} order_index ${r.order_index}` });
        ids.add(r.id);
        orders.add(r.order_index);
      }
    };
    check("lesson_step", m.lesson_steps);
    check("quiz_item", m.quiz_items);
    check("failure_case", m.failure_cases);
    for (const q of m.quiz_items) {
      if (q.lesson_step_id && !stepIds.has(q.lesson_step_id)) {
        ctx.addIssue({ code: "custom", message: `${q.id}: lesson_step_id ${q.lesson_step_id} not in module` });
      }
    }
  });

export type LessonStep = z.input<typeof lessonStepSchema>;
export type QuizItem = z.input<typeof quizItemSchema>;
export type FailureCase = z.input<typeof failureCaseSchema>;
export type ModuleContent = z.input<typeof moduleSchema>;
