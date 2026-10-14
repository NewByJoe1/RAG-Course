import type { ModuleContent } from "../types";

// Source: m04-post-retrieval.md (Week 3, lesson 1). Failure-case passages are
// short illustrative excerpts; the source names the clauses but not their text.

const m04: ModuleContent = {
  id: "m04",
  slug: "post-retrieval",
  order_index: 4,
  title: "Post-Retrieval",
  summary:
    "Retrieval is generous; post-retrieval is strict. It removes near-duplicate chunks, drops low-confidence ones, and trims each chunk to the sentences that matter. By the end, the context handed to the LLM is half the size and twice as relevant, with no duplicates and no low-confidence padding.",
  learning_objectives: [
    "Explain why more context can make answers worse, not better",
    "Apply the three cleaners in order: dedupe, score-filter, trim",
    "Choose a score threshold by finding the gap (elbow) in a score plot",
    "Decide at which stage a problem should be fixed, and justify why not elsewhere",
    "Ship a clean() step that logs before/after counts and hands about 10 chunks forward",
  ],
  estimated_minutes: 90,
  is_published: true,

  lesson_steps: [
    {
      id: "m04-s01",
      order_index: 1,
      kind: "exercise",
      title: "Warm-up recall",
      body_md: `Answer from memory before checking:

1. What does the router's difficulty label decide at generation time? (Module 2)
2. What does keyword search catch that vector search misses? (Module 3)
3. How does reciprocal rank fusion score a chunk? (Module 3)`,
    },
    {
      id: "m04-s02",
      order_index: 2,
      kind: "concept",
      title: "Why this matters",
      body_md: `Hybrid retrieval returns **20 chunks**. Three are the same clause from overlapping windows, five are boilerplate, and the LLM's answer gets worse as the pile grows.

Plot answer accuracy against context size and you'll see it: **more context, past a point, means worse answers**, and you pay for every extra token.`,
    },
    {
      id: "m04-s03",
      order_index: 3,
      kind: "concept",
      title: "Core idea: generous, then strict",
      body_md: `**Retrieval is generous; post-retrieval is strict.** Three cleaners, in this order:

1. **Dedupe** near-identical chunks.
2. **Score-filter:** drop anything below a score threshold.
3. **Trim** each chunk to the sentences that matter.

**Analogy:** a paralegal who removes the photocopies and highlights only the relevant lines.`,
    },
    {
      id: "m04-s04",
      order_index: 4,
      kind: "example",
      title: "Worked example",
      body_md: `Take the 20 raw chunks for the subcontractor question.

1. **Dedupe** by cosine similarity above 0.95: 20 → 14.
2. **Score-filter** below 0.3: 14 → 8.
3. **Trim** to the 2 most relevant sentences per chunk.

Answer quality rises; token cost falls **60%**.`,
    },
    {
      id: "m04-s05",
      order_index: 5,
      kind: "exercise",
      title: "Hands-on (three tiers)",
      body_md: `From this module on, practice is interleaved with earlier modules.

**Predict first:** write down how many of the 20 chunks you think will survive all three cleaners.

- **Guided:** apply the three cleaners in order to a supplied result set, and check the count at each step.
- **Partial:** pick the score threshold by plotting scores and finding the elbow. Hint: there is usually a gap.
- **Solo:** a query from Module 2 now returns duplicates because of query expansion. Fix it at the right stage, and justify why not elsewhere.

**Files you create:** \`prompts/compress.md\`.

**Capstone branch:** \`post-retrieval\`, with a \`clean()\` step that logs before/after counts.

**Check it with your assistant:** paste stage [3] from the wiring diagram and ask: "Does my post-retrieval branch de-duplicate, drop low-score chunks, and hand about 10 to the re-ranker?"`,
    },
    {
      id: "m04-s06",
      order_index: 6,
      kind: "exercise",
      title: "Failure gallery",
      body_md: `Diagnose the three broken outputs in this module's failure gallery and name the fix for each.`,
    },
    {
      id: "m04-s07",
      order_index: 7,
      kind: "reflection",
      title: "Exit quiz and reflection",
      body_md: `Take the quiz, then write one sentence on what still confuses you. It drives your spaced review.

**Say it in one sentence:** why is more context not always better?`,
    },
  ],

  quiz_items: [
    {
      id: "m04-q01",
      lesson_step_id: "m04-s03",
      order_index: 1,
      kind: "single_choice",
      prompt: "What is the job of post-retrieval?",
      choices: [
        { id: "a", text: "Find more chunks than retrieval did" },
        { id: "b", text: "Strictly clean the retrieved chunks: remove duplicates, low scores and irrelevant text" },
        { id: "c", text: "Rewrite the user's question" },
        { id: "d", text: "Generate the final answer" },
      ],
      answer: { choice: "b" },
      explanation: "Retrieval casts a wide net; post-retrieval throws back what doesn't belong.",
      difficulty: 1,
    },
    {
      id: "m04-q02",
      lesson_step_id: "m04-s02",
      order_index: 2,
      kind: "single_choice",
      prompt: "Why can more context make the LLM's answer worse?",
      choices: [
        { id: "a", text: "The LLM ignores everything after the first chunk" },
        { id: "b", text: "Duplicates and boilerplate dilute the relevant text, and cost rises with every token" },
        { id: "c", text: "Longer context always crashes the model" },
        { id: "d", text: "It can't; more context is always better" },
      ],
      answer: { choice: "b" },
      explanation: "Accuracy drops as the pile grows with noise, and you pay for every extra token.",
      difficulty: 1,
    },
    {
      id: "m04-q03",
      lesson_step_id: "m04-s04",
      order_index: 3,
      kind: "single_choice",
      prompt: "In the worked example, what was the de-duplication rule?",
      choices: [
        { id: "a", text: "Remove chunks with the same first word" },
        { id: "b", text: "Remove chunks with cosine similarity above 0.95 to one already kept" },
        { id: "c", text: "Remove every second chunk" },
        { id: "d", text: "Remove chunks shorter than 50 words" },
      ],
      answer: { choice: "b" },
      explanation: "Chunks that are near-identical are the same clause from overlapping windows.",
      difficulty: 1,
    },
    {
      id: "m04-q04",
      lesson_step_id: "m04-s05",
      order_index: 4,
      kind: "single_choice",
      prompt: "What is the best way to choose a score threshold?",
      choices: [
        { id: "a", text: "Always use 0.5" },
        { id: "b", text: "Plot the scores and look for the gap (elbow) between relevant and irrelevant chunks" },
        { id: "c", text: "Keep the top 3 regardless of score" },
        { id: "d", text: "Ask the LLM to pick a number" },
      ],
      answer: { choice: "b" },
      explanation: "There is usually a visible gap; the threshold belongs in it.",
      difficulty: 2,
    },
    {
      id: "m04-q05",
      lesson_step_id: "m04-s04",
      order_index: 5,
      kind: "single_choice",
      prompt: "In the worked example, which cleaner runs first?",
      choices: [
        { id: "a", text: "Trim" },
        { id: "b", text: "Score-filter" },
        { id: "c", text: "Dedupe" },
        { id: "d", text: "Re-rank" },
      ],
      answer: { choice: "c" },
      explanation: "Dedupe first, then score-filter, then trim, so later steps don't waste effort on copies.",
      difficulty: 1,
    },
    {
      id: "m04-q06",
      lesson_step_id: "m04-s05",
      order_index: 6,
      kind: "single_choice",
      prompt: "About how many chunks does post-retrieval hand to the re-ranker?",
      choices: [
        { id: "a", text: "1" },
        { id: "b", text: "About 10" },
        { id: "c", text: "About 40" },
        { id: "d", text: "All of them" },
      ],
      answer: { choice: "b" },
      explanation: "Retrieval returns about 40; post-retrieval narrows that to about 10 for the re-ranker.",
      difficulty: 2,
    },
    {
      id: "m04-q07",
      lesson_step_id: "m04-s05",
      order_index: 7,
      kind: "single_choice",
      prompt: "Module 2's query expansion now causes duplicate chunks. Where should you fix it?",
      choices: [
        { id: "a", text: "Remove query expansion entirely" },
        { id: "b", text: "In post-retrieval's dedupe step" },
        { id: "c", text: "In the generation prompt" },
        { id: "d", text: "By shrinking the index" },
      ],
      answer: { choice: "b" },
      explanation: "Expansion improves recall, so keep it; cleaning duplicates is post-retrieval's job.",
      difficulty: 3,
    },
  ],

  failure_cases: [
    {
      id: "m04-f01",
      order_index: 1,
      title: "The threshold that drops the gold clause",
      category: "retrieval_miss",
      user_query: "Can we share this with a subcontractor?",
      retrieved_context: [],
      bad_output: "After cleaning, the permitted-disclosure clause is gone, and the answer says \"The contract does not address this.\"",
      symptom: "A false refusal: the right clause was retrieved, then cleaned away.",
      root_cause: "The score threshold was set too high and cut the gold clause.",
      fix: "Re-plot the scores and set the threshold in the gap below the gold clause; check against several questions, not one.",
    },
    {
      id: "m04-f02",
      order_index: 2,
      title: "The trimmer that cuts mid-definition",
      category: "chunking",
      user_query: "Who counts as a Permitted Recipient?",
      retrieved_context: [
        { source: "nda.pdf §1 Definitions (trimmed)", text: "\"Permitted Recipient\" means any employee of" },
      ],
      bad_output: "The answer quotes \"'Permitted Recipient' means any employee of\" and stops, so the definition is incomplete and the answer is wrong.",
      symptom: "The answer quotes a definition that stops mid-sentence.",
      root_cause: "The trimmer cut the sentence partway through a definition.",
      fix: "Trim on whole-sentence boundaries, and never trim inside a definition.",
    },
    {
      id: "m04-f03",
      order_index: 3,
      title: "The deduper that merges two different clauses",
      category: "retrieval_miss",
      user_query: "Can we share this with our affiliates?",
      retrieved_context: [
        { source: "nda.pdf Confidentiality (employees)", text: "Confidentiality. The Receiving Party shall restrict access to Confidential Information to employees who need to know it…" },
      ],
      bad_output:
        "Two clauses both headed \"Confidentiality\" (one about employees, one about affiliates) are treated as duplicates, and the affiliates clause disappears.",
      symptom: "A relevant clause is missing because it looked like a duplicate.",
      root_cause: "The deduper compared headings or loose similarity instead of the full clause text.",
      fix: "Dedupe on full-text similarity at a strict threshold (above 0.95), and keep both chunks when their terms differ.",
    },
  ],
};

export default m04;
