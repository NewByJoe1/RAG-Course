// Combine eval/metrics.json (from your pipeline) with CI facts into
// eval/results.json, the file the course reads. Run by eval.yml.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const METRIC_FIELDS = ["recall_at_3", "citation_accuracy", "cross_tenant_leaks", "concurrent_users_tested", "kill_switch_tested"];
const NIGHTLY_WINDOW_DAYS = 30;

/**
 * @param {Record<string, unknown>} metrics contents of eval/metrics.json
 * @param {{ branch: string, nightlyRuns: number }} ci
 */
export function buildResults(metrics, ci) {
  const missing = METRIC_FIELDS.filter((f) => !(f in metrics));
  if (missing.length) throw new Error(`eval/metrics.json is missing: ${missing.join(", ")}`);
  const num = (f) => {
    const v = metrics[f];
    if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`eval/metrics.json: ${f} must be a number`);
    return v;
  };
  if (typeof metrics.kill_switch_tested !== "boolean") throw new Error("eval/metrics.json: kill_switch_tested must be true or false");
  return {
    branch: ci.branch,
    recall_at_3: num("recall_at_3"),
    citation_accuracy: num("citation_accuracy"),
    cross_tenant_leaks: num("cross_tenant_leaks"),
    concurrent_users_tested: num("concurrent_users_tested"),
    nightly_runs: ci.nightlyRuns,
    kill_switch_tested: metrics.kill_switch_tested,
  };
}

/** Successful scheduled (nightly) runs of eval.yml on this branch in the last 30 days. */
export async function countNightlyRuns({ repo, branch, token, now = new Date(), fetchImpl = fetch }) {
  const since = new Date(now.getTime() - NIGHTLY_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  const q = new URLSearchParams({ event: "schedule", status: "success", branch, created: `>=${since}`, per_page: "1" });
  const res = await fetchImpl(`https://api.github.com/repos/${repo}/actions/workflows/eval.yml/runs?${q}`, {
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" },
  });
  if (!res.ok) throw new Error(`Couldn't count nightly runs: HTTP ${res.status}`);
  const body = await res.json();
  return Number(body.total_count ?? 0);
}

async function main() {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const { GITHUB_REF_NAME: branch, GITHUB_REPOSITORY: repo, GITHUB_TOKEN: token } = process.env;
  if (!branch || !repo || !token) throw new Error("Run this in GitHub Actions (needs GITHUB_REF_NAME, GITHUB_REPOSITORY, GITHUB_TOKEN).");

  const metrics = JSON.parse(await readFile(path.join(dir, "metrics.json"), "utf8"));
  const nightlyRuns = await countNightlyRuns({ repo, branch, token });
  const results = buildResults(metrics, { branch, nightlyRuns });
  await writeFile(path.join(dir, "results.json"), JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify(results, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`::error::${err.message}`);
    process.exit(1);
  });
}
