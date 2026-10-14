import { describe, expect, it } from "vitest";
import {
  allCriteriaMet,
  CAPSTONE_BRANCHES,
  ciStatusFromRun,
  evaluateCriteria,
  mergeCriteria,
  normalizeGithubRepo,
  parseEvalResults,
  type EvalResults,
} from "@/supabase/functions/_shared/capstone";

const passing: EvalResults = {
  branch: "main",
  recall_at_3: 0.85,
  citation_accuracy: 0.95,
  cross_tenant_leaks: 0,
  concurrent_users_tested: 100,
  nightly_runs: 3,
  kill_switch_tested: true,
};

describe("branches", () => {
  it("checks the 12 spec branches, ending with main", () => {
    expect(CAPSTONE_BRANCHES).toHaveLength(12);
    expect(CAPSTONE_BRANCHES.at(-1)).toBe("main");
  });
});

describe("evaluateCriteria", () => {
  it("meets all five automatic criteria exactly at the thresholds", () => {
    expect(evaluateCriteria(passing)).toEqual(["recall", "citation", "isolation", "nightly", "kill_switch"]);
  });

  it("never awards defence", () => {
    expect(evaluateCriteria({ ...passing, recall_at_3: 1, citation_accuracy: 1, nightly_runs: 99 })).not.toContain("defence");
  });

  it.each([
    ["recall", { recall_at_3: 0.8499 }],
    ["citation", { citation_accuracy: 0.9499 }],
    ["nightly", { nightly_runs: 2 }],
    ["kill_switch", { kill_switch_tested: false }],
  ] as const)("misses %s just below its threshold", (criterion, change) => {
    const met = evaluateCriteria({ ...passing, ...change });
    expect(met).not.toContain(criterion);
    expect(met).toHaveLength(4);
  });

  it("isolation needs zero leaks AND at least 100 concurrent users", () => {
    expect(evaluateCriteria({ ...passing, cross_tenant_leaks: 1 })).not.toContain("isolation");
    expect(evaluateCriteria({ ...passing, concurrent_users_tested: 99 })).not.toContain("isolation");
    expect(evaluateCriteria({ ...passing, cross_tenant_leaks: 1, concurrent_users_tested: 500 })).not.toContain("isolation");
    expect(evaluateCriteria({ ...passing, concurrent_users_tested: 5000 })).toContain("isolation");
  });
});

describe("parseEvalResults", () => {
  it("accepts a valid results.json and drops unknown fields", () => {
    expect(parseEvalResults({ ...passing, extra: "ignored" })).toEqual({ ok: true, results: passing });
  });

  it.each([
    ["not an object", [1, 2]],
    ["missing branch", { ...passing, branch: "" }],
    ["recall as a string", { ...passing, recall_at_3: "0.9" }],
    ["recall above 1", { ...passing, recall_at_3: 1.2 }],
    ["NaN citation", { ...passing, citation_accuracy: Number.NaN }],
    ["fractional leaks", { ...passing, cross_tenant_leaks: 0.5 }],
    ["negative users", { ...passing, concurrent_users_tested: -1 }],
    ["kill switch as a string", { ...passing, kill_switch_tested: "true" }],
  ])("rejects %s", (_label, raw) => {
    expect(parseEvalResults(raw).ok).toBe(false);
  });

  it("lists every problem", () => {
    const r = parseEvalResults({ branch: "main" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.split("; ")).toHaveLength(6);
  });
});

describe("mergeCriteria", () => {
  it("keeps a reviewer's defence and nothing else from storage", () => {
    expect(mergeCriteria(["recall"], ["citation", "defence"])).toEqual(["recall", "defence"]);
    expect(mergeCriteria([], ["recall", "defence"])).toEqual(["defence"]);
    expect(mergeCriteria(["kill_switch", "recall"], null)).toEqual(["recall", "kill_switch"]);
  });
});

describe("allCriteriaMet", () => {
  it("needs all six including defence", () => {
    const five = evaluateCriteria(passing);
    expect(allCriteriaMet(five)).toBe(false);
    expect(allCriteriaMet([...five, "defence"])).toBe(true);
    expect(allCriteriaMet(null)).toBe(false);
  });
});

describe("ciStatusFromRun", () => {
  it.each([
    [{ status: "queued", conclusion: null }, "queued"],
    [{ status: "waiting", conclusion: null }, "queued"],
    [{ status: "in_progress", conclusion: null }, "in_progress"],
    [{ status: "completed", conclusion: "success" }, "success"],
    [{ status: "completed", conclusion: "failure" }, "failure"],
    [{ status: "completed", conclusion: "timed_out" }, "failure"],
    [{ status: "completed", conclusion: "cancelled" }, "cancelled"],
    [{ status: "completed", conclusion: "skipped" }, "cancelled"],
  ])("%j → %s", (run, expected) => expect(ciStatusFromRun(run)).toBe(expected));
});

describe("normalizeGithubRepo", () => {
  it.each([
    ["octocat/rag-capstone", "octocat/rag-capstone"],
    ["  octocat/rag.capstone_2 ", "octocat/rag.capstone_2"],
    ["https://github.com/octocat/rag-capstone", "octocat/rag-capstone"],
    ["https://github.com/octocat/rag-capstone.git", "octocat/rag-capstone"],
    ["github.com/octocat/x", null],
    ["octocat", null],
    ["octo cat/x", null],
    ["-octocat/x", null],
    ["octocat/..", null],
    ["https://gitlab.com/octocat/x", null],
    ["octocat/x/tree/main", null],
  ])("%s → %s", (input, expected) => expect(normalizeGithubRepo(input)).toBe(expected));
});
