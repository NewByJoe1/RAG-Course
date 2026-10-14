import type { ModuleContent } from "../types";

// Source: m05-reranking.md (Week 3, lesson 2). Failure-case passages are short
// illustrative excerpts; the source names the clauses but not their text.

const m05: ModuleContent = {
  id: "m05",
  slug: "rerank",
  order_index: 5,
  title: "Re-Ranking",
  summary:
    "A bi-encoder (the embedder) compares question and clause separately: fast but shallow. A cross-encoder reads the question and clause together and scores the pair: slow but far more accurate. So the system retrieves with the fast one and re-ranks the cleaned chunks with the slow one. By the end, the permitted-disclosure clause is at rank 1 for the subcontractor question, and you can explain why.",
  learning_objectives: [
    "Explain the difference between a bi-encoder and a cross-encoder",
    "Explain why rank order matters to the LLM's answer",
    "Place the re-ranker correctly: after post-retrieval, passing the top 3 to 5 forward",
    "Trade off re-ranking depth against a latency budget",
    "Build a 30-pair legal test set to score the re-ranker (reused in Module 6)",
  ],
  estimated_minutes: 90,
  is_published: true,

  lesson_steps: [
    {
      id: "m05-s01",
      order_index: 1,
      kind: "exercise",
      title: "Warm-up recall",
      body_md: `Answer from memory before checking:

1. Why does hybrid retrieval beat vector search alone? (Module 3)
2. In what order do the three post-retrieval cleaners run? (Module 4)
3. Why is more context not always better? (Module 4)`,
    },
    {
      id: "m05-s02",
      order_index: 2,
      kind: "concept",
      title: "Why this matters",
      body_md: `The gold clause sits at **rank 2**, behind the definitions clause.

The LLM reads top-down and **anchors on what it sees first**, so rank 2 is not good enough. The best clause belongs at rank 1.`,
    },
    {
      id: "m05-s03",
      order_index: 3,
      kind: "concept",
      title: "Core idea: bi-encoder vs cross-encoder",
      body_md: `- A **bi-encoder** embeds the query and the document separately and compares them: fast, but it never sees them together.
- A **cross-encoder** reads the query and the document in one pass and scores the pair: slow, but far more accurate.

So **retrieve with the fast one, and re-rank the cleaned shortlist with the slow one.**

**Analogy:** a quick glance at book spines versus actually reading the page.`,
    },
    {
      id: "m05-s04",
      order_index: 4,
      kind: "example",
      title: "Worked example",
      body_md: `Re-rank the cleaned chunks with an off-the-shelf cross-encoder. The gold clause moves to **rank 1**.

Then look at a question where it does not move to rank 1, and note it for Module 6.`,
    },
    {
      id: "m05-s05",
      order_index: 5,
      kind: "exercise",
      title: "Hands-on (three tiers)",
      body_md: `**Predict first:** write down how many of 10 questions you think will have the gold clause at rank 1 after re-ranking.

- **Guided:** plug the cross-encoder into the pipeline and record the rank changes for 10 questions.
- **Partial:** measure the latency cost, and decide how many chunks to re-rank for a 2-second budget.
- **Solo:** build a set of 30 legal (question, clause, relevant?) pairs and score the re-ranker on it. This set is reused in Module 6.

**Files you create:** a re-ranker entry in \`config/models.yaml\`.

**Capstone branch:** \`rerank\`, with a cross-encoder on the top-k and a configurable k.

**Check it with your assistant:** paste stage [4] from the wiring diagram and ask: "Does my rerank branch score the cleaned chunks with a cross-encoder and pass the top 3 to 5 forward?"`,
    },
    {
      id: "m05-s06",
      order_index: 6,
      kind: "exercise",
      title: "Failure gallery",
      body_md: `Diagnose the three broken outputs in this module's failure gallery and name the fix for each.`,
    },
    {
      id: "m05-s07",
      order_index: 7,
      kind: "reflection",
      title: "Exit quiz and reflection",
      body_md: `Take the quiz, then write one sentence on what still confuses you. It drives your spaced review.

**Say it in one sentence:** why can the re-ranker see something the embedder cannot?`,
    },
  ],

  quiz_items: [
    {
      id: "m05-q01",
      lesson_step_id: "m05-s03",
      order_index: 1,
      kind: "single_choice",
      prompt: "What is the key difference between a bi-encoder and a cross-encoder?",
      choices: [
        { id: "a", text: "A bi-encoder reads question and clause together; a cross-encoder reads them separately" },
        { id: "b", text: "A bi-encoder embeds question and clause separately; a cross-encoder reads them together in one pass" },
        { id: "c", text: "They are the same model with different names" },
        { id: "d", text: "A cross-encoder only works on keywords" },
      ],
      answer: { choice: "b" },
      explanation: "Reading the pair together is what lets the cross-encoder judge relevance more accurately.",
      difficulty: 1,
    },
    {
      id: "m05-q02",
      lesson_step_id: "m05-s03",
      order_index: 2,
      kind: "single_choice",
      prompt: "Why not use a cross-encoder to search the whole index?",
      choices: [
        { id: "a", text: "It is too slow to score every chunk" },
        { id: "b", text: "It can't read legal text" },
        { id: "c", text: "It only returns one result" },
        { id: "d", text: "It requires fine-tuning first" },
      ],
      answer: { choice: "a" },
      explanation: "Scoring every pair is expensive, so it only scores a short, cleaned list.",
      difficulty: 1,
    },
    {
      id: "m05-q03",
      lesson_step_id: "m05-s02",
      order_index: 3,
      kind: "single_choice",
      prompt: "The gold clause is at rank 2. Why is that still a problem?",
      choices: [
        { id: "a", text: "The LLM never reads rank 2" },
        { id: "b", text: "The LLM reads top-down and anchors on what it sees first" },
        { id: "c", text: "Rank 2 chunks are always deleted" },
        { id: "d", text: "It isn't a problem" },
      ],
      answer: { choice: "b" },
      explanation: "The first chunk shapes the answer most, so the best clause belongs at rank 1.",
      difficulty: 1,
    },
    {
      id: "m05-q04",
      lesson_step_id: "m05-s05",
      order_index: 4,
      kind: "single_choice",
      prompt: "Where does the re-ranker sit in the pipeline?",
      choices: [
        { id: "a", text: "Before retrieval" },
        { id: "b", text: "After post-retrieval, scoring about 10 cleaned chunks and passing the top 3 to 5 forward" },
        { id: "c", text: "After generation" },
        { id: "d", text: "Inside the query rewriter" },
      ],
      answer: { choice: "b" },
      explanation: "It works on the cleaned shortlist and hands the best few to generation.",
      difficulty: 2,
    },
    {
      id: "m05-q05",
      lesson_step_id: "m05-s05",
      order_index: 5,
      kind: "single_choice",
      prompt: "Re-ranking is too slow for your 2-second budget. What is the simplest fix?",
      choices: [
        { id: "a", text: "Re-rank fewer chunks" },
        { id: "b", text: "Remove post-retrieval" },
        { id: "c", text: "Use a bigger LLM" },
        { id: "d", text: "Skip retrieval" },
      ],
      answer: { choice: "a" },
      explanation: "Latency grows with every chunk scored, so cap the number of chunks re-ranked.",
      difficulty: 2,
    },
    {
      id: "m05-q06",
      lesson_step_id: "m05-s06",
      order_index: 6,
      kind: "single_choice",
      prompt: "Why should de-duplication happen before re-ranking?",
      choices: [
        { id: "a", text: "So the re-ranker doesn't waste its budget scoring copies of the same clause" },
        { id: "b", text: "Because the re-ranker deletes duplicates itself" },
        { id: "c", text: "It doesn't matter which comes first" },
        { id: "d", text: "Because duplicates improve re-ranking" },
      ],
      answer: { choice: "a" },
      explanation: "Every duplicate costs re-ranking time and can crowd out a different relevant clause.",
      difficulty: 2,
    },
    {
      id: "m05-q07",
      lesson_step_id: "m05-s05",
      order_index: 7,
      kind: "single_choice",
      prompt: "What is the 30-pair (question, clause, relevant?) set used for?",
      choices: [
        { id: "a", text: "Training the query rewriter" },
        { id: "b", text: "Scoring the re-ranker now, and fine-tuning in Module 6" },
        { id: "c", text: "Replacing the evaluation set" },
        { id: "d", text: "Seeding the BM25 index" },
      ],
      answer: { choice: "b" },
      explanation: "It measures the re-ranker today and becomes training and test data next module.",
      difficulty: 2,
    },
  ],

  failure_cases: [
    {
      id: "m05-f01",
      order_index: 1,
      title: "The re-ranker that prefers long chunks",
      category: "ranking",
      user_query: "Can we share this with a subcontractor?",
      retrieved_context: [
        { source: "nda.pdf General Provisions (rank 1)", text: "Miscellaneous. This Agreement constitutes the entire agreement between the parties… [continues for several paragraphs]" },
        { source: "nda.pdf §4 Permitted Disclosure (rank 2)", text: "The Receiving Party may disclose Confidential Information to its affiliates and permitted recipients…" },
      ],
      bad_output: "A long, rambling general-provisions clause outranks the short, exact permitted-disclosure clause.",
      symptom: "Length wins over relevance in the re-ranked order.",
      root_cause: "The re-ranker is biased toward longer chunks with more overlapping words.",
      fix: "Keep chunk lengths consistent (trim in post-retrieval), and test the re-ranker on pairs of short vs long chunks in your 30-pair set.",
      cause_options: [
        { id: "a", text: "The re-ranker favours longer chunks" },
        { id: "b", text: "The BM25 index is missing for this contract" },
        { id: "c", text: "The query rewrite failed" },
      ],
      correct_cause: "a",
    },
    {
      id: "m05-f02",
      order_index: 2,
      title: "Fooled by a clause that quotes the question",
      category: "ranking",
      user_query: "Can we share this with a subcontractor?",
      retrieved_context: [
        { source: "nda.pdf Recitals (rank 1)", text: "WHEREAS the parties, together with their subcontractors, wish to explore a potential business relationship…" },
        { source: "nda.pdf §4 Permitted Disclosure (rank 2)", text: "The Receiving Party may disclose Confidential Information to its affiliates and permitted recipients…" },
      ],
      bad_output: "A recital that mentions \"subcontractors\" in passing ranks first, above the clause that actually governs disclosure.",
      symptom: "A clause that repeats the question's words outranks the clause that answers it.",
      root_cause: "The re-ranker matched surface words instead of the clause that answers the question.",
      fix: "Add tricky look-alike examples like this to the 30-pair set; if the off-the-shelf model keeps failing them, that is the case for Module 6's fine-tune.",
      cause_options: [
        { id: "a", text: "It matched surface words, not meaning" },
        { id: "b", text: "The deduper removed the clause that answers it" },
        { id: "c", text: "The score threshold was too low" },
      ],
      correct_cause: "a",
    },
    {
      id: "m05-f03",
      order_index: 3,
      title: "Re-ranking before de-duplication",
      category: "ranking",
      user_query: "Can we share this with a subcontractor?",
      retrieved_context: [
        { source: "nda.pdf §4 Permitted Disclosure (window 1)", text: "The Receiving Party may disclose Confidential Information to its affiliates…" },
        { source: "nda.pdf §4 Permitted Disclosure (window 2)", text: "…disclose Confidential Information to its affiliates and permitted recipients…" },
        { source: "nda.pdf §4 Permitted Disclosure (window 3)", text: "…affiliates and permitted recipients who are bound by obligations no less protective…" },
      ],
      bad_output: "The top 5 sent to generation contains the same clause three times, and the second relevant clause is missing.",
      symptom: "Copies of one clause fill the top slots; a different relevant clause never reaches generation.",
      root_cause: "The pipeline re-ranks before post-retrieval cleans, so duplicates fill the top slots.",
      fix: "Run post-retrieval (dedupe, filter, trim) before re-ranking, in the order the wiring diagram shows.",
      cause_options: [
        { id: "a", text: "Re-ranking ran before de-duplication" },
        { id: "b", text: "The cross-encoder model failed to load" },
        { id: "c", text: "The generation prompt is wrong" },
      ],
      correct_cause: "a",
    },
  ],
};

export default m05;
