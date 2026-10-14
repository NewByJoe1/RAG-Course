import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { previewIntervals, REVIEW_BATCH_SIZE } from "@/lib/scheduler";
import { ReviewSession, type SessionCard } from "@/components/review/ReviewSession";
import type { QuizKind } from "@/lib/course/quiz";

export const metadata = { title: "Review · RAG Course" };

type Row = {
  id: string;
  ease_factor: number | string;
  interval_days: number;
  quiz_items: { id: string; kind: string; prompt: string; choices: { id: string; text: string }[] | null; modules: { title: string } } | null;
  failure_cases: {
    id: string;
    title: string;
    user_query: string;
    retrieved_context: { source: string; text: string; score?: number }[];
    bad_output: string;
    root_cause: string;
    fix: string;
    cause_options: { id: string; text: string }[] | null;
    correct_cause: string | null;
    modules: { title: string };
  } | null;
};

export default async function ReviewPage() {
  const supabase = createClient();
  const now = new Date().toISOString();

  const [{ data: rows }, { count: dueCount }, { data: upcoming }] = await Promise.all([
    supabase
      .from("review_cards")
      .select(
        "id, ease_factor, interval_days, quiz_items(id, kind, prompt, choices, modules(title)), failure_cases(id, title, user_query, retrieved_context, bad_output, root_cause, fix, cause_options, correct_cause, modules(title))",
      )
      .lte("due_at", now)
      .order("due_at")
      .limit(REVIEW_BATCH_SIZE)
      .returns<Row[]>(),
    supabase.from("review_cards").select("id", { count: "exact", head: true }).lte("due_at", now),
    supabase.from("review_cards").select("due_at").gt("due_at", now).order("due_at").limit(1).maybeSingle(),
  ]);

  const cards: SessionCard[] = (rows ?? []).flatMap((r): SessionCard[] => {
    const previews = previewIntervals({ interval_days: r.interval_days, ease_factor: Number(r.ease_factor) });
    if (r.quiz_items) {
      const q = r.quiz_items;
      return [{ type: "quiz", id: r.id, quizItemId: q.id, previews, module: q.modules.title, kind: q.kind as QuizKind, prompt: q.prompt, choices: q.choices }];
    }
    if (r.failure_cases) {
      const f = r.failure_cases;
      // Card id, not the failure case id: rating targets the review_cards row.
      return [{ ...f, type: "failure", id: r.id, failureCaseId: f.id, previews, module: f.modules.title }];
    }
    return [];
  });

  return (
    <div className="space-y-6 py-10">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl font-semibold">Review</h1>
        <p className="text-sm text-neutral-500">
          {dueCount ?? 0} due · up to {REVIEW_BATCH_SIZE} per session
        </p>
      </header>

      {cards.length === 0 ? (
        <div className="space-y-2 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
          <p className="font-medium">Nothing due right now.</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {upcoming
              ? `Next card is due ${new Date(upcoming.due_at).toLocaleString()}.`
              : "Pass a module's quiz to add its questions and failure cases to your review deck."}
          </p>
          <Link href="/streak" className="text-sm underline">See your streak</Link>
        </div>
      ) : (
        <ReviewSession cards={cards} remainingAfter={Math.max(0, (dueCount ?? 0) - cards.length)} />
      )}
    </div>
  );
}
