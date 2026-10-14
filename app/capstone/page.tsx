import { createClient } from "@/lib/supabase/server";
import { buildCapstoneView, relativeTime, type BranchRow, type CheckRecord } from "@/lib/capstone/view";
import { RepoForm } from "@/components/capstone/RepoForm";

export const metadata = { title: "Capstone · RAG Course" };

const BADGE: Record<BranchRow["ciStatus"], { label: string; cls: string }> = {
  success: { label: "Passing", cls: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200" },
  failure: { label: "Failing", cls: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200" },
  error: { label: "Error", cls: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200" },
  cancelled: { label: "Cancelled", cls: "bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200" },
  in_progress: { label: "Running", cls: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" },
  queued: { label: "Queued", cls: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" },
  no_runs: { label: "No runs", cls: "bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200" },
  not_checked: { label: "Not checked yet", cls: "bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400" },
};

function Badge({ status }: { status: BranchRow["ciStatus"] }) {
  const b = BADGE[status];
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${b.cls}`}>{b.label}</span>;
}

function LastRun({ row }: { row: BranchRow }) {
  if (!row.lastRunAt) return <span className="text-neutral-500">—</span>;
  const text = relativeTime(row.lastRunAt);
  return row.runUrl ? (
    <a href={row.runUrl} target="_blank" rel="noreferrer" title={row.lastRunAt} className="underline-offset-4 hover:underline">
      {text}
    </a>
  ) : (
    <span title={row.lastRunAt}>{text}</span>
  );
}

export default async function CapstonePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: checks }, { data: capstoneProgress }] = await Promise.all([
    supabase.from("profiles").select("github_repo").eq("id", user!.id).single(),
    supabase.from("capstone_checks").select("check_key, ci_status, last_run_at, run_url, criteria_met, results, error"),
    supabase.from("progress").select("mastered_at").eq("module_id", "m12").maybeSingle(),
  ]);

  const view = buildCapstoneView((checks ?? []) as CheckRecord[]);

  // Record mastery the first time all six criteria are met. The database
  // re-checks the criteria and keeps the first timestamp.
  let masteredAt: string | null = capstoneProgress?.mastered_at ?? null;
  if (view.allMet && !masteredAt) {
    const { data } = await supabase.rpc("claim_capstone_mastery");
    masteredAt = (data as string | null) ?? null;
  }

  const repo = profile?.github_repo ?? null;

  return (
    <div className="space-y-8 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Capstone</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Fork the capstone template, build each stage on its branch, and let CI prove it. Results refresh every 15 minutes.
        </p>
      </header>

      {view.allMet && (
        <div role="status" className="rounded-lg bg-green-600 px-5 py-4 text-white">
          <p className="text-lg font-semibold">Capstone passed 🎉</p>
          <p className="text-sm text-green-50">
            All six criteria met on main{masteredAt ? ` · mastered ${new Date(masteredAt).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" })}` : ""}.
          </p>
        </div>
      )}

      <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <RepoForm current={repo} />
        {repo && (
          <p className="mt-2 text-sm">
            <a href={`https://github.com/${repo}/actions/workflows/eval.yml`} target="_blank" rel="noreferrer" className="underline">
              View eval.yml runs on GitHub
            </a>
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Criteria</h2>
          <span className="text-sm text-neutral-500">
            {view.metCount}/6 met · measured on <code>main</code> <Badge status={view.main.ciStatus} />{" "}
            {view.main.lastRunAt && <LastRun row={view.main} />}
          </span>
        </div>
        {view.main.error && <p className="text-sm text-red-700 dark:text-red-300">main: {view.main.error}</p>}
        <ul className="grid gap-2 sm:grid-cols-2">
          {view.criteria.map((c) => (
            <li key={c.key} className="flex items-start gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
              <input type="checkbox" checked={c.met} readOnly disabled aria-label={c.label} className="mt-1 h-4 w-4" />
              <div>
                <p className="font-medium">{c.label}</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {c.requirement}
                  {c.measured && <> · now {c.measured}</>}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Branches</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-neutral-500">
              <tr>
                <th className="py-2 pr-4 font-medium">Branch</th>
                <th className="py-2 pr-4 font-medium">CI</th>
                <th className="py-2 font-medium">Last run</th>
              </tr>
            </thead>
            <tbody>
              {view.branches.map((b) => (
                <tr key={b.branch} className="border-t border-neutral-200 align-top dark:border-neutral-800">
                  <td className="py-2 pr-4 font-mono">
                    {b.branch}
                    {b.error && <p className="mt-1 font-sans text-xs text-red-700 dark:text-red-300">{b.error}</p>}
                  </td>
                  <td className="py-2 pr-4"><Badge status={b.ciStatus} /></td>
                  <td className="py-2"><LastRun row={b} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
