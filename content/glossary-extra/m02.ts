import type { GlossaryTerm } from "../glossary";

// Glossary terms first needed by Module 2. Shared terms live in content/glossary.ts.
export const terms: GlossaryTerm[] = [
  {
    id: "tagging-prompt",
    term: "Tagging prompt",
    aliases: ["prompts/tag.md", "tagging prompt"],
    definition: "A plain text file of instructions asking a model to label a question simple, multi-clause or conflicting, in one word.",
    stage: "routing",
  },
  {
    id: "over-expansion",
    term: "Over-expansion",
    aliases: ["over-expansion"],
    definition: "Adding so many general words to a question that it matches almost every clause, so the right one gets buried.",
    stage: "pre-retrieval",
  },
];
