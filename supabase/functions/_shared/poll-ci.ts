// Core of the poll-ci edge function, with GitHub, unzip and storage injected
// so it runs (and is tested) outside Deno.

import {
  CAPSTONE_BRANCHES,
  ciStatusFromRun,
  EVAL_WORKFLOW_FILE,
  evaluateCriteria,
  MAX_ARTIFACT_BYTES,
  mergeCriteria,
  parseEvalResults,
  RESULTS_ARTIFACT_NAME,
  RESULTS_FILE_NAME,
  type CiStatus,
  type Criterion,
  type EvalResults,
} from "./capstone.ts";

// --- Ports -------------------------------------------------------------------

export type GithubApi = {
  /** GET an api.github.com path. Resolves for any HTTP status; rejects on network errors. */
  get(path: string): Promise<{ status: number; body: unknown }>;
  /** Download an artifact archive (follows GitHub's redirect to blob storage). */
  download(url: string): Promise<{ status: number; bytes: Uint8Array }>;
};

/** Extract one file by basename, refusing anything larger than maxBytes uncompressed. */
export type UnzipOne = (zip: Uint8Array, fileName: string, maxBytes: number) => Uint8Array | null;

export type StoredCheck = {
  check_key: string;
  criteria_met: string[] | null;
  results: EvalResults | null;
  results_run_id: number | null;
  error: string | null;
};

export type CheckRow = {
  user_id: string;
  check_key: string;
  ci_status: CiStatus;
  last_run_at: string | null;
  run_id: number | null;
  run_url: string | null;
  head_sha: string | null;
  criteria_met: Criterion[];
  results: EvalResults | null;
  results_run_id: number | null;
  error: string | null;
  polled_at: string;
};

type Run = {
  id: number;
  head_branch: string | null;
  head_sha: string;
  status: string | null;
  conclusion: string | null;
  html_url: string;
  run_started_at?: string | null;
  created_at: string;
};

type Artifact = { id: number; name: string; size_in_bytes: number; expired: boolean; archive_download_url: string };

/** Thrown for problems worth retrying next poll (rate limits, 5xx, network). Nothing is written. */
export class TransientError extends Error {}

// --- Helpers -----------------------------------------------------------------

const runsPath = (repo: string, query: string) =>
  `/repos/${repo}/actions/workflows/${EVAL_WORKFLOW_FILE}/runs?${query}`;

function asRuns(body: unknown): Run[] {
  const runs = (body as { workflow_runs?: unknown })?.workflow_runs;
  return Array.isArray(runs) ? (runs as Run[]) : [];
}

function transientIfServer(status: number, what: string) {
  if (status === 403 || status === 429 || status >= 500) throw new TransientError(`${what}: HTTP ${status}`);
}

/** Wrap fflate's unzipSync (whichever runtime imported it) as an UnzipOne. */
export function makeUnzipOne(
  unzipSync: (data: Uint8Array, opts: { filter: (f: { name: string; originalSize: number }) => boolean }) => Record<string, Uint8Array>,
): UnzipOne {
  return (zip, fileName, maxBytes) => {
    const base = (n: string) => n.split("/").pop();
    const files = unzipSync(zip, { filter: (f) => base(f.name) === fileName && f.originalSize <= maxBytes });
    const entry = Object.entries(files).find(([n, data]) => base(n) === fileName && data.length <= maxBytes);
    return entry ? entry[1] : null;
  };
}

type ArtifactOutcome = { ok: true; results: EvalResults } | { ok: false; error: string };

