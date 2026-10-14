import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildResults, countNightlyRuns } from "../../capstone-template/eval/write-results.mjs";
import { parseEvalResults, RESULTS_ARTIFACT_NAME } from "@/supabase/functions/_shared/capstone";

const metrics = { recall_at_3: 0.9, citation_accuracy: 0.96, cross_tenant_leaks: 0, concurrent_users_tested: 120, kill_switch_tested: true };

describe("template write-results.mjs", () => {
  it("produces a results.json the course poller accepts", () => {
    const out = buildResults(metrics, { branch: "main", nightlyRuns: 3 });
    expect(parseEvalResults(out)).toEqual({ ok: true, results: { ...metrics, branch: "main", nightly_runs: 3 } });
  });

  it("rejects incomplete or mistyped metrics", () => {
    const { recall_at_3: _drop, ...missing } = metrics;
    expect(() => buildResults(missing, { branch: "main", nightlyRuns: 0 })).toThrow(/missing: recall_at_3/);
    expect(() => buildResults({ ...metrics, citation_accuracy: "0.9" }, { branch: "main", nightlyRuns: 0 })).toThrow(/citation_accuracy must be a number/);
    expect(() => buildResults({ ...metrics, kill_switch_tested: "yes" }, { branch: "main", nightlyRuns: 0 })).toThrow(/kill_switch_tested/);
  });

  it("counts successful scheduled runs on the branch over the last 30 days", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ total_count: 4, workflow_runs: [] })));
    const n = await countNightlyRuns({ repo: "o/r", branch: "main", token: "t", now: new Date("2026-10-14T00:00:00Z"), fetchImpl });
    expect(n).toBe(4);
    const url = new URL((fetchImpl.mock.calls[0] as unknown as [string])[0]);
    expect(url.pathname).toBe("/repos/o/r/actions/workflows/eval.yml/runs");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ event: "schedule", status: "success", branch: "main", created: ">=2026-09-14" });
  });

  it("workflow runs on every push and uploads the artifact the course polls", () => {
    const yml = readFileSync(path.join(__dirname, "../../capstone-template/.github/workflows/eval.yml"), "utf8");
    expect(yml).toMatch(/^on:\n  push:\n/m);
    expect(yml).toMatch(/schedule:/);
    expect(yml).toContain(`name: ${RESULTS_ARTIFACT_NAME}`);
    expect(yml).toContain("path: eval/results.json");
    expect(yml).toContain("actions: read");
  });
});
