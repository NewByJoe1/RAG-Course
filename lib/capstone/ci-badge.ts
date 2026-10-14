import { CAPSTONE_BRANCHES, type CiStatus } from "@/supabase/functions/_shared/capstone";
import { relativeTime } from "./view";

// CI status per module on the mastery grid. Display only: unlocking never
// depends on CI. Reads the same capstone_checks rows as /capstone.

export type CiBadgeState = "passing" | "failing" | "running" | "no_runs";

/**
 * The capstone branch for a module: modules and branches line up in course
 * order (Module 1 ↔ naive-rag … Module 11 ↔ legal-embeddings, Module 12 ↔ main).
 */
export function branchForModule(orderIndex: number): string | null {
  return CAPSTONE_BRANCHES[orderIndex - 1] ?? null;
}

export function ciBadgeState(status: CiStatus | null | undefined): CiBadgeState {
  switch (status) {
    case "success":
      return "passing";
    case "failure":
    case "error":
    case "cancelled":
      return "failing";
    case "queued":
    case "in_progress":
      return "running";
    default: // no_runs, never polled, or no repo linked
      return "no_runs";
  }
}

export const CI_BADGE: Record<CiBadgeState, { label: string; icon: string; cls: string }> = {
  passing: { label: "Passing", icon: "✓", cls: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200" },
  failing: { label: "Failing", icon: "✗", cls: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200" },
  running: { label: "Running", icon: "…", cls: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" },
  no_runs: { label: "No runs yet", icon: "○", cls: "bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300" },
};

export type BranchCheck = {
  check_key: string;
  ci_status: CiStatus | null;
  last_run_at: string | null;
  run_url: string | null;
};

export type ModuleCi = {
  branch: string;
  state: CiBadgeState;
  /** Raw status, so "failing" can say whether it was a failure, an error or a cancellation. */
  status: CiStatus | null;
  lastRunAt: string | null;
  runUrl: string | null;
  /** Full accessible description; the badge never relies on colour alone. */
  ariaLabel: string;
};

export function moduleCi(orderIndex: number, checks: BranchCheck[], now: Date = new Date()): ModuleCi | null {
  const branch = branchForModule(orderIndex);
  if (!branch) return null;
  const check = checks.find((c) => c.check_key === branch);
  const status = check?.ci_status ?? null;
  const state = ciBadgeState(status);
  const detail = state === "failing" && status && status !== "failure" ? ` (${status})` : "";
  const when = state !== "no_runs" && check?.last_run_at ? `, last run ${relativeTime(check.last_run_at, now)}` : "";
  return {
    branch,
    state,
    status,
    lastRunAt: check?.last_run_at ?? null,
    runUrl: check?.run_url ?? null,
    ariaLabel: `CI for branch ${branch}: ${CI_BADGE[state].label}${detail}${when}`,
  };
}
