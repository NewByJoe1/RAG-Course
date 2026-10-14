# RAG Course capstone template

Fork this repo (keep it **public**), then enter `your-username/your-repo` on
the course's Capstone page. The course checks your CI every 15 minutes.

## Branches

Build each stage on its own branch. Every push runs `eval.yml`:

`naive-rag` · `pre-retrieval` · `hybrid-retrieval` · `post-retrieval` · `rerank` ·
`fine-tuned` · `eval` · `automation` · `harness` · `legal-domain` ·
`legal-embeddings` · `main`

## What CI must produce

`eval/run.sh` runs your evaluation and writes `eval/metrics.json`.
`eval/write-results.mjs` adds the branch and your nightly-run count and writes
`eval/results.json`, uploaded as the `eval-results` artifact:

```json
{
  "branch": "main",
  "recall_at_3": 0.91,
  "citation_accuracy": 0.97,
  "cross_tenant_leaks": 0,
  "concurrent_users_tested": 150,
  "nightly_runs": 4,
  "kill_switch_tested": true
}
```

## Passing the capstone

Measured on `main`:

| Criterion | Requirement |
| --- | --- |
| Recall | `recall_at_3` ≥ 0.85 |
| Citation | `citation_accuracy` ≥ 0.95 |
| Isolation | `cross_tenant_leaks` = 0 and `concurrent_users_tested` ≥ 100 |
| Nightly | `nightly_runs` ≥ 3 (successful scheduled runs, last 30 days) |
| Kill switch | `kill_switch_tested` is `true` |
| Defence | Signed off by a reviewer |
