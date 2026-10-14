import { describe, expect, it, vi } from "vitest";
import { strToU8, unzipSync, zipSync } from "fflate";
import {
  handlePollRequest,
  makeUnzipOne,
  pollAll,
  pollLearner,
  type GithubApi,
  type PollDeps,
  type StoredCheck,
} from "@/supabase/functions/_shared/poll-ci";
import { CAPSTONE_BRANCHES, type EvalResults } from "@/supabase/functions/_shared/capstone";

const REPO = "octocat/rag-capstone";
const now = new Date("2026-10-14T12:00:00Z");
const unzip = makeUnzipOne(unzipSync);

const results = (branch: string, over: Partial<EvalResults> = {}): EvalResults => ({
  branch,
  recall_at_3: 0.9,
  citation_accuracy: 0.97,
  cross_tenant_leaks: 0,
  concurrent_users_tested: 150,
  nightly_runs: 4,
  kill_switch_tested: true,
  ...over,
});

const zipOf = (files: Record<string, string>) => zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));

type RunSpec = { id: number; branch: string; status?: string; conclusion?: string | null };
const run = ({ id, branch, status = "completed", conclusion = "success" }: RunSpec) => ({
  id,
  head_branch: branch,
  head_sha: `sha${id}`,
  status,
  conclusion,
  html_url: `https://github.com/${REPO}/actions/runs/${id}`,
  run_started_at: `2026-10-14T1${id % 10}:00:00Z`,
  created_at: "2026-10-14T09:00:00Z",
});

/**
 * Fake GitHub. `runs` is the newest-first list for eval.yml; `zips` maps run id
 * → artifact zip (or override props). Records every request path.
 */
function fakeGithub(opts: {
  runs?: ReturnType<typeof run>[];
  listStatus?: number;
  zips?: Record<number, Uint8Array | { expired?: boolean; size?: number; zip?: Uint8Array; name?: string }>;
  downloadStatus?: number;
}) {
  const calls: string[] = [];
  const gh: GithubApi = {
    async get(path) {
      calls.push(path);
      const branchQ = /[?&]branch=([^&]+)/.exec(path);
      if (path.includes("/workflows/eval.yml/runs")) {
        if (opts.listStatus && opts.listStatus !== 200) return { status: opts.listStatus, body: { message: "x" } };
        const all = opts.runs ?? [];
        const runs = branchQ ? all.filter((r) => r.head_branch === decodeURIComponent(branchQ[1])).slice(0, 1) : all;
        return { status: 200, body: { total_count: runs.length, workflow_runs: runs } };
      }
      const art = /\/actions\/runs\/(\d+)\/artifacts/.exec(path);
      if (art) {
        const z = opts.zips?.[Number(art[1])];
        if (!z) return { status: 200, body: { artifacts: [] } };
        const spec = z instanceof Uint8Array ? { zip: z } : z;
        return {
          status: 200,
          body: {
            artifacts: [
              {
                id: Number(art[1]) * 10,
                name: spec.name ?? "eval-results",
                expired: spec.expired ?? false,
                size_in_bytes: spec.size ?? spec.zip?.length ?? 100,
                archive_download_url: `https://api.github.com/download/${art[1]}`,
              },
            ],
          },
        };
      }
      return { status: 404, body: null };
    },
    async download(url) {
      calls.push(url);
      if (opts.downloadStatus) return { status: opts.downloadStatus, bytes: new Uint8Array() };
      const id = Number(url.split("/").pop());
      const z = opts.zips?.[id];
      return { status: 200, bytes: z instanceof Uint8Array ? z : (z?.zip ?? new Uint8Array()) };
    },
  };
  return { gh, calls };
}

const poll = (gh: GithubApi, stored: StoredCheck[] = []) => pollLearner({ userId: "u1", repo: REPO, gh, unzip, stored, now });
const rowFor = (rows: { check_key: string }[], b: string) => rows.find((r) => r.check_key === b)! as Awaited<ReturnType<typeof poll>>["rows"][number];

