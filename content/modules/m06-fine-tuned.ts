import type { ModuleContent } from "../types";

// Source: m06-fine-tuning.md (Week 4). The failure cases have no single user
// query, so user_query gives the evaluation context in parentheses.

const m06: ModuleContent = {
  id: "m06",
  slug: "fine-tuned",
  order_index: 6,
  title: "Fine-Tuning",
  summary:
    "Fine-tuning is expensive, slow to iterate, and goes stale when your contracts change. Retrieval fixes are cheap and instant. By the end, you have fine-tuned a small re-ranker on your own legal pairs, measured whether it beat the off-the-shelf one, and can state the rule for when fine-tuning is worth it.",
  learning_objectives: [
    "State the decision rule for when to fine-tune",
    "Explain why a held-out test set is required, and what leakage does to it",
    "Read a loss curve and say when training should have stopped",
    "Recognise overfitting when a model is tested on contracts it never saw",
    "Ship a swappable re-ranker with a flag for base or tuned, and the eval set checked in",
  ],
  estimated_minutes: 90,
  is_published: true,

  lesson_steps: [
    {
      id: "m06-s01",
      order_index: 1,
      kind: "exercise",
      title: "Warm-up recall",
      body_md: `Answer from memory before checking:

1. What is the difference between a bi-encoder and a cross-encoder? (Module 5)
2. Why should de-duplication happen before re-ranking? (Modules 4 and 5)
3. What did you build the 30-pair legal set for? (Module 5)`,
    },
    {
      id: "m06-s02",
      order_index: 2,
      kind: "concept",
      title: "Why this matters",
      body_md: `The question Module 5 flagged still ranks wrong. The generic re-ranker has never seen legal language.

Before touching weights, though, the demo tries one more retrieval fix, and it **half works**. That is the lesson.`,
    },
    {
      id: "m06-s03",
      order_index: 3,
      kind: "concept",
      title: "Core idea: when fine-tuning is worth it",
      body_md: `Fine-tuning is expensive, slow to iterate, and goes stale when your contracts change. Retrieval fixes are cheap and instant.

**Decision rule:** fine-tune only when
- you have **at least a few hundred labelled examples**,
- the failure is **systematic** rather than one-off, and
- you have **exhausted prompt and retrieval changes**.

**Analogy:** hiring a specialist versus giving your generalist a better filing system.`,
    },
    {
      id: "m06-s04",
      order_index: 4,
      kind: "example",
      title: "Worked example",
      body_md: `Fine-tune a MiniLM cross-encoder on **200 synthetic legal pairs plus the 30 hand-labelled ones**. Hold out **20%** as a test set.

Accuracy on held-out pairs goes from **71% to 84%**. Then test it on employment contracts it never saw: it drops to **68%**. That's overfitting, named and measured.`,
    },
    {
      id: "m06-s05",
      order_index: 5,
      kind: "exercise",
      title: "Hands-on (three tiers)",
      body_md: `**Predict first:** write down how many points you think fine-tuning will add on held-out pairs.

- **Guided:** run the fine-tuning notebook; read the loss curve and say when training should have stopped.
- **Partial:** generate 100 more pairs from your team's past questions with an LLM; retrain; compare.
- **Solo:** fine-tune the query expander instead of the re-ranker and argue, with numbers, which was the better investment.

**Files you create:** \`train/pairs.jsonl\`, \`models/reranker-v2/\`, and the re-ranker path in \`config/models.yaml\`.

**Capstone branch:** \`fine-tuned\`, with a swappable re-ranker, a flag to use base or tuned, and the eval set checked in.

**Check it with your assistant:** paste stage [4] and the Fine-tuning section of the wiring diagram and ask: "Does my fine-tuned branch hold out a test set, keep the base and tuned re-rankers behind one flag in config/models.yaml, and commit the eval results for both?"`,
    },
    {
      id: "m06-s06",
      order_index: 6,
      kind: "exercise",
      title: "Failure gallery",
      body_md: `Diagnose the three broken outputs in this module's failure gallery and name the fix for each.`,
    },
    {
      id: "m06-s07",
      order_index: 7,
      kind: "reflection",
      title: "Exit quiz and reflection",
      body_md: `Take the quiz, then write one sentence on what still confuses you. It drives your spaced review.

**Say it in one sentence:** when is fine-tuning worth it, and when is a retrieval fix the better investment?`,
    },
  ],

  quiz_items: [
    {
      id: "m06-q01",
      lesson_step_id: "m06-s03",
      order_index: 1,
      kind: "single_choice",
      prompt: "Why try a retrieval fix before fine-tuning?",
      choices: [
        { id: "a", text: "Fine-tuning never improves accuracy on legal text" },
        { id: "b", text: "Retrieval fixes are cheap and instant; fine-tuning is slow, costly and goes stale" },
        { id: "c", text: "Retrieval fixes are permanent, but fine-tunes are deleted after a month" },
        { id: "d", text: "The re-ranker cannot be changed once it is installed" },
      ],
      answer: { choice: "b" },
      explanation: "Exhaust the cheap fixes first; fine-tune only when they run out.",
      difficulty: 1,
    },
    {
      id: "m06-q02",
      lesson_step_id: "m06-s03",
      order_index: 2,
      kind: "single_choice",
      prompt: "Which of these is NOT part of the decision rule for fine-tuning?",
      choices: [
        { id: "a", text: "You have at least a few hundred labelled examples" },
        { id: "b", text: "The failure is systematic, not one-off" },
        { id: "c", text: "One important question still ranks wrong" },
        { id: "d", text: "You have exhausted prompt and retrieval changes" },
      ],
      answer: { choice: "c" },
      explanation: "A single failing question is a one-off; it does not justify fine-tuning on its own.",
      difficulty: 2,
    },
    {
      id: "m06-q03",
      lesson_step_id: "m06-s04",
      order_index: 3,
      kind: "single_choice",
      prompt: "Why hold out 20% of the pairs as a test set?",
      choices: [
        { id: "a", text: "To train faster on less data" },
        { id: "b", text: "To measure the model on examples it never trained on" },
        { id: "c", text: "To save the best pairs for Module 11" },
        { id: "d", text: "Because the notebook only accepts 80% of the data" },
      ],
      answer: { choice: "b" },
      explanation: "Scoring on training examples only tells you what the model memorised.",
      difficulty: 1,
    },
    {
      id: "m06-q04",
      lesson_step_id: "m06-s04",
      order_index: 4,
      kind: "single_choice",
      prompt: "The tuned model scores 84% on held-out pairs but 68% on employment contracts it never saw. What does that show?",
      choices: [
        { id: "a", text: "The employment contracts were labelled wrongly" },
        { id: "b", text: "Overfitting: it learned the training contracts, not legal relevance in general" },
        { id: "c", text: "The base model was better at everything" },
        { id: "d", text: "The test set was too large" },
      ],
      answer: { choice: "b" },
      explanation: "A big drop on unseen contract types is the signature of overfitting.",
      difficulty: 2,
    },
    {
      id: "m06-q05",
      lesson_step_id: "m06-s05",
      order_index: 5,
      kind: "single_choice",
      prompt: "Reading a loss curve, when should training have stopped?",
      choices: [
        { id: "a", text: "When training loss reaches zero" },
        { id: "b", text: "When the test (validation) loss stops falling and starts to rise" },
        { id: "c", text: "After exactly 10 epochs" },
        { id: "d", text: "When the GPU gets hot" },
      ],
      answer: { choice: "b" },
      explanation: "After that point the model is memorising, not learning.",
      difficulty: 2,
    },
    {
      id: "m06-q06",
      lesson_step_id: "m06-s06",
      order_index: 6,
      kind: "single_choice",
      prompt: "Some test pairs also appear in the training data. What happens to the test score?",
      choices: [
        { id: "a", text: "It looks better than the model really is" },
        { id: "b", text: "It drops to zero" },
        { id: "c", text: "Nothing; duplicates are ignored" },
        { id: "d", text: "It becomes more accurate" },
      ],
      answer: { choice: "a" },
      explanation: "Leakage lets the model \"remember\" test answers, so the score overstates real performance.",
      difficulty: 2,
    },
    {
      id: "m06-q07",
      lesson_step_id: "m06-s05",
      order_index: 7,
      kind: "single_choice",
      prompt: "What does the flag on the fine-tuned branch do?",
      choices: [
        { id: "a", text: "Deletes the base model after training" },
        { id: "b", text: "Switches between the base and the tuned re-ranker" },
        { id: "c", text: "Turns fine-tuning on during every query" },
        { id: "d", text: "Retrains the model every night" },
      ],
      answer: { choice: "b" },
      explanation: "A flag lets you compare both models on the eval set and roll back instantly.",
      difficulty: 1,
    },
  ],

  failure_cases: [
    {
      id: "m06-f01",
      order_index: 1,
      title: "The model that memorised",
      category: "ranking",
      user_query: "(Evaluation: new questions from the team)",
      retrieved_context: [],
      bad_output: "The tuned re-ranker scores 99% on its training pairs but 62% on new questions from the team.",
      symptom: "Near-perfect on training data, poor on anything new.",
      root_cause: "It memorised the training pairs.",
      fix: "Train for fewer epochs, stop when the held-out loss stops falling, and add more varied pairs.",
      cause_options: [
        { id: "a", text: "The learning rate was far too low to learn anything" },
        { id: "b", text: "It memorised the training pairs" },
        { id: "c", text: "The base model can't read legal text at all" },
      ],
      correct_cause: "b",
    },
    {
      id: "m06-f02",
      order_index: 2,
      title: "The leaky test set",
      category: "evaluation",
      user_query: "(Evaluation: held-out test pairs)",
      retrieved_context: [],
      bad_output: "The test score jumps to 97%, but users see no improvement. Forty of the test pairs also appear in the training file.",
      symptom: "A big jump on the test score that users never feel.",
      root_cause: "Test pairs also appeared in training.",
      fix: "Split the pairs before generating or augmenting anything, de-duplicate across the split, and check no test pair appears in training.",
      cause_options: [
        { id: "a", text: "The test set was too small to measure anything" },
        { id: "b", text: "The model was trained for too few epochs" },
        { id: "c", text: "Test pairs also appeared in training" },
      ],
      correct_cause: "c",
    },
    {
      id: "m06-f03",
      order_index: 3,
      title: "Better metric, worse answers",
      category: "evaluation",
      user_query: "(Evaluation: held-out pairs vs lawyers' feedback)",
      retrieved_context: [],
      bad_output:
        "Held-out accuracy rises 9 points, but lawyers say the answers got worse. The tuned model favours clauses that repeat the question's words.",
      symptom: "The metric improves while the people using it say it got worse.",
      root_cause: "The metric didn't reflect real questions.",
      fix: "Score the tuned model on real team questions and the full pipeline eval, not just held-out pairs; keep the base model behind the flag until both improve.",
      cause_options: [
        { id: "a", text: "The metric didn't reflect real questions" },
        { id: "b", text: "The generation prompt was changed at the same time" },
        { id: "c", text: "The re-ranker flag was still set to the base model" },
      ],
      correct_cause: "a",
    },
  ],
};

export default m06;
