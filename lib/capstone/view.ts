import {
  allCriteriaMet,
  CAPSTONE_BRANCHES,
  CRITERIA,
  CRITERIA_BRANCH,
  THRESHOLDS,
  type CiStatus,
  type Criterion,
  type EvalResults,
} from "@/supabase/functions/_shared/capstone";

export type CheckRecord = {
  check_key: string;
  ci_status: CiStatus | null;
  last_run_at: string | null;
  run_url: string | null;
  criteria_met: string[] | null;
  results: EvalResults | null;
  error: string | null;
};

export type BranchRow = {
  branch: string;
  ciStatus: CiStatus | "not_checked";
  lastRunAt: string | null;
  runUrl: string | null;
  error: string | null;
};

export const CRITERION_INFO: Record<Criterion, { label: string; requirement: string; value?: (r: EvalResults) => string }> = {
  recall: { label: "Recall", requirement: `recall@3 ≥ ${THRESHOLDS.recall_at_3}`, value: (r) => r.recall_at_3.toFixed(2) },
  citation: { label: "Citation accuracy", requirement: `≥ ${THRESHOLDS.citation_accuracy}`, value: (r) => r.citation_accuracy.toFixed(2) },
  isolation: {
    label: "Tenant isolation",
    requirement: `0 cross-tenant leaks with ≥ ${THRESHOLDS.concurrent_users_tested} concurrent users`,
    value: (r) => `${r.cross_tenant_leaks} leaks · ${r.concurrent_users_tested} users`,
  },
  nightly: { label: "Nightly evals", requirement: `≥ ${THRESHOLDS.nightly_runs} successful nightly runs`, value: (r) => `${r.nightly_runs} runs` },
  kill_switch: { label: "Kill switch", requirement: "kill switch tested", value: (r) => (r.kill_switch_tested ? "tested" : "not tested") },
  defence: { label: "Defence", requirement: "signed off by a reviewer" },
};

const toRow = (branch: string, c: CheckRecord | undefined): BranchRow => ({
  branch,
  ciStatus: c?.ci_status ?? "not_checked",
  lastRunAt: c?.last_run_at ?? null,
  runUrl: c?.run_url ?? null,
  error: c?.error ?? null,
});

/**
 * Page model for /capstone: the 11 stage branches as rows, plus main, whose
 * criteria_met drives the six criteria.
 */
export function buildCapstoneView(checks: CheckRecord[]) {
  const by = new Map(checks.map((c) => [c.check_key, c]));
  const main = by.get(CRITERIA_BRANCH);
  const met = main?.criteria_met ?? [];

  return {
    branches: CAPSTONE_BRANCHES.filter((b) => b !== CRITERIA_BRANCH).map((b) => toRow(b, by.get(b))),
    main: toRow(CRITERIA_BRANCH, main),
    criteria: CRITERIA.map((key) => ({
      key,
      ...CRITERION_INFO[key],
      met: met.includes(key),
      measured: main?.results && CRITERION_INFO[key].value ? CRITERION_INFO[key].value!(main.results) : null,
    })),
    metCount: CRITERIA.filter((c) => met.includes(c)).length,
    allMet: allCriteriaMet(met),
  };
}

export function relativeTime(iso: string, now: Date = new Date()): string {
  const s = Math.round((now.getTime() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}
