import { z } from "zod";
import { PIPELINE_STAGE_IDS } from "./pipeline";
import { GLOSSARY } from "./glossary";

/** Marks unwritten content. Modules containing it can't be published. */
export const TODO_MARKER = "[TODO]";

// Schemas mirror supabase/migrations/0001_init.sql. Content uses stable text
// ids (m01, m01-s01, m01-q01, m01-f01) so reseeding upserts in place.

export const lessonStepSchema = z.object({
  id: z.string().regex(/^m\d{2}-s\d{2}$/),
  order_index: z.number().int().nonnegative(),
  kind: z.enum(["warm_up", "concept", "example", "exercise", "reflection"]),
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
    "evaluation",
    "monitoring",
    "guardrail",
  ]),
  user_query: z.string().min(1),
  retrieved_context: z.array(z.object({ source: z.string(), text: z.string(), score: z.number().optional() })),
  bad_output: z.string().min(1),
  symptom: z.string().min(1),
  root_cause: z.string().min(1),
  fix: z.string().min(1),
  // Optional multiple-choice diagnosis, shown before root_cause and fix.
  cause_options: z.array(choiceSchema).min(2).nullable().default(null),
  correct_cause: z.string().nullable().default(null),
}).superRefine((f, ctx) => {
  if ((f.cause_options === null) !== (f.correct_cause === null)) {
    ctx.addIssue({ code: "custom", message: `${f.id}: cause_options and correct_cause must be set together` });
    return;
  }
  if (!f.cause_options) return;
  const ids = f.cause_options.map((o) => o.id);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: `${f.id}: duplicate cause option ids` });
  if (!ids.includes(f.correct_cause!)) ctx.addIssue({ code: "custom", message: `${f.id}: correct_cause "${f.correct_cause}" is not an option id` });
});

const stageSchema = z.enum(PIPELINE_STAGE_IDS);

export const workedExampleStepSchema = z.object({
  id: z.string().regex(/^m\d{2}-w\d{2}$/),
  order_index: z.number().int().nonnegative(),
  title: z.string().min(1),
  body_md: z.string().min(1),
  code_snippet: z.string().nullable().default(null),
  code_language: z.string().nullable().default(null),
  stage: stageSchema.nullable().default(null),
  /** What the running example looks like at this step. */
  query_state: z.string().nullable().default(null),
});

export const studyGuidePointSchema = z.object({
  id: z.string().regex(/^m\d{2}-p\d{2}$/),
  order_index: z.number().int().nonnegative(),
  point: z.string().min(1),
  /** One narration paragraph; the study guide doubles as a video script. */
  narration: z.string().min(1),
});

/** Pilot seam: one module's process video. Null everywhere until the trial. */
export const videoSchema = z.object({ src: z.string().min(1), title: z.string().min(1), poster: z.string().optional(), captions: z.string().optional() });

const glossaryIds = new Set(GLOSSARY.map((g) => g.id));

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
    // Lesson structure (0010). All-or-nothing: setting hook requires the rest.
    hook: z.string().min(1).nullable().default(null),
    pipeline_stages: z.array(stageSchema).default([]),
    explain_back_prompt: z.string().min(1).nullable().default(null),
    video: videoSchema.nullable().default(null),
    worked_example: z.array(workedExampleStepSchema).default([]),
    glossary: z.array(z.string()).default([]),
    study_guide: z.array(studyGuidePointSchema).default([]),
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
    check("worked_example step", m.worked_example);
    check("study_guide point", m.study_guide);

    for (const g of m.glossary) {
      if (!glossaryIds.has(g)) ctx.addIssue({ code: "custom", message: `${m.id}: glossary term "${g}" isn't in content/glossary.ts` });
    }
    if (new Set(m.glossary).size !== m.glossary.length) ctx.addIssue({ code: "custom", message: `${m.id}: duplicate glossary terms` });

    // The beginner lesson format: once a module has a hook, it needs every part.
    if (m.hook !== null) {
      const need = (ok: boolean, what: string) => ok || ctx.addIssue({ code: "custom", message: `${m.id} has a hook, so it needs ${what}` });
      need(m.pipeline_stages.length > 0, "pipeline_stages");
      need(m.explain_back_prompt !== null, "an explain_back_prompt");
      need(m.worked_example.length >= 3, "at least 3 worked_example steps");
      need(m.study_guide.length >= 3, "at least 3 study_guide points");
      need(m.glossary.length >= 3, "at least 3 glossary terms");
      need(m.lesson_steps[0]?.kind === "warm_up", "a warm_up lesson step first");
      need(!m.lesson_steps.some((x) => x.kind === "example"), "its worked example in worked_example, not a lesson step");
      need(m.failure_cases.every((f) => f.cause_options), "cause options on every failure case");
    } else if (m.worked_example.length || m.study_guide.length || m.explain_back_prompt || m.pipeline_stages.length) {
      ctx.addIssue({ code: "custom", message: `${m.id}: lesson-structure fields need a hook too` });
    }
    // Drafts can be seeded unpublished, but placeholders must never reach learners.
    if (m.is_published) {
      const todos: string[] = [];
      const scan = (v: unknown, path: string) => {
        if (typeof v === "string") {
          if (v.includes(TODO_MARKER)) todos.push(path);
        } else if (Array.isArray(v)) v.forEach((x, i) => scan(x, `${path}[${i}]`));
        else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) scan(x, path ? `${path}.${k}` : k);
      };
      scan(m, "");
      if (todos.length) {
        ctx.addIssue({ code: "custom", message: `${m.id} is published but still has ${TODO_MARKER} placeholders: ${todos.slice(0, 5).join(", ")}${todos.length > 5 ? ", …" : ""}` });
      }
    }
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
