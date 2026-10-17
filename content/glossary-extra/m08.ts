import type { GlossaryTerm } from "../glossary";

// Glossary terms first needed by Module 8. Shared terms live in content/glossary.ts.
export const terms: GlossaryTerm[] = [
  {
    id: "silent-degradation",
    term: "Silent degradation",
    aliases: ["silent degradation"],
    definition: "When a system quietly gets worse with no error message, so nobody notices until someone acts on a wrong answer.",
    stage: "eval-guardrails",
  },
  {
    id: "scheduled-job",
    term: "Scheduled job",
    aliases: ["scheduled job", "scheduled jobs", "nightly job", "nightly run", "nightly runs", "scheduler"],
    definition: "A task the computer starts by itself at set times, such as every night at 3:17, so nobody has to remember to run it.",
    stage: "eval-guardrails",
  },
  {
    id: "cron",
    term: "Cron schedule",
    aliases: ["cron", "cron schedule"],
    definition: "A short five-part code that says when a job runs. \"17 3 * * *\" means minute 17 of hour 3, every day.",
    stage: "eval-guardrails",
  },
  {
    id: "github-actions",
    term: "GitHub Actions",
    aliases: ["GitHub Actions", "Actions tab"],
    definition: "GitHub's built-in runner. It reads your workflow file, starts a fresh computer, runs your checks and shows pass or fail.",
    stage: "eval-guardrails",
  },
  {
    id: "workflow-file",
    term: "Workflow file",
    aliases: [".github/workflows/eval.yml", "eval.yml", "workflow file", "workflow files", "workflow", "workflows"],
    definition: "A plain text file in your project that tells GitHub which checks to run and when. Ours runs the eval on every change and every night.",
    stage: "eval-guardrails",
  },
  {
    id: "cost-per-query",
    term: "Cost per query",
    aliases: ["cost per query", "cost per answer"],
    definition: "What one answer costs to produce, mostly the model's fee for the tokens it reads and writes.",
    stage: "eval-guardrails",
  },
  {
    id: "cost-creep",
    term: "Cost creep",
    aliases: ["cost creep"],
    definition: "When each answer slowly costs more, a few extra tokens here and there, until the monthly bill is a nasty surprise.",
    stage: "eval-guardrails",
  },
  {
    id: "p95-latency",
    term: "p95 latency",
    aliases: ["p95 latency", "p95"],
    definition: "The wait that 95 out of every 100 answers beat. It shows how slow the slow answers are, which an average hides.",
    stage: "eval-guardrails",
  },
  {
    id: "heartbeat-alert",
    term: "Heartbeat alert",
    aliases: ["heartbeat alert", "heartbeat"],
    definition: "An alert that fires when an expected run doesn't happen, so a job that quietly stopped can't hide behind silence.",
    stage: "eval-guardrails",
  },
  {
    id: "alert-fatigue",
    term: "Alert fatigue",
    aliases: ["alert fatigue"],
    definition: "When alerts fire so often over nothing that people mute them, and then miss the one that mattered.",
    stage: "eval-guardrails",
  },
  {
    id: "roll-back",
    term: "Roll back",
    aliases: ["roll back", "rolled back", "rollback"],
    definition: "Put the last version that worked back live, quickly, while you work out what went wrong with the new one.",
    stage: null,
  },
  {
    id: "artifact",
    term: "Artifact",
    aliases: ["artifact", "artifacts"],
    definition: "A file a GitHub Actions run saves and keeps after it finishes. Ours is called eval-results and holds results.json, which the course reads.",
    stage: "eval-guardrails",
  },
];
