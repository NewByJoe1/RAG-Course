import type { ModuleContent } from "../types";

// Lesson order follows the author's teaching order: Routing (s05) comes before
// the hands-on exercise (s06) because the exercise builds prompts/tag.md and
// config/models.yaml, which Routing introduces. (Module 1 has its exercise
// before its last concept step.)

const m02: ModuleContent = {
  id: "m02",
  slug: "pre-retrieval",
  order_index: 2,
  title: "Pre-Retrieval",
  summary:
    "The user's question and the contract are written in two different dialects. This module teaches the system to translate the question into the contract's own language before it searches, so the permitted-disclosure clause finally lands in the top 3 for \"Can we share this with a subcontractor?\"",
  learning_objectives: [
    "Explain why searching with the user's exact words can miss the right clause",
    "Rewrite a plain-English question into contract language with an LLM prompt",
    "Expand a query with legal synonyms, with or without an LLM",
    "Use a metadata filter (such as doc_type = NDA) to narrow the search before it runs",
    "Describe how a routing label (simple, multi-clause, conflicting) picks which model answers, and why the router escalates up when unsure",
  ],
  estimated_minutes: 45,
  is_published: true,

  lesson_steps: [
    {
      id: "m02-s01",
      order_index: 1,
      kind: "exercise",
      title: "Warm-up recall",
      body_md: `Answer these three from memory before you check:

1. What are the two jobs in RAG: what does the **librarian** do, and what does the **writer** do?
2. In Module 1, which clause did the naive system retrieve instead of the permitted-disclosure clause?
3. What are the three rules in \`prompts/generate.md\`?

**Answers**

1. The librarian retrieves the right pages; the writer answers only from them.
2. The definitions clause.
3. Answer only from the chunks; cite every claim by section and clause title; and say "The contract does not address this" when the chunks don't answer.`,
    },
    {
      id: "m02-s02",
      order_index: 2,
      kind: "concept",
      title: "Why this matters",
      body_md: `Ask the Module 1 system: **"Can we share this with a subcontractor?"** It misses again.

Now search the NDA for the word "subcontractor". It appears **nowhere**. The contract talks about "third parties", "affiliates" and "permitted recipients".

The search was looking for the user's words in a document that never uses them. No amount of better searching fixes that. **The question has to be translated first.**`,
    },
    {
      id: "m02-s03",
      order_index: 3,
      kind: "concept",
      title: "Core idea: two dialects",
      body_md: `Your user speaks business English. The contract speaks legalese. **Pre-retrieval** is the translator that sits between them, and it runs before any search.

It has three tools:

- **Rewriting:** an LLM restates the question the way a contract would phrase it.
- **Synonym expansion:** add the contract's words for the same idea (subcontractor → third party, permitted recipient, affiliate).
- **Metadata filtering:** only search documents that could hold the answer (this NDA, not every contract in the folder).

**Analogy:** a lawyer hears a client say "can I let my contractor see this?" and mentally rephrases it as "is disclosure to a third party permitted?" before opening the file.`,
      code_snippet: `SYNONYMS = {
    "subcontractor": ["third party", "permitted recipient", "affiliate"],
    "share": ["disclose", "make available", "provide access"],
}

def expand(query: str) -> list[str]:
    queries = [query]
    for word, alternatives in SYNONYMS.items():
        if word in query.lower():
            for alt in alternatives:
                queries.append(query.lower().replace(word, alt))
    return queries`,
      code_language: "python",
    },
    {
      id: "m02-s04",
      order_index: 4,
      kind: "example",
      title: "Worked example",
      body_md: `1. Send the question to an LLM with the rewrite prompt in \`prompts/rewrite.md\`, asking for **five rewrites** in contract language.
2. Typical rewrites:
   - "Is disclosure of Confidential Information to a third party permitted?"
   - "May the Receiving Party disclose to its subcontractors or agents?"
   - "Who qualifies as a permitted recipient?"
   - "Under what conditions may Confidential Information be shared with affiliates?"
   - "What restrictions apply to disclosure to third parties?"
3. Add the filter \`doc_type = NDA\`.
4. Retrieve with all five rewrites **plus the original**, and merge the results.
5. The permitted-disclosure clause now appears at **rank 2**. Not yet rank 1: that's Module 5's job.`,
      code_snippet: `def rewrite_query(question: str, llm) -> dict:
    prompt = open("prompts/rewrite.md").read().format(question=question)
    rewrites = llm(prompt).strip().split("\\n")[:5]
    return {
        "original": question,
        "rewrites": rewrites,
        "filters": {"doc_type": "NDA"},
    }`,
      code_language: "python",
    },
    {
      id: "m02-s05",
      order_index: 5,
      kind: "concept",
      title: "Routing",
      body_md: `Not every question deserves the same model. The same small model that rewrites the query also **labels** it:

- **simple:** one clause answers it ("How long does the NDA last?") → fast, cheap model
- **multi-clause:** the answer needs two or more clauses → main model
- **conflicting:** clauses seem to disagree → main model with extended thinking

The label travels with the question, and at generation time it picks the model from \`config/models.yaml\`.

When the classifier is unsure, it **escalates up, never down**. Sending an easy question to a strong model costs a few cents; sending a hard one to a weak model costs a wrong legal answer. The label is logged so Module 7 can report accuracy per label.

**Predict first:** what fraction of a lawyer's everyday questions are "simple"? Write your number down. You'll measure it in Module 7.`,
    },
    {
      id: "m02-s06",
      order_index: 6,
      kind: "exercise",
      title: "Hands-on (three tiers)",
      body_md: `Write a one-line prediction before each run.

- **Guided:** use the supplied rewrite prompt on three given questions. Compare the top 3 before and after.
- **Partial:** write your own rewrite prompt for a termination question. One hint: ask for legal synonyms explicitly.
- **Solo:** build a 20-term legal synonym table (indemnify → hold harmless, terminate → rescind) and use it for expansion without an LLM.

**Files you create:** \`prompts/rewrite.md\`, \`prompts/tag.md\`, \`config/models.yaml\`.

**Capstone branch:** \`pre-retrieval\`, with a \`rewrite_query()\` function and tests.

**Check it with your assistant:** paste stages [1] and [1b] from the Pipeline Wiring Diagram and ask: "Does my pre-retrieval branch emit a rewritten query, filters, and a difficulty label, and does the label pick the model from config/models.yaml?"`,
    },
    {
      id: "m02-s07",
      order_index: 7,
      kind: "reflection",
      title: "Failure gallery and reflection",
      body_md: `Diagnose the three failure cases in this module's failure gallery, then write one sentence:

**Why does the router escalate up when it is unsure, rather than down?**

Also write one sentence on what still confuses you. It drives your spaced review.`,
    },
  ],

  // Ordered to follow Module 1's quiz-type pattern as closely as the content
  // allows (Module 1 has two multi-selects; this module has one).
  quiz_items: [
    {
      id: "m02-q01",
      lesson_step_id: "m02-s02",
      order_index: 1,
      kind: "single_choice",
      prompt: "Why did the naive system miss the right clause for the subcontractor question?",
      choices: [
        { id: "a", text: "The embedding model was too small" },
        { id: "b", text: "The contract never uses the word \"subcontractor\"" },
        { id: "c", text: "The chunk size was too large" },
        { id: "d", text: "The LLM ignored the retrieved chunks" },
      ],
      answer: { choice: "b" },
      explanation: "The NDA says \"third party\" and \"permitted recipient\", so searching with the user's word misses it.",
      difficulty: 1,
    },
    {
      id: "m02-q02",
      lesson_step_id: "m02-s03",
      order_index: 2,
      kind: "multi_choice",
      prompt: "Which of these are pre-retrieval techniques? (Select all that apply.)",
      choices: [
        { id: "a", text: "Query rewriting" },
        { id: "b", text: "Synonym expansion" },
        { id: "c", text: "Metadata filtering" },
        { id: "d", text: "Cross-encoder re-ranking" },
      ],
      answer: { choices: ["a", "b", "c"] },
      explanation: "Re-ranking happens after retrieval (Module 5); the other three happen before.",
      difficulty: 2,
    },
    {
      id: "m02-q03",
      lesson_step_id: "m02-s02",
      order_index: 3,
      kind: "short_answer",
      prompt: "Name one term the NDA uses instead of \"subcontractor\".",
      answer: { accepted: ["third party", "third parties", "permitted recipient", "permitted recipients", "affiliate", "affiliates"] },
      explanation: "These are the contract's own words for people outside the signing parties who may receive information.",
      difficulty: 2,
    },
    {
      id: "m02-q04",
      lesson_step_id: "m02-s03",
      order_index: 4,
      kind: "single_choice",
      prompt: "When does pre-retrieval run?",
      choices: [
        { id: "a", text: "After the answer is generated" },
        { id: "b", text: "After re-ranking" },
        { id: "c", text: "Before the search is run" },
        { id: "d", text: "Only during fine-tuning" },
      ],
      answer: { choice: "c" },
      explanation: "Pre-retrieval translates the question before any search touches the index.",
      difficulty: 1,
    },
    {
      id: "m02-q05",
      lesson_step_id: "m02-s04",
      order_index: 5,
      kind: "single_choice",
      prompt: "A rewrite turns \"Can we share this?\" into \"Must we share this?\" What went wrong?",
      choices: [
        { id: "a", text: "The query was over-expanded" },
        { id: "b", text: "The rewrite changed the meaning" },
        { id: "c", text: "The metadata filter was wrong" },
        { id: "d", text: "Nothing; it's a valid synonym" },
      ],
      answer: { choice: "b" },
      explanation: "\"May\" grants permission, \"must\" imposes an obligation. A rewrite must preserve meaning.",
      difficulty: 2,
    },
    {
      id: "m02-q06",
      lesson_step_id: "m02-s03",
      order_index: 6,
      kind: "single_choice",
      prompt:
        "A filter of doc_type = NDA returns nothing, but the answer is in a confidentiality section of an MSA. What's the problem?",
      choices: [
        { id: "a", text: "The filter excluded the right document" },
        { id: "b", text: "The synonym table is too short" },
        { id: "c", text: "The router picked the wrong model" },
        { id: "d", text: "The chunks were too small" },
      ],
      answer: { choice: "a" },
      explanation: "Filters narrow the search; a wrong filter removes the answer before retrieval can find it.",
      difficulty: 2,
    },
    {
      id: "m02-q07",
      lesson_step_id: "m02-s05",
      order_index: 7,
      kind: "single_choice",
      prompt: "The router isn't sure whether a question is \"simple\" or \"conflicting\". What should it do?",
      choices: [
        { id: "a", text: "Pick \"simple\" to save cost" },
        { id: "b", text: "Pick \"conflicting\" (escalate up)" },
        { id: "c", text: "Refuse to answer" },
        { id: "d", text: "Pick at random and log it" },
      ],
      answer: { choice: "b" },
      explanation:
        "A strong model on an easy question wastes a little money; a weak model on a hard question risks a wrong legal answer.",
      difficulty: 3,
    },
  ],

  // Passage texts are short illustrative excerpts consistent with the section
  // numbers in each case.
  failure_cases: [
    {
      id: "m02-f01",
      order_index: 1,
      title: "The query that retrieves everything",
      category: "ranking",
      user_query: "Can we share this with a subcontractor?",
      retrieved_context: [
        { source: "nda.pdf §1 Definitions", text: "\"Confidential Information\" means all information disclosed by either party to the other party under this Agreement…", score: 0.82 },
        { source: "nda.pdf Signature block", text: "IN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date.", score: 0.8 },
        { source: "nda.pdf §9 Governing Law", text: "This Agreement shall be governed by the laws of the State of Delaware.", score: 0.79 },
        { source: "nda.pdf §7 Term", text: "This Agreement shall remain in force for two (2) years from the Effective Date.", score: 0.78 },
        { source: "nda.pdf §4 Permitted Disclosure (rank 9)", text: "The Receiving Party may disclose Confidential Information to its affiliates and permitted recipients who are bound by obligations no less protective…", score: 0.71 },
      ],
      bad_output: "The agreement is governed by the laws of Delaware and remains in force for two years. (Section 9, Section 7)",
      symptom: "The answer is about the wrong topic; the right clause is buried.",
      root_cause:
        "Over-expansion: the query added generic words (\"agreement\", \"party\", \"information\") that appear in every clause, so everything matched and the permitted-disclosure clause fell to rank 9.",
      fix: "Expand only with specific legal synonyms for the key concept, cap the number of added terms, and drop words that appear in most clauses.",
    },
    {
      id: "m02-f02",
      order_index: 2,
      title: "The rewrite that changed the meaning",
      category: "prompt",
      user_query: "May we share this with a subcontractor?",
      retrieved_context: [
        { source: "nda.pdf §5 Compelled Disclosure", text: "If the Receiving Party is required by law, regulation or court order to disclose Confidential Information, it shall give the Disclosing Party prompt notice…", score: 0.88 },
      ],
      bad_output: "Yes, you must disclose the information when required by law. (Section 5)",
      symptom: "The answer is about being forced to share, not being allowed to share.",
      root_cause:
        "Meaning drift: the rewrite (\"What obligations require the Receiving Party to disclose information to third parties?\") turned a permission question (\"may\") into an obligation question (\"must\"), so a different clause matched.",
      fix: "Tell the rewrite prompt to keep modal verbs (may, must, shall) exactly as asked, and check each rewrite against the original before using it.",
    },
    {
      id: "m02-f03",
      order_index: 3,
      title: "The filter that excluded the right document",
      category: "retrieval_miss",
      user_query: "Can we share the client's data with a subcontractor?",
      retrieved_context: [],
      bad_output: "The contract does not address this.",
      symptom: "A false refusal: the answer exists, but the system says it doesn't.",
      root_cause:
        "The metadata filter doc_type = NDA was set by default instead of from the question, so the client's MSA, whose confidentiality section holds the answer, was never searched. Nothing relevant was retrieved.",
      fix: "Derive filters from the question and the documents actually on file, fall back to an unfiltered search when a filtered one returns nothing, and log when the fallback fires.",
    },
  ],
};

export default m02;
