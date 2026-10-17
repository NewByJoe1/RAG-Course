import type { GlossaryTerm } from "../glossary";

// Glossary terms first needed by Module 5. Shared terms live in content/glossary.ts.
export const terms: GlossaryTerm[] = [
  {
    id: "anchoring",
    term: "Anchoring",
    aliases: ["anchoring"],
    definition: "A language model leaning hardest on what it reads first, so the first clauses in the prompt shape the answer most.",
    stage: "re-rank",
  },
  {
    id: "bi-encoder",
    term: "Bi-encoder",
    aliases: ["bi-encoder"],
    definition: "A fast model that turns the question and each clause into numbers separately, then compares them. Embedding search uses one.",
    stage: "hybrid-retrieval",
  },
  {
    id: "latency-budget",
    term: "Latency budget",
    aliases: ["latency budget"],
    definition: "The most time you allow for one answer, such as 2 seconds, shared out between the pipeline's stages.",
    stage: null,
  },
];
