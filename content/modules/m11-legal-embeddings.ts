import type { ModuleContent } from "../types";

// Source: m11-legal-datasets.md (Week 7, lesson 2). Where a failure case has no
// single user query, user_query gives the evaluation context in parentheses.

const m11: ModuleContent = {
  id: "m11",
  slug: "legal-embeddings",
  order_index: 11,
  title: "Datasets and Fine-Tuning for Legal Citations",
  summary:
    "Module 6 fine-tuned a re-ranker on about 230 pairs. Here there are thousands of expert labels, enough to train the embedding model itself, which improves every stage downstream. By the end, you have fine-tuned a small embedding model on legal data and lifted recall@3 on the eval set, using public benchmarks to prove it wasn't luck.",
  learning_objectives: [
    "Explain contrastive fine-tuning and why hard negatives are the whole trick",
    "Name the three public datasets (CUAD, ACORD, ContractNLI) and what each is for",
    "Generate synthetic questions and mine hard negatives without leaking answers",
    "Prove a fine-tune generalised with a held-out benchmark, and check negation didn't get worse",
    "Re-index after training so old and new vectors never mix",
  ],
  estimated_minutes: 90,
  is_published: true,

  lesson_steps: [
    {
      id: "m11-s01",
      order_index: 1,
      kind: "exercise",
      title: "Warm-up recall",
      body_md: `Answer from memory before checking:

1. When is fine-tuning worth it? (Module 6)
2. What does test-set leakage do to a score? (Module 6)
3. What are the four things in a domain pack? (Module 10)`,
    },
    {
      id: "m11-s02",
      order_index: 2,
      kind: "concept",
      title: "Why this matters",
      body_md: `Module 6 fine-tuned a re-ranker on **230 pairs**. Here you have **thousands of expert labels** and can train the **embedding model itself**, which moves every stage downstream.`,
    },
    {
      id: "m11-s03",
      order_index: 3,
      kind: "concept",
      title: "Core idea: contrastive fine-tuning",
      body_md: `**Contrastive fine-tuning** teaches an embedding model that a question and its gold clause belong together, and that a plausible-looking wrong clause (a **hard negative**) does not.

**Hard negatives are the whole trick:** easy negatives teach nothing.

**The datasets:**

- **CUAD:** 510 contracts, about 13,000 labelled spans, 41 clause categories. The backbone of the training set.
- **ACORD:** an expert-annotated clause-retrieval benchmark. The held-out test that proves the fine-tune generalised.
- **ContractNLI:** 607 NDAs with 17 hypotheses, labelled entailed, contradicted or not mentioned. Checks that negation still matters.`,
    },
    {
      id: "m11-s04",
      order_index: 4,
      kind: "example",
      title: "Worked example",
      body_md: `1. Generate **2,000 synthetic questions** from CUAD spans with an LLM.
2. **Mine hard negatives:** for each question, the top-5 retrieved clauses that are not the gold span.
3. Fine-tune a small embedding model (bge-small or similar) with a **contrastive loss for 3 epochs**.
4. Recall@3 rises on **ACORD** and on the **course eval set**.
5. Confirm with **ContractNLI** that negation handling didn't get worse.
6. **Re-index everything** with the new model.`,
    },
    {
      id: "m11-s05",
      order_index: 5,
      kind: "exercise",
      title: "Hands-on (three tiers)",
      body_md: `**Predict first:** write down how many points you expect recall@3 to rise on ACORD.

- **Guided:** run the data-prep notebook; inspect 10 hard negatives and say why each is hard.
- **Partial:** change the hard-negative strategy (random vs top-k vs same-category); compare.
- **Solo:** fine-tune on CUAD only, test on ACORD, and write 200 words on what transferred and what did not.

**Files you create:** \`data/cuad/\`, \`data/contractnli/\`, an updated \`train/pairs.jsonl\`, and \`models/embedder-v2/\` (legal).

**Capstone branch:** \`legal-embeddings\`, with the fine-tuned model behind a flag and both eval results committed.

**Check it with your assistant:** paste the Fine-tuning section of the wiring diagram and ask: "Does my legal-embeddings branch build train/pairs.jsonl from CUAD and ContractNLI with hard negatives, hold out a slice, and re-index after training?"`,
    },
    {
      id: "m11-s06",
      order_index: 6,
      kind: "exercise",
      title: "Failure gallery",
      body_md: `Diagnose the three broken outputs in this module's failure gallery and name the fix for each.`,
    },
    {
      id: "m11-s07",
      order_index: 7,
      kind: "reflection",
      title: "Exit quiz and reflection",
      body_md: `Take the quiz, then write one sentence on what still confuses you. It drives your spaced review.

**Say it in one sentence:** why does a hard negative teach the model more than an easy one?`,
    },
  ],

  quiz_items: [
    {
      id: "m11-q01",
      lesson_step_id: "m11-s03",
      order_index: 1,
      kind: "single_choice",
      prompt: "What does contrastive fine-tuning teach an embedding model?",
      choices: [
        { id: "a", text: "To write better answers" },
        { id: "b", text: "That a question and its gold clause belong together, and a plausible wrong clause does not" },
        { id: "c", text: "To read PDFs faster" },
        { id: "d", text: "To translate contracts into plain English" },
      ],
      answer: { choice: "b" },
      explanation: "It pulls matching pairs together in vector space and pushes look-alikes apart.",
      difficulty: 1,
    },
    {
      id: "m11-q02",
      lesson_step_id: "m11-s03",
      order_index: 2,
      kind: "single_choice",
      prompt: "Why does a hard negative teach more than an easy one?",
      choices: [
        { id: "a", text: "Hard negatives are longer" },
        { id: "b", text: "It looks right but isn't, so the model must learn the real difference" },
        { id: "c", text: "Easy negatives are never wrong" },
        { id: "d", text: "Hard negatives come from a different contract type" },
      ],
      answer: { choice: "b" },
      explanation: "The model already rejects obviously unrelated clauses; it learns from the near-misses.",
      difficulty: 2,
    },
    {
      id: "m11-q03",
      lesson_step_id: "m11-s03",
      order_index: 3,
      kind: "single_choice",
      prompt: "Which dataset is the held-out test that proves the fine-tune generalised?",
      choices: [
        { id: "a", text: "CUAD" },
        { id: "b", text: "ACORD" },
        { id: "c", text: "ContractNLI" },
        { id: "d", text: "The course NDA" },
      ],
      answer: { choice: "b" },
      explanation: "Training on CUAD and testing on ACORD shows the gain wasn't just memorising CUAD.",
      difficulty: 2,
    },
    {
      id: "m11-q04",
      lesson_step_id: "m11-s03",
      order_index: 4,
      kind: "single_choice",
      prompt: "What is ContractNLI used for in this module?",
      choices: [
        { id: "a", text: "Checking that negation handling didn't get worse" },
        { id: "b", text: "Generating synthetic questions" },
        { id: "c", text: "Storing the vector index" },
        { id: "d", text: "Training the re-ranker" },
      ],
      answer: { choice: "a" },
      explanation: "Its entailed/contradicted labels catch a model that stops noticing \"not\" and \"except\".",
      difficulty: 2,
    },
    {
      id: "m11-q05",
      lesson_step_id: "m11-s04",
      order_index: 5,
      kind: "single_choice",
      prompt: "How are hard negatives mined in the worked example?",
      choices: [
        { id: "a", text: "Picked at random from any contract" },
        { id: "b", text: "The top-5 retrieved clauses for a question that are not the gold span" },
        { id: "c", text: "Written by hand by a lawyer" },
        { id: "d", text: "Copied from the golden set's ideal answers" },
      ],
      answer: { choice: "b" },
      explanation: "The retriever's own near-misses are, by definition, the clauses it confuses.",
      difficulty: 2,
    },
    {
      id: "m11-q06",
      lesson_step_id: "m11-s04",
      order_index: 6,
      kind: "single_choice",
      prompt: "Why must you re-index after training the embedder?",
      choices: [
        { id: "a", text: "To free up disk space" },
        { id: "b", text: "So every stored vector comes from the new model; old and new must never mix" },
        { id: "c", text: "Because training deletes the index" },
        { id: "d", text: "Re-indexing isn't needed" },
      ],
      answer: { choice: "b" },
      explanation: "Vectors from two different models aren't comparable, so mixing them breaks search.",
      difficulty: 2,
    },
    {
      id: "m11-q07",
      lesson_step_id: "m11-s02",
      order_index: 7,
      kind: "single_choice",
      prompt: "Why does fine-tuning the embedder help more than tuning the re-ranker did?",
      choices: [
        { id: "a", text: "The embedder is bigger" },
        { id: "b", text: "It improves retrieval itself, so every downstream stage starts from better candidates" },
        { id: "c", text: "Re-rankers can't be fine-tuned" },
        { id: "d", text: "It removes the need for a golden set" },
      ],
      answer: { choice: "b" },
      explanation: "If the right clause is retrieved earlier, post-retrieval and re-ranking both have more to work with.",
      difficulty: 3,
    },
  ],

  failure_cases: [
    {
      id: "m11-f01",
      order_index: 1,
      title: "The negative that was actually right",
      category: "ranking",
      user_query: "Can we share this with a subcontractor?",
      retrieved_context: [],
      bad_output:
        "After training, the model ranks the permitted-disclosure clause lower for the subcontractor question. In the training data, that clause was marked as a hard negative for a near-identical question.",
      symptom: "Training made the right clause rank worse.",
      root_cause: "The hard negative was a correct answer.",
      fix: "Check mined negatives against the gold labels, drop any that also answer the question, and spot-check a sample by hand.",
      cause_options: [
        { id: "a", text: "The contrastive loss was the wrong type" },
        { id: "b", text: "The hard negative was a correct answer" },
        { id: "c", text: "Too few epochs were run in training" },
      ],
      correct_cause: "b",
    },
    {
      id: "m11-f02",
      order_index: 2,
      title: "The leaky synthetic question",
      category: "evaluation",
      user_query: "(Evaluation: synthetic questions vs real team questions)",
      retrieved_context: [],
      bad_output:
        "Recall@3 on the synthetic questions is 99%, but recall on real team questions doesn't move. The synthetic questions repeat the clause's exact wording.",
      symptom: "A near-perfect score on synthetic data, no gain on real questions.",
      root_cause: "Questions copied the clause's wording.",
      fix: "Tell the question generator to write as a non-lawyer would, and reject any question that shares a long phrase with its source clause.",
      cause_options: [
        { id: "a", text: "The ACORD benchmark was far too difficult" },
        { id: "b", text: "The base model was too small to learn" },
        { id: "c", text: "Questions copied the clause's wording" },
      ],
      correct_cause: "c",
    },
    {
      id: "m11-f03",
      order_index: 3,
      title: "Wins the benchmark, loses at home",
      category: "evaluation",
      user_query: "(Evaluation: ACORD vs the course eval set)",
      retrieved_context: [],
      bad_output: "Recall@3 on ACORD rises 12 points, but recall@3 on the course eval set drops 4 points.",
      symptom: "The benchmark improves while your own eval gets worse.",
      root_cause: "It fit the benchmark, not your contracts.",
      fix: "Add pairs from your own golden set (never the held-out slice) to training, and require both ACORD and your eval set to improve before switching the flag.",
      cause_options: [
        { id: "a", text: "It fit the benchmark, not your contracts" },
        { id: "b", text: "ACORD test pairs were leaked into training" },
        { id: "c", text: "The judge prompt changed at the same time" },
      ],
      correct_cause: "a",
    },
  ],
};

export default m11;
