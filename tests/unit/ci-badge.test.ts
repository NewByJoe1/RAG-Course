import { describe, expect, it } from "vitest";
import { branchForModule, ciBadgeState, moduleCi, type BranchCheck } from "@/lib/capstone/ci-badge";
import { modules } from "@/content";
import { CI_STATUSES } from "@/supabase/functions/_shared/capstone";

const now = new Date("2026-10-15T12:00:00Z");

describe("branchForModule", () => {
  it("maps each published module to its capstone branch, in course order", () => {
    const published = modules.filter((m) => m.is_published).sort((a, b) => a.order_index - b.order_index);
    const mapping = Object.fromEntries(published.map((m) => [m.id, branchForModule(m.order_index)]));
    expect(mapping).toEqual({
      m00: null, // set-up: no branch
      m01: "naive-rag",
      m02: "pre-retrieval",
      m03: "hybrid-retrieval",
      m04: "post-retrieval",
      m05: "rerank",
      m06: "fine-tuned",
      m07: "eval",
      m08: "automation",
      m09: "harness",
      m10: "legal-domain",
      m11: "legal-embeddings",
      m12: "main",
    });
    // Modules 2–11 already use their branch as their slug.
    for (const m of published.filter((x) => x.order_index >= 2 && x.order_index <= 11)) expect(branchForModule(m.order_index)).toBe(m.slug);
  });

  it("has no branch outside the course", () => {
    expect(branchForModule(0)).toBeNull();
    expect(branchForModule(13)).toBeNull();
  });
});

describe("ciBadgeState", () => {
  it("covers every CI status", () => {
    expect(Object.fromEntries(CI_STATUSES.map((s) => [s, ciBadgeState(s)]))).toEqual({
      success: "passing",
      failure: "failing",
      error: "failing",
      cancelled: "failing",
      in_progress: "running",
      queued: "running",
      no_runs: "no_runs",
    });
    expect(ciBadgeState(null)).toBe("no_runs");
    expect(ciBadgeState(undefined)).toBe("no_runs");
  });
});

describe("moduleCi", () => {
  const checks: BranchCheck[] = [
    { check_key: "naive-rag", ci_status: "success", last_run_at: "2026-10-15T10:00:00Z", run_url: "https://github.com/o/r/actions/runs/1" },
    { check_key: "pre-retrieval", ci_status: "failure", last_run_at: "2026-10-15T11:45:00Z", run_url: "https://github.com/o/r/actions/runs/2" },
    { check_key: "rerank", ci_status: "error", last_run_at: "2026-10-15T11:00:00Z", run_url: null },
    { check_key: "eval", ci_status: "no_runs", last_run_at: null, run_url: null },
  ];

  it("passing", () => {
    expect(moduleCi(1, checks, now)).toMatchObject({ branch: "naive-rag", state: "passing", ariaLabel: "CI for branch naive-rag: Passing, last run 2 h ago" });
  });

  it("failing, saying why when it wasn't a plain failure", () => {
    expect(moduleCi(2, checks, now)?.ariaLabel).toBe("CI for branch pre-retrieval: Failing, last run 15 min ago");
    expect(moduleCi(5, checks, now)?.ariaLabel).toBe("CI for branch rerank: Failing (error), last run 1 h ago");
  });

  it("no runs: explicit no_runs, or no row at all (e.g. no repo linked)", () => {
    expect(moduleCi(7, checks, now)).toMatchObject({ state: "no_runs", ariaLabel: "CI for branch eval: No runs yet" });
    expect(moduleCi(3, checks, now)).toMatchObject({ branch: "hybrid-retrieval", state: "no_runs", lastRunAt: null, runUrl: null });
    expect(moduleCi(12, [], now)).toMatchObject({ branch: "main", state: "no_runs" });
  });
});
