import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getReviewer, learnerName } from "@/lib/capstone/reviewer";
import { ReviewersOnly } from "@/components/reviewer/ReviewersOnly";
import { DefenceForm } from "@/components/reviewer/DefenceForm";
import { CRITERION_INFO } from "@/lib/capstone/view";
import { CLOSING_QUESTION } from "@/lib/capstone/defence";
import { CRITERIA } from "@/supabase/functions/_shared/capstone";

export const metadata = { title: "Record defence · RAG Course" };

type DefenceRow = {
  id: string;
  reviewer_id: string;
  recorded_at: string;
  passed: boolean;
  closing_passed: boolean;
  closing_note: string | null;
  questions: { question: string; citation_verified: boolean; passed: boolean; note: string | null }[];
};

const when = (iso: string) => `${new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC`;

export default async function LearnerDefencePage({ params }: { params: { learnerId: string } }) {
  const supabase = createClient();
  const { user, isReviewer } = await getReviewer(supabase);
  if (!user || !isReviewer) return <ReviewersOnly />;

  const { data: learner } = await supabase
    .from("profiles")
    .select("id, display_name, email, github_repo")
    .eq("id", params.learnerId)
    .not("github_repo", "is", null)
    .maybeSingle();
  if (!learner) notFound();

  const [{ data: main }, { data: defences }, { data: reviewers }] = await Promise.all([
    supabase.from("capstone_checks").select("criteria_met, ci_status").eq("user_id", learner.id).eq("check_key", "main").maybeSingle(),
    supabase
      .from("capstone_defences")
      .select("id, reviewer_id, recorded_at, passed, closing_passed, closing_note, questions")
      .eq("learner_id", learner.id)
      .order("recorded_at", { ascending: false })
      .returns<DefenceRow[]>(),
    supabase.from("profiles").select("id, display_name, email").eq("is_reviewer", true),
  ]);

  const met = (main?.criteria_met ?? []) as string[];
  const reviewerName = new Map((reviewers ?? []).map((r) => [r.id, learnerName(r)]));
  const isSelf = learner.id === user.id;
  const name = learnerName(learner);

  return (
    <div className="space-y-8 py-10">
      <header className="space-y-1">
        <Link href="/reviewer" className="text-sm underline">← All learners</Link>
        <h1 className="text-3xl font-semibold">{name}</h1>
        <p className="font-mono text-sm text-neutral-500">{learner.github_repo}</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Criteria on main: {CRITERIA.filter((c) => met.includes(c)).length}/6</h2>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {CRITERIA.map((c) => (
            <li key={c}>
              {met.includes(c) ? "✓" : "○"} {CRITERION_INFO[c].label}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Record a defence</h2>
        {isSelf ? (
          <p className="text-neutral-600 dark:text-neutral-400">You can&apos;t record your own defence. Another reviewer has to do it.</p>
        ) : (
          <>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              The defence criterion is met only if all six questions pass with a verified citation and the closing question passes. The latest
              defence counts; earlier ones are kept below.
            </p>
            <DefenceForm learnerId={learner.id} learnerName={name} />
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">History</h2>
        {(defences ?? []).length === 0 ? (
          <p className="text-neutral-500">No defences recorded yet.</p>
        ) : (
          <ol className="space-y-3">
            {(defences ?? []).map((d, i) => (
              <li key={d.id} className="rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
                <details>
                  <summary className="cursor-pointer">
                    <span className="font-medium">{d.passed ? "Passed" : "Not passed"}</span>
                    {i === 0 && <span className="ml-2 rounded bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-800">counts</span>}
                    <span className="ml-2 text-neutral-500">
                      {when(d.recorded_at)} · by {reviewerName.get(d.reviewer_id) ?? d.reviewer_id.slice(0, 8)}
                    </span>
                  </summary>
                  <ol className="mt-3 list-decimal space-y-2 pl-5">
                    {d.questions.map((q, j) => (
                      <li key={j}>
                        <p>{q.question}</p>
                        <p className="text-neutral-500">
                          {q.passed ? "Pass" : "Fail"} · {q.citation_verified ? "verified citation" : "no verified citation"}
                          {q.note && <> · {q.note}</>}
                        </p>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-3">
                    <span className="italic">&ldquo;{CLOSING_QUESTION}&rdquo;</span>{" "}
                    <span className="text-neutral-500">
                      {d.closing_passed ? "Pass" : "Fail"}
                      {d.closing_note && <> · {d.closing_note}</>}
                    </span>
                  </p>
                </details>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
