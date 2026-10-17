import type { GlossaryTerm } from "../glossary";

// Glossary terms first needed by Module 10. Shared terms live in content/glossary.ts.
export const terms: GlossaryTerm[] = [
  {
    id: "override-word",
    term: "Override word",
    aliases: ["override word", "override words"],
    definition: "A phrase like \"Notwithstanding\", \"subject to\" or \"except\" that makes one clause win over, or give way to, another.",
    stage: null,
  },
  {
    id: "cross-reference",
    term: "Cross-reference",
    aliases: ["cross-reference", "cross-references"],
    definition: "A clause that points at another clause, like §4.5 naming \"Section 4.2\". The two must be read together.",
    stage: null,
  },
  {
    id: "clause-aware-parsing",
    term: "Clause-aware parsing",
    aliases: ["clause-aware parsing", "parser"],
    definition: "Reading a contract into a tree of sections and clauses, so each chunk is one whole clause with its section number and page.",
    stage: "hybrid-retrieval",
  },
  {
    id: "citation-object",
    term: "Citation object",
    aliases: ["citation object", "citation objects"],
    definition: "A citation stored as a small record: clause id, section, title, page and the exact quote, checked word for word.",
    stage: "generation",
  },
  {
    id: "taxonomy",
    term: "Taxonomy",
    aliases: ["taxonomy", "config/taxonomy.yaml"],
    definition: "A tidy list of the things a system knows about. Here, contract words: defined terms, kinds of clause and override words.",
    stage: "pre-retrieval",
  },
  {
    id: "domain-pack",
    term: "Domain pack",
    aliases: ["domain pack"],
    definition: "The legal know-how kept apart from the engine: the taxonomy, the golden set, the judge rules and a legal embedding model.",
    stage: null,
  },
  {
    id: "domain-knowledge",
    term: "Domain knowledge",
    aliases: ["domain knowledge", "legal domain knowledge"],
    definition: "What an expert in a field knows. For contracts, the rules lawyers use to read them, such as which clause wins.",
    stage: null,
  },
];
