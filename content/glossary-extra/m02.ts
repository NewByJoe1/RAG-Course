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
  {
    id: "yaml",
    term: "YAML",
    aliases: ["YAML", "data/synonyms.yaml"],
    definition: "A plain text format for settings and simple tables: one name, a colon, then its value on each line. These files end in .yaml.",
    stage: null,
  },
  {
    id: "print-mode",
    term: "Print mode (claude -p)",
    aliases: ["print mode", "claude -p"],
    definition: "Running Claude Code as claude -p \"message\": it sends one message to Claude, prints the reply and stops. Your code uses it to ask Claude things.",
    stage: "generation",
  },
  {
    id: "claude-models",
    term: "Haiku, Sonnet and Opus",
    aliases: ["Haiku", "Sonnet", "Opus"],
    definition: "Claude's three model sizes: Haiku is small and fast, Sonnet is the main all-rounder, and Opus is the strongest and slowest.",
    stage: "routing",
  },
];
