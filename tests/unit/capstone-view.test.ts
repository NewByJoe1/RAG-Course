import { describe, expect, it } from "vitest";
import { buildCapstoneView, relativeTime, type CheckRecord } from "@/lib/capstone/view";
import type { EvalResults } from "@/supabase/functions/_shared/capstone";

const results: EvalResults = {
  branch: "main",
  recall_at_3: 0.91,
  citation_accuracy: 0.9,
  cross_tenant_leaks: 0,
  concurrent_users_tested: 150,
  nightly_runs: 4,
  kill_switch_tested: true,
};

const check = (check_key: string, over: Partial<CheckRecord> = {}): CheckRecord => ({
  check_key,
  ci_status: "success",
  last_run_at: "2026-10-14T10:00:00Z",
  run_url: `https://github.com/o/r/actions/runs/${check_key}`,
  criteria_met: [],
  results: null,
  error: null,
  ...over,
});

describe("buildCapstoneView", () => {
  it("shows the 11 stage branches as rows, in order, without main", () => {
    const v = buildCapstoneView([]);
    expect(v.branches.map((b) => b.branch)).toEqual([
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
    ]);
    expect(v.branches.every((b) => b.ciStatus === "not_checked" && b.lastRunAt === null)).toBe(true);
    expect(v.main.branch).toBe("main");
  });

  it("carries each branch's status, last run and error", () => {
    const v = buildCapstoneView([check("rerank", { ci_status: "failure" }), check("eval", { ci_status: "error", error: "bad zip" })]);
    expect(v.branches.find((b) => b.branch === "rerank")).toMatchObject({ ciStatus: "failure", lastRunAt: "2026-10-14T10:00:00Z" });
    expect(v.branches.find((b) => b.branch === "eval")).toMatchObject({ ciStatus: "error", error: "bad zip" });
  });

  it("drives the six checkboxes from main only", () => {
    const v = buildCapstoneView([
      check("rerank", { criteria_met: ["recall", "citation", "isolation", "nightly", "kill_switch"] }),
      check("main", { criteria_met: ["recall", "isolation", "nightly", "kill_switch"], results }),
    ]);
    expect(v.criteria.map((c) => [c.key, c.met])).toEqual([
      ["recall", true],
      ["citation", false],
      ["isolation", true],
      ["nightly", true],
      ["kill_switch", true],
      ["defence", false],
    ]);
    expect(v.metCount).toBe(4);
    expect(v.allMet).toBe(false);
    expect(v.criteria.find((c) => c.key === "citation")?.measured).toBe("0.90");
    expect(v.criteria.find((c) => c.key === "isolation")?.measured).toBe("0 leaks · 150 users");
    expect(v.criteria.find((c) => c.key === "defence")?.measured).toBeNull();
  });

  it("is passed only when all six, including defence, are met on main", () => {
    const five = ["recall", "citation", "isolation", "nightly", "kill_switch"];
    expect(buildCapstoneView([check("main", { criteria_met: five })]).allMet).toBe(false);
    expect(buildCapstoneView([check("main", { criteria_met: [...five, "defence"] })]).allMet).toBe(true);
  });
});

describe("relativeTime", () => {
  const now = new Date("2026-10-14T12:00:00Z");
  it.each([
    ["2026-10-14T11:59:30Z", "just now"],
    ["2026-10-14T11:45:00Z", "15 min ago"],
    ["2026-10-14T09:00:00Z", "3 h ago"],
    ["2026-10-10T12:00:00Z", "4 days ago"],
  ])("%s → %s", (iso, expected) => expect(relativeTime(iso, now)).toBe(expected));
});
