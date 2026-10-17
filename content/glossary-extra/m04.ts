import type { GlossaryTerm } from "../glossary";

// Glossary terms first needed by Module 4. Shared terms live in content/glossary.ts.
export const terms: GlossaryTerm[] = [
  {
    id: "lost-in-the-middle",
    term: "Lost in the middle",
    aliases: ["lost in the middle"],
    definition: "Language models read the start and end of a long prompt most carefully and tend to miss what sits in the middle.",
    stage: "post-retrieval",
  },
  {
    id: "score-gap",
    term: "Score gap",
    aliases: ["score gap"],
    definition: "The sudden drop in a sorted list of search scores, where strong matches end and filler begins. A good place for the threshold.",
    stage: "post-retrieval",
  },
  {
    id: "trimming",
    term: "Trimming",
    aliases: ["trimming", "trimmer"],
    definition: "Cutting a clause down to the sentences that relate to the question, always at full stops, never changing a word.",
    stage: "post-retrieval",
  },
  {
    id: "compression-prompt",
    term: "Compression prompt",
    aliases: ["prompts/compress.md", "compression prompt"],
    definition: "A prompt file asking a small model to copy out, word for word, only the sentences of a clause that help answer the question.",
    stage: "post-retrieval",
  },
];