describe("pollLearner", () => {
  it("returns one row per branch, and marks branches without runs", async () => {
    const { gh, calls } = fakeGithub({ runs: [] });
    const { rows } = await poll(gh);
    expect(rows.map((r) => r.check_key)).toEqual([...CAPSTONE_BRANCHES]);
    expect(rows.every((r) => r.ci_status === "no_runs" && r.criteria_met.length === 0)).toBe(true);
    // One list call plus a per-branch fallback for each missing branch.
    expect(calls.filter((c) => c.includes("branch="))).toHaveLength(12);
  });

  it("downloads eval-results on success and evaluates the criteria", async () => {
    const { gh, calls } = fakeGithub({
      runs: [run({ id: 7, branch: "main" })],
      zips: { 7: zipOf({ "results.json": JSON.stringify(results("main")) }) },
    });
    const { rows, downloads } = await poll(gh);
    const main = rowFor(rows, "main");
    expect(downloads).toBe(1);
    expect(main).toMatchObject({
      user_id: "u1",
      ci_status: "success",
      run_id: 7,
      results_run_id: 7,
      last_run_at: "2026-10-14T17:00:00Z",
      run_url: `https://github.com/${REPO}/actions/runs/7`,
      criteria_met: ["recall", "citation", "isolation", "nightly", "kill_switch"],
      error: null,
    });
    expect(calls).toContain(`/repos/${REPO}/actions/runs/7/artifacts?name=eval-results&per_page=10`);
  });

  it("uses only the latest run per branch", async () => {
    const { gh } = fakeGithub({
      runs: [run({ id: 9, branch: "main", conclusion: "failure" }), run({ id: 8, branch: "main" })],
      zips: { 8: zipOf({ "results.json": JSON.stringify(results("main")) }) },
    });
    const main = rowFor((await poll(gh)).rows, "main");
    expect(main).toMatchObject({ ci_status: "failure", run_id: 9, criteria_met: [] });
  });

  it("doesn't re-download a run it already evaluated", async () => {
    const { gh, calls } = fakeGithub({ runs: [run({ id: 7, branch: "main" })] });
    const stored: StoredCheck[] = [
      { check_key: "main", criteria_met: ["recall", "defence"], results: results("main"), results_run_id: 7, error: null },
    ];
    const { rows, downloads } = await poll(gh, stored);
    expect(downloads).toBe(0);
    expect(calls.some((c) => c.includes("/artifacts"))).toBe(false);
    expect(rowFor(rows, "main")).toMatchObject({ ci_status: "success", criteria_met: ["recall", "defence"] });
  });

  it("keeps the last criteria while a new run is in progress, then evaluates it when done", async () => {
    const stored: StoredCheck[] = [{ check_key: "main", criteria_met: ["recall", "citation"], results: results("main"), results_run_id: 7, error: null }];
    const running = fakeGithub({ runs: [run({ id: 8, branch: "main", status: "in_progress", conclusion: null })] });
    const during = rowFor((await poll(running.gh, stored)).rows, "main");
    expect(during).toMatchObject({ ci_status: "in_progress", run_id: 8, results_run_id: 7, criteria_met: ["recall", "citation"] });

    const done = fakeGithub({
      runs: [run({ id: 8, branch: "main" })],
      zips: { 8: zipOf({ "results.json": JSON.stringify(results("main", { recall_at_3: 0.5 })) }) },
    });
    const after = rowFor((await poll(done.gh, [{ ...stored[0], results_run_id: during.results_run_id }])).rows, "main");
    expect(after).toMatchObject({ ci_status: "success", results_run_id: 8 });
    expect(after.criteria_met).not.toContain("recall");
  });

  it("clears automatic criteria on failure but keeps the reviewer's defence", async () => {
    const { gh } = fakeGithub({ runs: [run({ id: 9, branch: "main", conclusion: "failure" })] });
    const stored: StoredCheck[] = [
      { check_key: "main", criteria_met: ["recall", "citation", "isolation", "nightly", "kill_switch", "defence"], results: results("main"), results_run_id: 8, error: null },
    ];
    expect(rowFor((await poll(gh, stored)).rows, "main")).toMatchObject({ ci_status: "failure", criteria_met: ["defence"], results: null });
  });

  it("finds a branch whose last run is older than the latest 100", async () => {
    const recent = Array.from({ length: 100 }, (_, i) => run({ id: 1000 + i, branch: "rerank" }));
    const old = run({ id: 5, branch: "naive-rag", conclusion: "failure" });
    const { gh, calls } = fakeGithub({ runs: [...recent, old] });
    // The list endpoint returns everything here; emulate per_page=100 by trimming.
    const listOnly = { ...gh, get: async (p: string) => (p.includes("per_page=100") ? { status: 200, body: { workflow_runs: recent } } : gh.get(p)) };
    const { rows } = await poll(listOnly as GithubApi, [
      { check_key: "rerank", criteria_met: [], results: results("rerank"), results_run_id: 1000, error: null },
    ]);
    expect(rowFor(rows, "naive-rag")).toMatchObject({ ci_status: "failure", run_id: 5 });
    expect(calls.some((c) => c.includes("branch=naive-rag"))).toBe(true);
  });

  describe("bad artifacts become an error on that branch", () => {
    const cases: [string, Parameters<typeof fakeGithub>[0], RegExp][] = [
      ["no artifact", { runs: [run({ id: 7, branch: "main" })], zips: {} }, /didn't upload an eval-results artifact/],
      ["expired", { runs: [run({ id: 7, branch: "main" })], zips: { 7: { expired: true, zip: zipOf({}) } } }, /expired/],
      ["too large", { runs: [run({ id: 7, branch: "main" })], zips: { 7: { size: 5_000_000, zip: zipOf({}) } } }, /too large/],
      ["not a zip", { runs: [run({ id: 7, branch: "main" })], zips: { 7: strToU8("not a zip") } }, /valid zip/],
      ["missing results.json", { runs: [run({ id: 7, branch: "main" })], zips: { 7: zipOf({ "other.json": "{}" }) } }, /doesn't contain results.json/],
      ["invalid JSON", { runs: [run({ id: 7, branch: "main" })], zips: { 7: zipOf({ "results.json": "{nope" }) } }, /isn't valid JSON/],
      [
        "invalid fields",
        { runs: [run({ id: 7, branch: "main" })], zips: { 7: zipOf({ "results.json": JSON.stringify({ ...results("main"), recall_at_3: "high" }) }) } },
        /recall_at_3 must be a number/,
      ],
      [
        "results from another branch",
        { runs: [run({ id: 7, branch: "main" })], zips: { 7: zipOf({ "results.json": JSON.stringify(results("rerank")) }) } },
        /says branch "rerank" but the run is on "main"/,
      ],
    ];
    it.each(cases)("%s", async (_label, gh, message) => {
      const stored: StoredCheck[] = [{ check_key: "main", criteria_met: ["recall", "defence"], results: null, results_run_id: 3, error: null }];
      const main = rowFor((await poll(fakeGithub(gh).gh, stored)).rows, "main");
      expect(main.ci_status).toBe("error");
      expect(main.error).toMatch(message);
      expect(main.criteria_met).toEqual(["defence"]);
      expect(main.results_run_id).toBe(7); // not retried every poll
    });
  });

  it("refuses to decompress oversized files inside the zip", async () => {
    const huge = "x".repeat(2_000_000);
    const zip = zipOf({ "results.json": huge });
    expect(unzip(zip, "results.json", 1_000_000)).toBeNull();
    expect(zip.length).toBeLessThan(1_000_000); // compresses small, so the size_in_bytes check alone wouldn't catch it
  });

  it("finds results.json inside a folder in the zip", async () => {
    const zip = zipOf({ "eval/results.json": "{}" });
    expect(unzip(zip, "results.json", 1000)).not.toBeNull();
  });

  it("marks every branch as an error when the repo or workflow is missing", async () => {
    const { gh } = fakeGithub({ listStatus: 404 });
    const { rows } = await poll(gh, [{ check_key: "main", criteria_met: ["recall", "defence"], results: null, results_run_id: null, error: null }]);
    expect(rows.every((r) => r.ci_status === "error" && /Couldn't find .github\/workflows\/eval.yml/.test(r.error!))).toBe(true);
    expect(rowFor(rows, "main").criteria_met).toEqual(["defence"]);
  });

  it.each([403, 429, 502])("throws a transient error (writes nothing) on HTTP %i", async (status) => {
    const { gh } = fakeGithub({ listStatus: status });
    await expect(poll(gh)).rejects.toThrow(`HTTP ${status}`);
  });

  it("retries next poll when the artifact download fails transiently", async () => {
    const { gh } = fakeGithub({ runs: [run({ id: 7, branch: "main" })], zips: { 7: zipOf({ "results.json": "{}" }) }, downloadStatus: 503 });
    await expect(poll(gh)).rejects.toThrow(/HTTP 503/);
  });
});

describe("pollAll", () => {
  function deps(over: Partial<PollDeps> = {}): PollDeps & { upserts: unknown[][]; logs: string[] } {
    const upserts: unknown[][] = [];
    const logs: string[] = [];
    return {
      secret: "s",
      gh: fakeGithub({ runs: [] }).gh,
      unzip,
      listLearners: async () => [
        { user_id: "u1", github_repo: "a/one" },
        { user_id: "u2", github_repo: "b/two" },
      ],
      getStored: async () => [],
      upsert: async (rows) => void upserts.push(rows),
      now: () => now,
      log: (m) => void logs.push(m),
      upserts,
      logs,
      ...over,
    };
  }

  it("polls and upserts every learner", async () => {
    const d = deps();
    expect(await pollAll(d)).toEqual({ learners: 2, updated: 2, downloads: 0, skipped: 0, errors: 0 });
    expect(d.upserts).toHaveLength(2);
    expect(d.upserts[0]).toHaveLength(12);
  });

  it("stops the pass when rate limited, without writing", async () => {
    const d = deps({ gh: fakeGithub({ listStatus: 403 }).gh });
    expect(await pollAll(d)).toMatchObject({ updated: 0, skipped: 1 });
    expect(d.upserts).toHaveLength(0);
  });

  it("carries on past one learner's failure", async () => {
    let n = 0;
    const d = deps({ getStored: async () => (n++ === 0 ? Promise.reject(new Error("db blip")) : []) });
    expect(await pollAll(d)).toMatchObject({ updated: 1, errors: 1 });
    expect(d.logs[0]).toMatch(/failed a\/one: db blip/);
  });
});

describe("handlePollRequest", () => {
  const base: PollDeps = {
    secret: "s3cret",
    gh: fakeGithub({ runs: [] }).gh,
    unzip,
    listLearners: async () => [],
    getStored: async () => [],
    upsert: async () => {},
  };
  const req = (auth?: string, method = "POST") => new Request("http://x/poll-ci", { method, headers: auth ? { authorization: auth } : {} });

  it("requires POST and the shared secret", async () => {
    expect((await handlePollRequest(req("Bearer s3cret", "GET"), base)).status).toBe(405);
    expect((await handlePollRequest(req(), base)).status).toBe(401);
    expect((await handlePollRequest(req("Bearer nope!"), base)).status).toBe(401);
    expect((await handlePollRequest(req("Bearer "), { ...base, secret: "" })).status).toBe(401);
    expect((await handlePollRequest(req("Bearer undefined"), { ...base, secret: undefined })).status).toBe(401);
  });

  it("runs the poll and returns the summary", async () => {
    const res = await handlePollRequest(req("Bearer s3cret"), base);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ learners: 0, updated: 0, downloads: 0, skipped: 0, errors: 0 });
  });

  it("hides internal errors", async () => {
    const log = vi.fn();
    const res = await handlePollRequest(req("Bearer s3cret"), { ...base, log, listLearners: async () => Promise.reject(new Error("profiles: boom")) });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "poll failed" });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("profiles: boom"));
  });
});
