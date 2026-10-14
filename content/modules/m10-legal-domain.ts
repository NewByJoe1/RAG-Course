import type { ModuleContent } from "../types";

// Source: m10-contract-domain.md (Week 7, lesson 1). Passages are the excerpts
// quoted in the source; user queries are inferred where the source omits them.

const m10: ModuleContent = {
  id: "m10",
  slug: "legal-domain",
  order_index: 10,
  title: "Contract Analysis Domain",
  summary:
    "A lawyer doesn't want \"the NDA permits disclosure\"; they want the section, the page and the exact words. Contracts are a good RAG domain because the ground truth is in the document, but they break general-purpose RAG in specific ways. By the end, you can trace any answer to its clause, section number and page, and know the five ways legal documents break general-purpose RAG.",
  learning_objectives: [
    "Explain why contracts suit RAG, and the five ways they break general-purpose RAG",
    "Parse a contract into a tree of sections, subsections and clauses",
    "Attach definitions to every chunk that uses a defined term",
    "Produce a citation object: clause id, section, page and verified verbatim quote",
    "Name the four things that make up a domain pack",
  ],
  estimated_minutes: 90,
  is_published: true,

  lesson_steps: [
    {
      id: "m10-s01",
      order_index: 1,
      kind: "exercise",
      title: "Warm-up recall",
      body_md: `Answer from memory before checking:

1. Where should tenant isolation be enforced, and why? (Module 9)
2. What does the citation-verification gate check? (Module 9)
3. What does the system show when a gate fails? (Module 9)`,
    },
    {
      id: "m10-s02",
      order_index: 2,
      kind: "concept",
      title: "Why this matters",
      body_md: `A lawyer does not want "the NDA permits disclosure to subcontractors". They want:

> "Section 4.2(b), page 3, permits disclosure to affiliates and permitted recipients; a subcontractor qualifies only if it meets the definition in Section 1.4."

The demo shows the difference in trust when the citation is **clickable**.`,
    },
    {
      id: "m10-s03",
      order_index: 3,
      kind: "concept",
      title: "Core idea: contracts as a RAG domain",
      body_md: `Contracts are a **good** RAG domain: the ground truth is in the document, the structure is explicit (sections, definitions, cross-references), and a wrong answer has a clear cost.

They are **hard** because:

1. Definitions live far from where they are used.
2. Clauses cross-reference each other.
3. Negation ("notwithstanding", "except") flips meaning.
4. Chunk boundaries cut sentences.
5. Clauses run across pages.

**Analogy:** a legal document is a program; definitions are variables declared at the top.

Everything legal-specific lives in a **domain pack**, always the same four things: the **taxonomy** (\`config/taxonomy.yaml\`), the **golden set**, the **judge rules**, and a **fine-tuned embedder**.`,
    },
    {
      id: "m10-s04",
      order_index: 4,
      kind: "example",
      title: "Worked example",
      body_md: `1. Parse the NDA into a tree: **section → subsection → clause**, with definitions attached to every term they define.
2. **Chunk by clause** and carry the section path as metadata.
3. Answer the subcontractor question with a **citation object**: clause id, section, page, verbatim quote.
4. **Verify the quote** against the source.
5. Show one cross-reference being resolved ("as defined in Section 1.4").`,
    },
    {
      id: "m10-s05",
      order_index: 5,
      kind: "exercise",
      title: "Hands-on (three tiers)",
      body_md: `**Predict first:** write down which of the five legal failure modes you think your current pipeline hits most.

- **Guided:** run the structural parser on the NDA; inspect the tree.
- **Partial:** add definition resolution: when a chunk uses a defined term, attach the definition.
- **Solo:** the lease in the course repo has clauses that span pages. Fix chunking so no clause is split, and prove it with a test.

**Files you create:** \`config/taxonomy.yaml\`, and legal rules added to the judge prompts.

**Capstone branch:** \`legal-domain\`, with the structural parser, definition resolver, citation object and verification gate wired in.

**Check it with your assistant:** paste the Legal specialisation section of the wiring diagram and ask: "Does my legal-domain branch load config/taxonomy.yaml, use it in the tagger and rewriter, and stamp taxonomy_version into the index?"`,
    },
    {
      id: "m10-s06",
      order_index: 6,
      kind: "exercise",
      title: "Failure gallery",
      body_md: `Diagnose the three broken outputs in this module's failure gallery and name the fix for each.`,
    },
    {
      id: "m10-s07",
      order_index: 7,
      kind: "reflection",
      title: "Exit quiz and reflection",
      body_md: `Take the quiz, then write one sentence on what still confuses you. It drives your spaced review.

**Say it in one sentence:** what are the four things that make a domain pack?`,
    },
  ],

  quiz_items: [
    {
      id: "m10-q01",
      lesson_step_id: "m10-s03",
      order_index: 1,
      kind: "single_choice",
      prompt: "Why are contracts a good domain for RAG?",
      choices: [
        { id: "a", text: "They are short and use simple language" },
        { id: "b", text: "The ground truth is in the document, the structure is explicit, and errors have a clear cost" },
        { id: "c", text: "LLMs already memorise every contract" },
        { id: "d", text: "They never change once signed" },
      ],
      answer: { choice: "b" },
      explanation: "The answer is always in the text, so every claim can be checked against it.",
      difficulty: 1,
    },
    {
      id: "m10-q02",
      lesson_step_id: "m10-s03",
      order_index: 2,
      kind: "single_choice",
      prompt: "Why do definitions cause trouble for general-purpose RAG?",
      choices: [
        { id: "a", text: "They are written in a different language" },
        { id: "b", text: "They live far from the clauses that use them, so a chunk can miss what a term means" },
        { id: "c", text: "Definitions are never indexed" },
        { id: "d", text: "LLMs ignore capitalised words" },
      ],
      answer: { choice: "b" },
      explanation: "\"Permitted Recipient\" in Section 4 only makes sense with its definition in Section 1.",
      difficulty: 1,
    },
    {
      id: "m10-q03",
      lesson_step_id: "m10-s03",
      order_index: 3,
      kind: "single_choice",
      prompt: "In the analogy, what are definitions in a legal document?",
      choices: [
        { id: "a", text: "Comments" },
        { id: "b", text: "Variables declared at the top of a program" },
        { id: "c", text: "Error messages" },
        { id: "d", text: "The program's output" },
      ],
      answer: { choice: "b" },
      explanation: "Every later clause \"uses\" them, so you must resolve them to read the clause correctly.",
      difficulty: 1,
    },
    {
      id: "m10-q04",
      lesson_step_id: "m10-s04",
      order_index: 4,
      kind: "single_choice",
      prompt: "What does a citation object contain?",
      choices: [
        { id: "a", text: "Just the section number" },
        { id: "b", text: "Clause id, section, page and a verified verbatim quote" },
        { id: "c", text: "The whole contract" },
        { id: "d", text: "The model name and temperature" },
      ],
      answer: { choice: "b" },
      explanation: "Enough for a lawyer to click through and check the exact words.",
      difficulty: 1,
    },
    {
      id: "m10-q05",
      lesson_step_id: "m10-s04",
      order_index: 5,
      kind: "single_choice",
      prompt: "Why chunk by clause instead of by a fixed number of tokens?",
      choices: [
        { id: "a", text: "Clause chunks are always smaller" },
        { id: "b", text: "Fixed-size chunks can cut a clause in half, losing its meaning" },
        { id: "c", text: "The embedder only accepts clauses" },
        { id: "d", text: "It makes indexing faster" },
      ],
      answer: { choice: "b" },
      explanation: "A clause is the unit of meaning in a contract; splitting it splits the answer.",
      difficulty: 2,
    },
    {
      id: "m10-q06",
      lesson_step_id: "m10-s03",
      order_index: 6,
      kind: "single_choice",
      prompt: "A clause starts \"Notwithstanding Section 4.2…\". Why does that matter?",
      choices: [
        { id: "a", text: "It's boilerplate and can be ignored" },
        { id: "b", text: "It overrides Section 4.2, so an answer citing 4.2 alone can be wrong" },
        { id: "c", text: "It means Section 4.2 has been deleted" },
        { id: "d", text: "It only affects the page numbering" },
      ],
      answer: { choice: "b" },
      explanation: "Negation and override words can reverse what another clause appears to say.",
      difficulty: 2,
    },
    {
      id: "m10-q07",
      lesson_step_id: "m10-s07",
      order_index: 7,
      kind: "single_choice",
      prompt: "What are the four things that make a domain pack?",
      choices: [
        { id: "a", text: "A taxonomy, a golden set, judge rules, and a fine-tuned embedder" },
        { id: "b", text: "A new pipeline, a new database, a new UI, and a new LLM" },
        { id: "c", text: "A logo, a pricing page, a contract, and a lawyer" },
        { id: "d", text: "A gateway, a queue, workers, and a kill switch" },
      ],
      answer: { choice: "a" },
      explanation: "The engine never changes; only these four pieces change per industry.",
      difficulty: 2,
    },
  ],

  failure_cases: [
    {
      id: "m10-f01",
      order_index: 1,
      title: "Right section, wrong contract",
      category: "retrieval_miss",
      user_query: "Can we share this with a subcontractor?",
      retrieved_context: [],
      bad_output:
        "The answer cites \"Section 4.2, Permitted Disclosures\", but the quoted text is from Section 4.2 of the office lease, not the NDA.",
      symptom: "A correct-looking citation that points into the wrong document.",
      root_cause: "Citation lacked the contract ID.",
      fix: "Put the contract id in every chunk's metadata and every citation object, and filter retrieval to the contract the question is about.",
      cause_options: [
        { id: "a", text: "Citation lacked the contract ID" },
        { id: "b", text: "The taxonomy has no entry for leases" },
        { id: "c", text: "The section numbers were parsed wrongly" },
      ],
      correct_cause: "a",
    },
    {
      id: "m10-f02",
      order_index: 2,
      title: "The missed \"notwithstanding\"",
      category: "retrieval_miss",
      user_query: "Can we share this with a contractor?",
      retrieved_context: [
        { source: "nda.pdf §4.2 Permitted Disclosures", text: "The Receiving Party may disclose Confidential Information to its affiliates and permitted recipients…" },
      ],
      bad_output:
        "\"Yes, Section 4.2 permits sharing with permitted recipients.\" But Section 4.5 begins \"Notwithstanding Section 4.2, no disclosure may be made to contractors.\"",
      symptom: "A confident yes that a later clause overrides.",
      root_cause: "The overriding clause wasn't retrieved.",
      fix: "Resolve cross-references: when a clause is retrieved, also pull any clause that refers to it with \"notwithstanding\" or \"subject to\".",
      cause_options: [
        { id: "a", text: "The definition of \"third party\" was missing" },
        { id: "b", text: "The citation gate rejected Section 4.5" },
        { id: "c", text: "The overriding clause wasn't retrieved" },
      ],
      correct_cause: "c",
    },
    {
      id: "m10-f03",
      order_index: 3,
      title: "The chunk that starts mid-sentence",
      category: "chunking",
      user_query: "Can we share this with a subcontractor?",
      retrieved_context: [{ source: "nda.pdf (top chunk)", text: "…and shall not be disclosed except as" }],
      bad_output: "The top chunk begins \"…and shall not be disclosed except as\", and the answer misreads the clause.",
      symptom: "The answer is built on half a sentence.",
      root_cause: "Fixed-size chunking ignored clause edges.",
      fix: "Chunk on clause boundaries from the structural parser, including clauses that run across pages.",
      cause_options: [
        { id: "a", text: "The PDF was scanned at far too low a resolution" },
        { id: "b", text: "Fixed-size chunking ignored clause edges" },
        { id: "c", text: "The compressor trimmed the opening words" },
      ],
      correct_cause: "b",
    },
  ],
};

export default m10;
