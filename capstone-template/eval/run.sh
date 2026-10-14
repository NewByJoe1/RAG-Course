#!/usr/bin/env bash
# Replace this with your real evaluation. It must write eval/metrics.json:
#
# {
#   "recall_at_3": 0.0,              // 0–1, on the course eval set
#   "citation_accuracy": 0.0,        // 0–1
#   "cross_tenant_leaks": 0,         // integer, from the isolation test
#   "concurrent_users_tested": 0,    // integer, users in the load test
#   "kill_switch_tested": false      // true once the kill-switch test passes
# }
#
# Until you do, this placeholder reports zeros so the pipeline runs end to end.
set -euo pipefail
cd "$(dirname "$0")"
echo "::warning::eval/run.sh is the template placeholder; reporting zero metrics."
cat > metrics.json <<'JSON'
{
  "recall_at_3": 0,
  "citation_accuracy": 0,
  "cross_tenant_leaks": 0,
  "concurrent_users_tested": 0,
  "kill_switch_tested": false
}
JSON