async function fetchResults(gh: GithubApi, unzip: UnzipOne, repo: string, run: Run, branch: string): Promise<ArtifactOutcome> {
  const res = await gh.get(`/repos/${repo}/actions/runs/${run.id}/artifacts?name=${RESULTS_ARTIFACT_NAME}&per_page=10`);
  transientIfServer(res.status, `artifacts for run ${run.id}`);
  if (res.status !== 200) return { ok: false, error: `Couldn't list artifacts (HTTP ${res.status}).` };

  const artifacts = ((res.body as { artifacts?: Artifact[] })?.artifacts ?? []).filter((a) => a.name === RESULTS_ARTIFACT_NAME);
  const artifact = artifacts.find((a) => !a.expired);
  if (!artifact) {
    return { ok: false, error: artifacts.length ? "The eval-results artifact has expired." : "The run didn't upload an eval-results artifact." };
  }
  if (artifact.size_in_bytes > MAX_ARTIFACT_BYTES) return { ok: false, error: `eval-results is too large (${artifact.size_in_bytes} bytes).` };

  const dl = await gh.download(artifact.archive_download_url);
  transientIfServer(dl.status, `download artifact ${artifact.id}`);
  if (dl.status !== 200) return { ok: false, error: `Couldn't download eval-results (HTTP ${dl.status}).` };

  let file: Uint8Array | null;
  try {
    file = unzip(dl.bytes, RESULTS_FILE_NAME, MAX_ARTIFACT_BYTES);
  } catch {
    return { ok: false, error: "eval-results isn't a valid zip archive." };
  }
  if (!file) return { ok: false, error: `eval-results doesn't contain ${RESULTS_FILE_NAME}.` };

  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(file));
  } catch {
    return { ok: false, error: `${RESULTS_FILE_NAME} isn't valid JSON.` };
  }
  const parsed = parseEvalResults(json);
  if (!parsed.ok) return { ok: false, error: `${RESULTS_FILE_NAME}: ${parsed.error}` };
  if (parsed.results.branch !== branch) {
    return { ok: false, error: `${RESULTS_FILE_NAME} says branch "${parsed.results.branch}" but the run is on "${branch}".` };
  }
  return { ok: true, results: parsed.results };
}

// --- Per learner -------------------------------------------------------------

/**
 * Check every capstone branch of one learner's repo and return the rows to
 * upsert into capstone_checks. Rules:
 *  - success: download eval-results (once per run) and evaluate criteria
 *  - queued / in progress: keep the last evaluated criteria
 *  - failure / cancelled / no runs / bad artifact: automatic criteria cleared
 *  - reviewer-set criteria ('defence') are always kept
 * Throws TransientError (write nothing) on rate limits and GitHub outages.
 */
export async function pollLearner(opts: {
  userId: string;
  repo: string;
  gh: GithubApi;
  unzip: UnzipOne;
  stored: StoredCheck[];
  now: Date;
}): Promise<{ rows: CheckRow[]; downloads: number }> {
  const { userId, repo, gh, unzip, now } = opts;
  const storedBy = new Map(opts.stored.map((s) => [s.check_key, s]));
  const polledAt = now.toISOString();
  let downloads = 0;

  const list = await gh.get(runsPath(repo, "per_page=100"));
  transientIfServer(list.status, `list runs for ${repo}`);

  const base = (branch: string) => ({ user_id: userId, check_key: branch, polled_at: polledAt });
  const cleared = (branch: string) => mergeCriteria([], storedBy.get(branch)?.criteria_met);

  if (list.status !== 200) {
    const error =
      list.status === 404
        ? `Couldn't find .github/workflows/${EVAL_WORKFLOW_FILE} in ${repo}. Is the repo public and forked from the template?`
        : `GitHub returned HTTP ${list.status} for ${repo}.`;
    return {
      downloads,
      rows: CAPSTONE_BRANCHES.map((b) => ({
        ...base(b),
        ci_status: "error" as const,
        last_run_at: null,
        run_id: null,
        run_url: null,
        head_sha: null,
        criteria_met: cleared(b),
        results: null,
        results_run_id: null,
        error,
      })),
    };
  }

  // Runs come newest first; the first one seen per branch is its latest.
  const latest = new Map<string, Run>();
  for (const run of asRuns(list.body)) {
    if (run.head_branch && !latest.has(run.head_branch)) latest.set(run.head_branch, run);
  }

  const rows: CheckRow[] = [];
  for (const branch of CAPSTONE_BRANCHES) {
    let run = latest.get(branch);
    if (!run) {
      // Older than the last 100 runs, or never run: ask for this branch directly.
      const one = await gh.get(runsPath(repo, `branch=${encodeURIComponent(branch)}&per_page=1`));
      transientIfServer(one.status, `list runs for ${repo}@${branch}`);
      run = one.status === 200 ? asRuns(one.body)[0] : undefined;
    }

    const stored = storedBy.get(branch);
    if (!run) {
      rows.push({
        ...base(branch),
        ci_status: "no_runs",
        last_run_at: null,
        run_id: null,
        run_url: null,
        head_sha: null,
        criteria_met: cleared(branch),
        results: null,
        results_run_id: null,
        error: null,
      });
      continue;
    }

    const runInfo = {
      last_run_at: run.run_started_at ?? run.created_at,
      run_id: run.id,
      run_url: run.html_url,
      head_sha: run.head_sha,
    };
    const status = ciStatusFromRun(run);

    if (status === "queued" || status === "in_progress") {
      rows.push({
        ...base(branch),
        ...runInfo,
        ci_status: status,
        criteria_met: mergeCriteria((stored?.criteria_met ?? []) as Criterion[], stored?.criteria_met),
        results: stored?.results ?? null,
        results_run_id: stored?.results_run_id ?? null,
        error: stored?.error ?? null,
      });
      continue;
    }

    if (status !== "success") {
      rows.push({ ...base(branch), ...runInfo, ci_status: status, criteria_met: cleared(branch), results: null, results_run_id: null, error: null });
      continue;
    }

    // Already evaluated this run: keep what we have, don't re-download.
    if (stored && stored.results_run_id === run.id) {
      rows.push({
        ...base(branch),
        ...runInfo,
        ci_status: stored.results ? "success" : "error",
        criteria_met: mergeCriteria((stored.criteria_met ?? []) as Criterion[], stored.criteria_met),
        results: stored.results,
        results_run_id: run.id,
        error: stored.error,
      });
      continue;
    }

    downloads++;
    const outcome = await fetchResults(gh, unzip, repo, run, branch);
    rows.push(
      outcome.ok
        ? {
            ...base(branch),
            ...runInfo,
            ci_status: "success",
            criteria_met: mergeCriteria(evaluateCriteria(outcome.results), stored?.criteria_met),
            results: outcome.results,
            results_run_id: run.id,
            error: null,
          }
        : {
            ...base(branch),
            ...runInfo,
            ci_status: "error",
            criteria_met: cleared(branch),
            results: null,
            results_run_id: run.id, // a bad artifact won't fix itself; don't re-download every poll
            error: outcome.error,
          },
    );
  }

  return { rows, downloads };
}

