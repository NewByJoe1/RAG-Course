import type { GlossaryTerm } from "../glossary";

// Glossary terms first needed by Module 7. Shared terms live in content/glossary.ts.
export const terms: GlossaryTerm[] = [
  {
    id: "eval-script",
    term: "Eval script",
    aliases: ["evaluate.py", "eval script"],
    definition: "The small program that runs every golden-set question through the pipeline and scores the results. Ours is evaluate.py.",
    stage: "eval-guardrails",
  },
  {
    id: "gold-clause",
    term: "Gold clause",
    aliases: ["gold clause", "gold clauses"],
    definition: "A clause that a golden-set row says must be found for its question, because the answer depends on it.",
    stage: "eval-guardrails",
  },
  {
    id: "answer-check",
    term: "Answer check",
    aliases: ["answer check", "answer checks", "answer correctness"],
    definition: "Comparing an answer with the correct answer written in its golden-set row. Usually graded by a judge model.",
    stage: "eval-guardrails",
  },
  {
    id: "metric",
    term: "Metric",
    aliases: ["metric", "metrics"],
    definition: "A number that measures one thing about the system, like recall@3 or groundedness.",
    stage: "eval-guardrails",
  },
  {
    id: "baseline",
    term: "Baseline",
    aliases: ["baseline"],
    definition: "The scores you record before a change, so you can see exactly what the change made better or worse.",
    stage: "eval-guardrails",
  },
];
