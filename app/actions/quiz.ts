"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseQuizFormData, type QuizItemRef } from "@/lib/course/quiz";
import { quizResultSchema, type QuizResult } from "@/lib/course/quiz-result";

export type QuizState =
  | { status: "idle" }
  | { status: "error"; error: string }
  | { status: "graded"; result: QuizResult };

/**
 * Scores a whole-module quiz. Grading, the 80% pass gate and the progress
 * update all happen inside public.submit_module_quiz() so they can't be
 * forged client-side; this action parses the form and relays the result.
 * Bind moduleId and slug: submitQuiz.bind(null, moduleId, slug).
 */
export async function submitQuiz(
  moduleId: string,
  slug: string,
  _prev: QuizState,
  formData: FormData,
): Promise<QuizState> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", error: "Your session has expired. Log in again to submit." };

  const { data: items, error: itemsError } = await supabase
    .from("quiz_items")
    .select("id, kind")
    .eq("module_id", moduleId);
  if (itemsError) return { status: "error", error: "Couldn't load this quiz. Try again." };
  if (!items?.length) return { status: "error", error: "This module has no quiz." };

  const responses = parseQuizFormData(formData, items as QuizItemRef[]);
  if (Object.keys(responses).length === 0) return { status: "error", error: "Answer at least one question before submitting." };

  const { data, error } = await supabase.rpc("submit_module_quiz", {
    p_module_id: moduleId,
    p_responses: responses,
  });
  if (error) {
    if (error.hint === "module_locked") {
      return { status: "error", error: "This module is locked. Pass the previous module's quiz first." };
    }
    return { status: "error", error: "Couldn't submit your answers. Try again." };
  }

  const parsed = quizResultSchema.safeParse(data);
  if (!parsed.success) return { status: "error", error: "Unexpected response from the grader." };

  revalidatePath(`/modules/${slug}`);
  revalidatePath("/mastery");
  revalidatePath("/");
  return { status: "graded", result: parsed.data };
}
