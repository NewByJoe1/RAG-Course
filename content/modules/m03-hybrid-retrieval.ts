import type { ModuleContent } from "../types";

// Source: m03-retrieval.md (Week 2, lesson 2). Failure-case passages are short
// illustrative excerpts; the source names the clauses but not their text.

const m03: ModuleContent = {
  id: "m03",
  slug: "hybrid-retrieval",
  order_index: 3,
  title: "Retrieval",
  summary:
    "Vector search catches meaning; keyword search catches exact terms. Lawyers ask both kinds of question, so the system runs both and merges the results. By the end, you can say for any query whether vector, keyword or hybrid will win, and prove it on the NDA.",
  learning_objectives: [
    "Explain what vector search and keyword (BM25) search each catch and miss",
    "Predict which method wins for a given question type (meaning-based vs exact-reference)",
    "Explain how reciprocal rank fusion (RRF) merges two ranked lists",
    "Run vector, BM25 and hybrid on the same questions and tally the results",
    "Ship one retrieve() call that returns about 40 fused chunks",
  ],
  estimated_minutes: 90,
  is_published: true,

  lesson_steps: [
    {
      id: "m03-s01",
      order_index: 1,
      kind: "exercise",
      title: "Warm-up recall",
      body_md: `Answer from memory before checking:

1. What does RAG add that a plain chatbot does not have?
2. The NDA never says "subcontractor". Which three terms does it use instead?
3. Why does the router escalate up, not down, when it is unsure?`,
    },
    {
      id: "m03-s02",
      order_index: 2,
      kind: "concept",
      title: "Why this matters",
      body_md: `Vector search finds "permitted recipient" when you ask about subcontractors, but it misses **"Section 4.2(b)"** when you ask for it by number. Keyword search does the opposite.

Lawyers ask both kinds of question, so **either method alone fails half of them**.`,
    },
    {
      id: "m03-s03",
      order_index: 3,
      kind: "concept",
      title: "Core idea: meaning plus exact terms",
      body_md: `**Vectors catch meaning; keywords (BM25) catch exact terms.**

Hybrid retrieval runs both and merges the two ranked lists, usually with **reciprocal rank fusion (RRF)**: each chunk scores the sum of \`1 / (60 + rank)\` across the lists it appears in. A chunk that ranks well in both lists earns the highest combined score.

**Analogy:** a librarian who knows the subject, plus the index at the back of the book.`,
    },
    {
      id: "m03-s04",
      order_index: 4,
      kind: "example",
      title: "Worked example",
      body_md: `Run the same 10 questions through **vector search**, **BM25** and **hybrid**, and tally which method puts the gold clause in the top 3.

Hybrid wins **8 of 10**. Now look at the 2 it loses and say why. The losses show where the fusion is weak.`,
    },
    {
      id: "m03-s05",
      order_index: 5,
      kind: "exercise",
      title: "Hands-on (three tiers)",
      body_md: `**Predict first:** write down how many of the 10 questions you think hybrid will win.

- **Guided:** run the comparison notebook and fill in the tally table.
- **Partial:** implement reciprocal rank fusion yourself from its one-line formula. Hint: score = sum of 1 / (60 + rank).
- **Solo:** find a question where keyword beats hybrid, and tune the fusion weight until hybrid wins without losing the others.

**Files you create:** \`index/\` (Chroma or pgvector store) and a BM25 index build script.

**Capstone branch:** \`hybrid-retrieval\`, with vector plus BM25 and fusion behind one \`retrieve()\` call.

**Check it with your assistant:** paste stage [2] from the wiring diagram and ask: "Does my hybrid-retrieval branch run vector and BM25 together, fuse with RRF, and return about 40 chunks?"`,
    },
    {
      id: "m03-s06",
      order_index: 6,
      kind: "exercise",
      title: "Failure gallery",
      body_md: `Diagnose the three broken outputs in this module's failure gallery and name the fix for each.`,
    },
    {
      id: "m03-s07",
      order_index: 7,
      kind: "reflection",
      title: "Exit quiz and reflection",
      body_md: `Take the quiz, then write one sentence on what still confuses you. It drives your spaced review.

**Say it in one sentence:** when does keyword search beat meaning search?`,
    },
  ],

  quiz_items: [
    {
      id: "m03-q01",
      lesson_step_id: "m03-s03",
      order_index: 1,
      kind: "single_choice",
      prompt: "What does vector search match on?",
      choices: [
        { id: "a", text: "Exact words in the clause" },
        { id: "b", text: "Meaning, even when the words differ" },
        { id: "c", text: "Section numbers" },
        { id: "d", text: "File names" },
      ],
      answer: { choice: "b" },
      explanation: "Embeddings place text with similar meaning close together, so \"subcontractor\" can find \"permitted recipient\".",
      difficulty: 1,
    },
    {
      id: "m03-q02",
      lesson_step_id: "m03-s02",
      order_index: 2,
      kind: "single_choice",
      prompt: "A lawyer asks, \"Show me Section 4.2(b).\" Which method is most likely to find it?",
      choices: [
        { id: "a", text: "Vector search" },
        { id: "b", text: "Keyword search (BM25)" },
        { id: "c", text: "Neither" },
        { id: "d", text: "The re-ranker" },
      ],
      answer: { choice: "b" },
      explanation: "\"4.2(b)\" is an exact term with little meaning to embed; keyword search matches it directly.",
      difficulty: 1,
    },
    {
      id: "m03-q03",
      lesson_step_id: "m03-s03",
      order_index: 3,
      kind: "single_choice",
      prompt: "What does hybrid retrieval do?",
      choices: [
        { id: "a", text: "Runs vector search, then discards the keyword results" },
        { id: "b", text: "Runs vector and keyword search and merges the two ranked lists" },
        { id: "c", text: "Picks one method at random per query" },
        { id: "d", text: "Uses keywords only for long questions" },
      ],
      answer: { choice: "b" },
      explanation: "Hybrid runs both and fuses the rankings, so it catches both meaning and exact terms.",
      difficulty: 1,
    },
    {
      id: "m03-q04",
      lesson_step_id: "m03-s03",
      order_index: 4,
      kind: "single_choice",
      prompt: "In reciprocal rank fusion, how is a chunk scored?",
      choices: [
        { id: "a", text: "The sum of 1 / (60 + rank) across every list it appears in" },
        { id: "b", text: "Its highest cosine similarity" },
        { id: "c", text: "Its word count" },
        { id: "d", text: "The number of lists it appears in" },
      ],
      answer: { choice: "a" },
      explanation: "Ranking well in both lists earns the highest combined score.",
      difficulty: 2,
    },
    {
      id: "m03-q05",
      lesson_step_id: "m03-s06",
      order_index: 5,
      kind: "single_choice",
      prompt: "A BM25 search for \"terminate\" misses a clause that says \"termination\". Why?",
      choices: [
        { id: "a", text: "BM25 matches exact terms, and the two word forms differ" },
        { id: "b", text: "The embedding model is too small" },
        { id: "c", text: "The chunk is too long" },
        { id: "d", text: "A metadata filter excluded it" },
      ],
      answer: { choice: "a" },
      explanation: "Without stemming, BM25 treats \"terminate\" and \"termination\" as different words.",
      difficulty: 2,
    },
    {
      id: "m03-q06",
      lesson_step_id: "m03-s05",
      order_index: 6,
      kind: "single_choice",
      prompt: "About how many chunks does the retrieval stage hand forward?",
      choices: [
        { id: "a", text: "3" },
        { id: "b", text: "10" },
        { id: "c", text: "About 40" },
        { id: "d", text: "Every chunk in the index" },
      ],
      answer: { choice: "c" },
      explanation: "Retrieval is deliberately generous; later stages narrow 40 down to the best few.",
      difficulty: 2,
    },
    {
      id: "m03-q07",
      lesson_step_id: "m03-s04",
      order_index: 7,
      kind: "single_choice",
      prompt: "Hybrid wins 8 of 10 test questions. What do you do with the 2 it lost?",
      choices: [
        { id: "a", text: "Ignore them; 80% is a pass" },
        { id: "b", text: "Study why it lost them" },
        { id: "c", text: "Delete them from the test set" },
        { id: "d", text: "Switch to keyword search only" },
      ],
      answer: { choice: "b" },
      explanation: "The losses show you where the fusion is weak; deleting them only hides the problem.",
      difficulty: 2,
    },
  ],

  failure_cases: [
    {
      id: "m03-f01",
      order_index: 1,
      title: "The signature block",
      category: "retrieval_miss",
      user_query: "Can we share this with a subcontractor?",
      retrieved_context: [
        { source: "nda.pdf Signature block (rank 1, vector only)", text: "IN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date." },
      ],
      bad_output: "For \"Can we share this with a subcontractor?\", the top retrieved chunk is the signature block at the end of the NDA.",
      symptom: "Boilerplate outranks the clause that actually answers the question.",
      root_cause: "Vector search alone matched loose similarity, with no keyword signal to anchor it.",
      fix: "Use hybrid retrieval so keyword matches on \"disclose\", \"third party\" and similar terms pull the right clause up. Boilerplate like signature blocks is dropped later, in post-retrieval.",
    },
    {
      id: "m03-f02",
      order_index: 2,
      title: "\"Terminate\" vs \"termination\"",
      category: "retrieval_miss",
      user_query: "How do we terminate this agreement?",
      retrieved_context: [],
      bad_output: "\"How do we terminate this agreement?\" returns nothing useful from BM25, even though Section 8 is titled \"Termination\".",
      symptom: "Keyword search finds nothing for a clause that is plainly in the contract.",
      root_cause: "BM25 matches exact word forms, and \"terminate\" ≠ \"termination\".",
      fix: "Stem or lemmatise words at both index time and query time, and rely on the vector half of hybrid to cover word-form differences.",
    },
    {
      id: "m03-f03",
      order_index: 3,
      title: "The double-counted chunk",
      category: "ranking",
      user_query: "Can we share this with a subcontractor?",
      retrieved_context: [
        { source: "nda.pdf §4 Permitted Disclosure (from vector list)", text: "The Receiving Party may disclose Confidential Information to its affiliates and permitted recipients…" },
        { source: "nda.pdf §4 Permitted Disclosure (from BM25 list)", text: "The Receiving Party may disclose Confidential Information to its affiliates and permitted recipients…" },
      ],
      bad_output: "The same permitted-disclosure clause appears twice in the fused top 3, pushing out a different relevant clause.",
      symptom: "Duplicate entries in the top results crowd out other relevant clauses.",
      root_cause: "The fusion step merged results by position instead of by chunk ID, so one chunk counted as two entries.",
      fix: "Merge on chunk ID before scoring, so each chunk appears once with its combined RRF score.",
    },
  ],
};

export default m03;
