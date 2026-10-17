import type { GlossaryTerm } from "../glossary";

// Glossary terms first needed by Module 11. Shared terms live in content/glossary.ts.
export const terms: GlossaryTerm[] = [
  {
    id: "cuad",
    term: "CUAD (Contract Understanding Atticus Dataset)",
    aliases: ["CUAD"],
    definition: "A free collection of 510 real contracts in which lawyers highlighted about 13,000 passages and labelled what kind of clause each is.",
    stage: null,
  },
  {
    id: "contractnli",
    term: "ContractNLI (Contract Natural Language Inference)",
    aliases: ["ContractNLI"],
    definition: "A free collection of 607 NDAs, each labelled for whether it says, contradicts or doesn't mention 17 statements.",
    stage: null,
  },
  {
    id: "acord",
    term: "ACORD (Atticus Clause Retrieval Dataset)",
    aliases: ["ACORD"],
    definition: "Lawyers' search questions with clauses experts rated for how well they answer. Used as a test, never for training.",
    stage: null,
  },
  {
    id: "benchmark",
    term: "Benchmark",
    aliases: ["benchmark", "benchmarks"],
    definition: "A public test that everyone scores their system on, so results can be compared fairly.",
    stage: null,
  },
  {
    id: "contrastive-fine-tuning",
    term: "Contrastive fine-tuning",
    aliases: ["contrastive fine-tuning"],
    definition: "Training an embedding model by moving a question closer to its right passage and further from a wrong one, many times over.",
    stage: "hybrid-retrieval",
  },
  {
    id: "synthetic-question",
    term: "Synthetic question",
    aliases: ["synthetic question", "synthetic questions"],
    definition: "A test or training question written by a language model rather than asked by a real person.",
    stage: null,
  },
  {
    id: "re-index",
    term: "Re-index",
    aliases: ["re-index", "re-indexing", "re-indexed"],
    definition: "Embed every clause again with a new embedding model and build a fresh index, so old and new numbers never mix.",
    stage: "hybrid-retrieval",
  },
  {
    id: "notebook",
    term: "Notebook",
    aliases: ["notebook", "notebooks"],
    definition: "A file of code you run one block at a time, with notes and results shown in between.",
    stage: null,
  },
  {
    id: "hugging-face",
    term: "Hugging Face",
    aliases: ["Hugging Face"],
    definition: "A website where people share free datasets and AI models. The datasets library downloads from it.",
    stage: null,
  },
];
