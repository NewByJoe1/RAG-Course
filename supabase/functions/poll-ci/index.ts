// poll-ci: every 15 minutes (pg_cron, see migration 0005) check each learner's
// capstone repo on GitHub and record CI status + criteria in capstone_checks.
//
// Secrets (supabase secrets set …):
//   GITHUB_TOKEN    fine-grained token, public repos read-only (artifact
//                   downloads need auth even for public repos; also lifts the
//                   API rate limit from 60 to 5,000 requests/hour)
//   POLL_CI_SECRET  bearer token pg_cron sends; must match the vault secret
// Provided by Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { unzipSync } from "npm:fflate@0.8.3";
import { handlePollRequest, makeUnzipOne, type CheckRow, type GithubApi, type StoredCheck } from "../_shared/poll-ci.ts";

const env = (k: string) => Deno.env.get(k);

const supabase = createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ghHeaders = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "rag-course-poll-ci",
  ...(env("GITHUB_TOKEN") ? { Authorization: `Bearer ${env("GITHUB_TOKEN")}` } : {}),
};

const gh: GithubApi = {
  async get(path) {
    const res = await fetch(`https://api.github.com${path}`, { headers: ghHeaders });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  },
  async download(url) {
    // GitHub answers with a 302 to a pre-signed blob URL; fetch follows it and
    // drops the Authorization header on the cross-origin hop.
    const res = await fetch(url, { headers: ghHeaders, redirect: "follow" });
    return { status: res.status, bytes: new Uint8Array(await res.arrayBuffer()) };
  },
};

Deno.serve((req) =>
  handlePollRequest(req, {
    secret: env("POLL_CI_SECRET"),
    gh,
    unzip: makeUnzipOne(unzipSync),
    log: console.log,
    async listLearners() {
      const { data, error } = await supabase.from("profiles").select("id, github_repo").not("github_repo", "is", null);
      if (error) throw new Error(`profiles: ${error.message}`);
      return (data ?? []).map((p) => ({ user_id: p.id as string, github_repo: p.github_repo as string }));
    },
    async getStored(userId) {
      const { data, error } = await supabase
        .from("capstone_checks")
        .select("check_key, criteria_met, results, results_run_id, error")
        .eq("user_id", userId);
      if (error) throw new Error(`capstone_checks: ${error.message}`);
      return (data ?? []) as StoredCheck[];
    },
    async upsert(rows: CheckRow[]) {
      const { error } = await supabase.from("capstone_checks").upsert(rows, { onConflict: "user_id,check_key" });
      if (error) throw new Error(`upsert capstone_checks: ${error.message}`);
    },
  }),
);
