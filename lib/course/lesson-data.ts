import * as React from "react";
import { createClient } from "@/lib/supabase/server";
import type { GlossaryEntry } from "@/components/lesson/Glossary";
import type { LessonFailureCase } from "@/components/lesson/FailureCases";
import type { WorkedStep } from "@/components/lesson/WorkedExample";
import type { StudyPoint } from "@/components/lesson/StudyGuide";
import { lessonTabs, type LessonTab } from "./lesson-tabs";

export type LessonStepRow = {
  id: string;
  order_index: number;
  kind: string;
  title: string;
  body_md: string;
  code_snippet: string | null;
  code_language: string | null;
};

export type LessonModule = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  order_index: number;
  learning_objectives: string[];
  estimated_minutes: number | null;
  hook: string | null;
  pipeline_stages: string[] | null;
  explain_back_prompt: string | null;
  video: unknown;
};

export type Lesson = {
  mod: LessonModule;
  user: { id: string } | null;
  steps: LessonStepRow[];
  quizCount: number;
  progress: { best_score: number | null; passed_at: string | null } | null;
  /** True for modules rewritten in the tabbed beginner format. */
  lessonFormat: boolean;
  failures: LessonFailureCase[];
  worked: WorkedStep[];
  terms: GlossaryEntry[];
  points: StudyPoint[];
  lastExplain: { response: string; created_at: string } | null;
  tabs: LessonTab[];
};

// React's per-request cache (Next's bundled React has it) lets the layout and
// the page share one load. Plain React 18 in tests doesn't, so fall back.
const cache: <F extends (...args: never[]) => unknown>(f: F) => F = (React as unknown as { cache?: typeof cache }).cache ?? ((f) => f);

/** Everything the lesson pages render, for one module. Null when it doesn't exist. */
export const getLesson = cache(async (slug: string): Promise<Lesson | null> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: mod } = await supabase
    .from("modules")
    .select("id, slug, title, summary, order_index, learning_objectives, estimated_minutes, hook, pipeline_stages, explain_back_prompt, video")
    .eq("slug", slug)
    .maybeSingle();
  if (!mod) return null;

  const [{ data: steps }, { count: quizCount }, { data: progress }] = await Promise.all([
    supabase.from("lesson_steps").select("id, order_index, kind, title, body_md, code_snippet, code_language").eq("module_id", mod.id).order("order_index"),
    supabase.from("quiz_items").select("id", { count: "exact", head: true }).eq("module_id", mod.id),
    supabase.from("progress").select("best_score, passed_at").eq("module_id", mod.id).maybeSingle(),
  ]);

  const base = {
    mod: mod as LessonModule,
    user: user ? { id: user.id } : null,
    steps: (steps ?? []) as LessonStepRow[],
    quizCount: quizCount ?? 0,
    progress: progress ?? null,
  };
  if (!mod.hook) return { ...base, lessonFormat: false, failures: [], worked: [], terms: [], points: [], lastExplain: null, tabs: [] };

  const [{ data: failures }, { data: worked }, { data: glossaryRows }, { data: points }, { data: lastExplain }] = await Promise.all([
    supabase
      .from("failure_cases")
      .select("id, title, user_query, retrieved_context, bad_output, symptom, root_cause, fix, cause_options, correct_cause")
      .eq("module_id", mod.id)
      .order("order_index"),
    supabase.from("worked_example_steps").select("id, title, body_md, code_snippet, stage, query_state").eq("module_id", mod.id).order("order_index"),
    supabase.from("module_glossary").select("order_index, glossary_terms(id, term, definition, stage)").eq("module_id", mod.id).order("order_index"),
    supabase.from("study_guide_points").select("id, point, narration").eq("module_id", mod.id).order("order_index"),
    user
      ? supabase.from("explain_back_responses").select("response, created_at").eq("module_id", mod.id).order("created_at", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const terms = (glossaryRows ?? []).map((r) => r.glossary_terms as unknown as GlossaryEntry).filter(Boolean);
  const lesson = {
    ...base,
    lessonFormat: true,
    failures: (failures ?? []) as LessonFailureCase[],
    worked: (worked ?? []) as WorkedStep[],
    terms,
    points: (points ?? []) as StudyPoint[],
    lastExplain: (lastExplain as Lesson["lastExplain"]) ?? null,
  };
  return {
    ...lesson,
    tabs: lessonTabs({
      slug: mod.slug,
      title: mod.title,
      steps: base.steps,
      failures: lesson.failures.length,
      glossary: terms.length,
      studyPoints: lesson.points.length,
      quizItems: base.quizCount,
    }),
  };
});
