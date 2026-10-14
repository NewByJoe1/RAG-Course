import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getReviewer, learnerName } from "@/lib/capstone/reviewer";
import { ReviewersOnly } from "@/components/reviewer/ReviewersOnly";
import { CRITERIA } from "@/supabase/functions/_shared/capstone";

export const metadata = { title: "Reviewer · RAG Course" };

export default async function ReviewerPage() {
  const supabase = createClient();
  const { user, isReviewer } = await getReviewer(supabase);
  if (!user || !isReviewer) return <ReviewersOnly />;

  const [{ data: learners }, { data: mains }, { data: defences }] = await Promise.all([
    supabase.from("profiles").select("id, display_name, email, github_repo").not("github_repo", "is", null).order("display_name"),
    supabase.from("capstone_checks").select("user_id, criteria_met, ci_status").eq("check_key", "main"),
    supabase.from("capstone_defences").select("learner_id, passed, recorded_at").order("recorded_at", { ascending: false }),
  ]);

  const mainBy = new Map((mains ?? []).map((m) => [m.user_id, m]));
  const latestDefence = new Map<string, { passed: boolean; recorded_at: string }>();
  for (const d of defences ?? []) if (!latestDefence.has(d.learner_id)) latestDefence.set(d.learner_id, d);

  const rows = (learners ?? [])
    .filter((l) => l.id !== user.id) // a reviewer never defends their own capstone
    .map((l) => {
      const met = (mainBy.get(l.id)?.criteria_met ?? []) as string[];
      return { ...l, metCount: CRITERIA.filter((c) => met.includes(c)).length, latest: latestDefence.get(l.id) ?? null };
    });

  return (
    <div className="space-y-6 py-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">Capstone defences</h1>
        <p className="text-neutral-600 dark:text-neutral-400">Learners with a linked capstone repo. Criteria are counted on main.</p>
      </header>

      {rows.length === 0 ? (
        <p className="text-neutral-500">No other learners have linked a capstone repo yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-500">
            <tr>
              <th className="py-2 pr-4 font-medium">Learner</th>
              <th className="py-2 pr-4 font-medium">Criteria</th>
              <th className="py-2 font-medium">Latest defence</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-neutral-200 dark:border-neutral-800">
                <td className="py-2 pr-4">
                  <Link href={`/reviewer/${r.id}`} className="underline-offset-4 hover:underline">{learnerName(r)}</Link>
                  <span className="block font-mono text-xs text-neutral-500">{r.github_repo}</span>
                </td>
                <td className="py-2 pr-4 tabular-nums">{r.metCount}/6</td>
                <td className="py-2">
                  {r.latest ? (
                    <>
                      {r.latest.passed ? "Passed" : "Not passed"}
                      <span className="block text-xs text-neutral-500">{new Date(r.latest.recorded_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC</span>
                    </>
                  ) : (
                    <span className="text-neutral-500">None yet</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
