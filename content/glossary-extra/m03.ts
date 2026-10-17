import type { GlossaryTerm } from "../glossary";

// Glossary terms first needed by Module 3. Shared terms live in content/glossary.ts.
export const terms: GlossaryTerm[] = [
  {
    id: "stemming",
    term: "Stemming",
    aliases: ["stemming"],
    definition: "Cutting each word back to its root before a keyword search, so \"contractors\" and \"contractor\" count as the same word.",
    stage: "hybrid-retrieval",
  },
  {
    id: "vector-store",
    term: "Vector store",
    aliases: ["vector store", "vector stores"],
    definition: "A database built to hold embeddings and quickly find the ones closest to a question's. Chroma and pgvector are two examples.",
    stage: "hybrid-retrieval",
  },
];