// --- All learners + HTTP entry -------------------------------------------------

export type PollDeps = {
  secret: string | undefined;
  gh: GithubApi;
  unzip: UnzipOne;
  listLearners(): Promise<{ user_id: string; github_repo: string }[]>;
  getStored(userId: string): Promise<StoredCheck[]>;
  upsert(rows: CheckRow[]): Promise<void>;
  now?: () => Date;
  log?: (msg: string) => void;
};

export type PollSummary = { learners: number; updated: number; downloads: number; skipped: number; errors: number };

export async function pollAll(deps: PollDeps): Promise<PollSummary> {
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? (() => {});
  const learners = await deps.listLearners();
  const summary: PollSummary = { learners: learners.length, updated: 0, downloads: 0, skipped: 0, errors: 0 };

  for (const l of learners) {
    try {
      const stored = await deps.getStored(l.user_id);
      const { rows, downloads } = await pollLearner({ userId: l.user_id, repo: l.github_repo, gh: deps.gh, unzip: deps.unzip, stored, now: now() });
      await deps.upsert(rows);
      summary.updated++;
      summary.downloads += downloads;
    } catch (err) {
      if (err instanceof TransientError) {
        summary.skipped++;
        log(`[poll-ci] skipped ${l.github_repo}: ${err.message}`);
        if (/HTTP (403|429)/.test(err.message)) break; // rate limited: stop this pass
      } else {
        summary.errors++;
        log(`[poll-ci] failed ${l.github_repo}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  return summary;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** HTTP handler: POST with "Authorization: Bearer <POLL_CI_SECRET>". */
export async function handlePollRequest(req: Request, deps: PollDeps): Promise<Response> {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!deps.secret || !safeEqual(req.headers.get("authorization") ?? "", `Bearer ${deps.secret}`)) {
    return json({ error: "unauthorized" }, 401);
  }
  try {
    return json(await pollAll(deps));
  } catch (err) {
    (deps.log ?? (() => {}))(`[poll-ci] run failed: ${err instanceof Error ? err.message : String(err)}`);
    return json({ error: "poll failed" }, 500);
  }
}
