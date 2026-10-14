"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseQuizFormData, type QuizKind } from "@/lib/course/quiz";
import { isRating, schedule, type Rating } from "@/lib/scheduler";

export type AnswerResult =
  | { status: "error"; error: string }
  | { status: "answered"; isCorrect: boolean; correctAnswer: unknown; explanation: string };

export type RateResult =
  | { status: "error"; error: string }
  | { status: "rated"; rating: Rating; intervalDays: number; dueAt: string };

type CardRow = {
  id: string;
  quiz_item_id: string | null;
  failure_case_id: string | null;
  ease_factor: number | string;
  interval_days: number;
  repetitions: number;
  lapses: number;
  due_at: string;
};

/** Grade a quiz-item card. Records a quiz_attempt (which also counts toward the streak). */
export async function answerReviewCard(cardId: string, formData: FormData): Promise<AnswerResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", error: "Your session has expired. Log in again." };

  const { data: card } = await supabase
    .from("review_cards")
    .select("id, quiz_item_id, quiz_items(id, kind)")
    .eq("id", cardId)
    .maybeSingle();
  const item = card?.quiz_items as unknown as { id: string; kind: QuizKind } | null;
  if (!card || !item) return { status: "error", error: "Card not found." };

  const response = parseQuizFormData(formData, [item])[item.id];
  if (!response) return { status: "error", error: "Answer the question first." };

  const { data, error } = await supabase.rpc("submit_quiz_attempt", { p_quiz_item_id: item.id, p_response: response });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) return { status: "error", error: "Couldn't grade that answer. Try again." };

  return { status: "answered", isCorrect: row.is_correct, correctAnswer: row.correct_answer, explanation: row.explanation };
}

/**
 * Apply again/hard/good/easy to a due card. For quiz cards the learner must
 * have answered since the card fell due, and a wrong answer always counts as
 * "again". A card can only be rated while due, so double-submits are no-ops.
 */
export async function rateReviewCard(cardId: string, requested: string): Promise<RateResult> {
  if (!isRating(requested)) return { status: "error", error: "Unknown rating." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", error: "Your session has expired. Log in again." };

  const { data: card } = await supabase
    .from("review_cards")
    .select("id, quiz_item_id, failure_case_id, ease_factor, interval_days, repetitions, lapses, due_at")
    .eq("id", cardId)
    .maybeSingle<CardRow>();
  if (!card) return { status: "error", error: "Card not found." };

  const now = new Date();
  if (new Date(card.due_at) > now) return { status: "error", error: "This card isn't due yet." };

  let rating: Rating = requested;
  if (card.quiz_item_id) {
    const { data: attempt } = await supabase
      .from("quiz_attempts")
      .select("is_correct, attempted_at")
      .eq("quiz_item_id", card.quiz_item_id)
      .gte("attempted_at", card.due_at)
      .order("attempted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!attempt) return { status: "error", error: "Answer the question before rating it." };
    if (!attempt.is_correct) rating = "again";
  }

  const next = schedule(
    {
      ease_factor: Number(card.ease_factor),
      interval_days: card.interval_days,
      repetitions: card.repetitions,
      lapses: card.lapses,
    },
    rating,
    now,
  );

  // Conditional on due_at so a second click (or tab) can't rate twice.
  const { data: updated, error } = await supabase
    .from("review_cards")
    .update(next)
    .eq("id", card.id)
    .eq("due_at", card.due_at)
    .select("id");
  if (error) return { status: "error", error: "Couldn't save your rating. Try again." };
  if (!updated?.length) return { status: "error", error: "This card was already rated." };

  await supabase.from("review_log").insert({ card_id: card.id, rating, interval_days: next.interval_days });

  revalidatePath("/streak");
  return { status: "rated", rating, intervalDays: next.interval_days, dueAt: next.due_at };
}
