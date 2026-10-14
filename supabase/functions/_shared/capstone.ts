// Capstone contract shared by the poll-ci edge function (Deno), the Next app
// and tests. Keep this file dependency-free so it runs in all three.

/** Branches every learner repo is checked on. `main` drives the criteria. */
export const CAPSTONE_BRANCHES = [
  "naive-rag",
  "pre-retrieval",
  "hybrid-retrieval",
  "post-retrieval",
  "rerank",
  "fine-tuned",
  "eval",
  "automation",
  "harness",
  "legal-domain",
  "legal-embeddings",
  "main",
] as const;
export type CapstoneBranch = (typeof CAPSTONE_BRANCHES)[number];

export const CRITERIA_BRANCH: CapstoneBranch = "main";

/** The six capstone criteria, in display order. */
export const CRITERIA = ["recall", "citation", "isolation", "nightly", "kill_switch", "defence"] as const;
export type Criterion = (typeof CRITERIA)[number];

/** Set by a reviewer, never by CI. */
export const MANUAL_CRITERIA: readonly Criterion[] = ["defence"];

export const THRESHOLDS = {
  recall_at_3: 0.85,
  citation_accuracy: 0.95,
  cross_tenant_leaks: 0,
  concurrent_users_tested: 100,
  nightly_runs: 3,
} as const;

/** Contents of eval/results.json, uploaded by the template's eval.yml as artifact "eval-results". */
export type EvalResults = {
  branch: string;
  recall_at_3: number;
  citation_accuracy: number;
  cross_tenant_leaks: number;
  concurrent_users_tested: number;
  nightly_runs: number;
  kill_switch_tested: boolean;
};

export const RESULTS_ARTIFACT_NAME = "eval-results";
export const RESULTS_FILE_NAME = "results.json";
export const EVAL_WORKFLOW_FILE = "eval.yml";
export const MAX_ARTIFACT_BYTES = 1_000_000;

export type ParseResult = { ok: true; results: EvalResults } | { ok: false; error: string };

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isCount = (v: unknown): v is number => isNum(v) && Number.isInteger(v) && v >= 0;
const isRatio = (v: unknown): v is number => isNum(v) && v >= 0 && v <= 1;

/** Strictly validate a parsed results.json. Unknown extra fields are ignored. */
export function parseEvalResults(raw: unknown): ParseResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "results.json must be a JSON object" };
  const r = raw as Record<string, unknown>;
  const problems: string[] = [];
  if (typeof r.branch !== "string" || !r.branch) problems.push("branch must be a non-empty string");
  if (!isRatio(r.recall_at_3)) problems.push("recall_at_3 must be a number between 0 and 1");
  if (!isRatio(r.citation_accuracy)) problems.push("citation_accuracy must be a number between 0 and 1");
  if (!isCount(r.cross_tenant_leaks)) problems.push("cross_tenant_leaks must be a non-negative integer");
  if (!isCount(r.concurrent_users_tested)) problems.push("concurrent_users_tested must be a non-negative integer");
  if (!isCount(r.nightly_runs)) problems.push("nightly_runs must be a non-negative integer");
  if (typeof r.kill_switch_tested !== "boolean") problems.push("kill_switch_tested must be true or false");
  if (problems.length) return { ok: false, error: problems.join("; ") };

  return {
    ok: true,
    results: {
      branch: r.branch as string,
      recall_at_3: r.recall_at_3 as number,
      citation_accuracy: r.citation_accuracy as number,
      cross_tenant_leaks: r.cross_tenant_leaks as number,
      concurrent_users_tested: r.concurrent_users_tested as number,
      nightly_runs: r.nightly_runs as number,
      kill_switch_tested: r.kill_switch_tested as boolean,
    },
  };
}

/**
 * Which automatic criteria a run's results meet. Never returns 'defence',
 * which only a reviewer can set.
 */
export function evaluateCriteria(r: EvalResults): Criterion[] {
  const met: Criterion[] = [];
  if (r.recall_at_3 >= THRESHOLDS.recall_at_3) met.push("recall");
  if (r.citation_accuracy >= THRESHOLDS.citation_accuracy) met.push("citation");
  if (r.cross_tenant_leaks === THRESHOLDS.cross_tenant_leaks && r.concurrent_users_tested >= THRESHOLDS.concurrent_users_tested) {
    met.push("isolation");
  }
  if (r.nightly_runs >= THRESHOLDS.nightly_runs) met.push("nightly");
  if (r.kill_switch_tested === true) met.push("kill_switch");
  return met;
}

/** Keep reviewer-set criteria from the stored row, take everything else from CI. */
export function mergeCriteria(fromCi: readonly Criterion[], stored: readonly string[] | null | undefined): Criterion[] {
  const manual = (stored ?? []).filter((c): c is Criterion => (MANUAL_CRITERIA as readonly string[]).includes(c));
  return CRITERIA.filter((c) => fromCi.includes(c) || manual.includes(c));
}

export const allCriteriaMet = (met: readonly string[] | null | undefined) => CRITERIA.every((c) => (met ?? []).includes(c));

// --- CI status ---------------------------------------------------------------

export const CI_STATUSES = ["success", "failure", "cancelled", "in_progress", "queued", "no_runs", "error"] as const;
export type CiStatus = (typeof CI_STATUSES)[number];

/** Map a GitHub Actions workflow run's status/conclusion to our badge status. */
export function ciStatusFromRun(run: { status: string | null; conclusion: string | null }): CiStatus {
  if (run.status !== "completed") return run.status === "queued" || run.status === "waiting" || run.status === "pending" || run.status === "requested" ? "queued" : "in_progress";
  switch (run.conclusion) {
    case "success":
      return "success";
    case "failure":
    case "timed_out":
    case "startup_failure":
      return "failure";
    default: // cancelled, skipped, neutral, stale, action_required
      return "cancelled";
  }
}

/** owner/name, as GitHub allows them. Also accepts a pasted github.com URL. */
export function normalizeGithubRepo(input: string): string | null {
  const trimmed = input.trim().replace(/\.git$/, "").replace(/\/+$/, "");
  const m = /^(?:https?:\/\/(?:www\.)?github\.com\/)?([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100})$/.exec(trimmed);
  if (!m || m[2] === "." || m[2] === "..") return null;
  return `${m[1]}/${m[2]}`;
}
