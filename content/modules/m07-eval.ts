import type { ModuleContent } from "../types";

// Source: m07-refinement.md (Week 5, lesson 1). Where a failure case has no
// single user query, user_query gives the evaluation context in parentheses.

const m07: ModuleContent = {
  id: "m07",
  slug: "eval",
  order_index: 7,
  title: "Refinement",
  summary:
    "Every change so far was judged on one question. In RAG there are two things to measure separately: did the right clause get retrieved, and did the answer use it faithfully. By the end, you have a 50-question evaluation set with gold clauses, a script that scores the pipeline in under a minute, and a feedback button whose clicks land in that set.",
  learning_objectives: [
    "Measure retrieval (recall@k, MRR) separately from answer quality (groundedness, citation accuracy)",
    "Explain why judging changes on one question is dangerous",
    "Build a golden set from public data plus sessions with real users, covering nine question types",
    "Report accuracy per routing label, not just one overall number",
    "Capture thumbs-down feedback as new eval rows",
  ],
  estimated_minutes: 90,
  is_published: true,

  lesson_steps: [
    {
      id: "m07-s01",
      order_index: 1,
      kind: "exercise",
      title: "Warm-up recall",
      body_md: `Answer from memory before checking:

1. What three labels does the router give a question? (Module 2)
2. What is the decision rule for fine-tuning? (Module 6)
3. Why is a held-out test set required? (Module 6)`,
    },
    {
      id: "m07-s02",
      order_index: 2,
      kind: "concept",
      title: "Why this matters",
      body_md: `Every change so far was judged on **one question**.

The demo shows a change that fixed the subcontractor question and **silently broke four others**.`,
    },
    {
      id: "m07-s03",
      order_index: 3,
      kind: "concept",
      title: "Core idea: measure two things separately",
      body_md: `You cannot improve what you do not measure. In RAG, measure two things **separately**:

- **Retrieval:** did the right clause get retrieved? (recall@k, MRR)
- **Answer quality:** did the answer use it faithfully? (groundedness, citation accuracy)

**Feedback capture** turns every user correction into a new test case.

**Analogy:** a pilot's checklist plus a flight recorder.`,
    },
    {
      id: "m07-s04",
      order_index: 4,
      kind: "example",
      title: "Worked example",
      body_md: `Build the eval set from **30 team questions plus 20 generated ones**. Run the pipeline and score **recall@3** and **citation accuracy**. Make one change, re-run, and read the diff. Then add a thumbs-down handler that writes the question and the expected clause to the set.

**Lesson 7.3: the golden set with a real person**

Half of \`eval/golden.jsonl\` comes from **CUAD and ContractNLI** on day one. The other half comes from **30-minute sessions with real users** (8 to 12 questions per contract, 20 contracts).

Cover **nine question types**: permission, obligation, restriction, duration, money, definition-dependent, conflict, absence, and paraphrase pairs.

At least **one in ten** answers must be "the contract does not say", and at least **one in ten** an honest "it depends".`,
    },
    {
      id: "m07-s05",
      order_index: 5,
      kind: "exercise",
      title: "Hands-on (three tiers)",
      body_md: `**Predict first:** which of the nine question types will your system score worst on? Write it down before you run.

- **Guided:** run the eval script on the current pipeline; identify the 5 worst questions.
- **Partial:** fix the worst one by changing only one stage; show the others did not regress.
- **Solo:** design an LLM-as-judge prompt for groundedness and calibrate it against 10 hand-graded answers.

**Files you create:** \`eval/golden.jsonl\`, \`eval/results.json\`, \`prompts/judge_citation.md\`, \`prompts/judge_groundedness.md\`.

**Capstone branch:** \`eval\`, with \`evaluate.py\` and a results table committed on every change.

**Check it with your assistant:** paste stage [6] Evaluation from the wiring diagram and ask: "Does my eval branch read eval/golden.jsonl, compute recall@3, citation accuracy and groundedness, and report each per routing label?"`,
    },
    {
      id: "m07-s06",
      order_index: 6,
      kind: "exercise",
      title: "Failure gallery",
      body_md: `Diagnose the three broken outputs in this module's failure gallery and name the fix for each.`,
    },
    {
      id: "m07-s07",
      order_index: 7,
      kind: "reflection",
      title: "Exit quiz and reflection",
      body_md: `Take the quiz, then write one sentence on what still confuses you. It drives your spaced review.

**Say it in one sentence:** why do we report accuracy per routing label and not just one overall number?`,
    },
  ],

  quiz_items: [
    {
      id: "m07-q01",
      lesson_step_id: "m07-s03",
      order_index: 1,
      kind: "single_choice",
      prompt: "Which two things does RAG evaluation measure separately?",
      choices: [
        { id: "a", text: "Speed and cost" },
        { id: "b", text: "Whether the right clause was retrieved, and whether the answer used it faithfully" },
        { id: "c", text: "Prompt length and model size" },
        { id: "d", text: "Number of users and number of contracts" },
      ],
      answer: { choice: "b" },
      explanation: "A good answer needs both: the right clause found, and an answer grounded in it.",
      difficulty: 1,
    },
    {
      id: "m07-q02",
      lesson_step_id: "m07-s03",
      order_index: 2,
      kind: "single_choice",
      prompt: "What does recall@3 measure?",
      choices: [
        { id: "a", text: "The share of questions whose gold clause appears in the top 3 results" },
        { id: "b", text: "How fast the top 3 results are returned" },
        { id: "c", text: "How many words the answer has" },
        { id: "d", text: "The share of answers users liked" },
      ],
      answer: { choice: "a" },
      explanation: "It is the retrieval score: did the right clause make the top 3?",
      difficulty: 1,
    },
    {
      id: "m07-q03",
      lesson_step_id: "m07-s02",
      order_index: 3,
      kind: "single_choice",
      prompt: "Why is judging a change on one question dangerous?",
      choices: [
        { id: "a", text: "One question takes too long to run" },
        { id: "b", text: "A fix for one question can silently break others" },
        { id: "c", text: "The LLM refuses single questions" },
        { id: "d", text: "It isn't; one good question is enough" },
      ],
      answer: { choice: "b" },
      explanation: "Only a full eval set shows what a change broke elsewhere.",
      difficulty: 1,
    },
    {
      id: "m07-q04",
      lesson_step_id: "m07-s04",
      order_index: 4,
      kind: "single_choice",
      prompt: "Why does half the golden set come from CUAD and ContractNLI on day one?",
      choices: [
        { id: "a", text: "So you are never testing against nothing while user sessions are scheduled" },
        { id: "b", text: "Because public data is always better than user questions" },
        { id: "c", text: "To avoid talking to users" },
        { id: "d", text: "Because the eval script needs exactly 25 public questions" },
      ],
      answer: { choice: "a" },
      explanation: "Public data gives an immediate baseline; real users supply the questions that matter most.",
      difficulty: 2,
    },
    {
      id: "m07-q05",
      lesson_step_id: "m07-s04",
      order_index: 5,
      kind: "single_choice",
      prompt: "Why must at least one in ten golden questions have the answer \"the contract does not say\"?",
      choices: [
        { id: "a", text: "To make the set longer" },
        { id: "b", text: "To test that the system refuses instead of guessing" },
        { id: "c", text: "Because one in ten contracts is blank" },
        { id: "d", text: "To lower the overall score on purpose" },
      ],
      answer: { choice: "b" },
      explanation: "A system that never has to say \"not addressed\" will learn to invent answers.",
      difficulty: 2,
    },
    {
      id: "m07-q06",
      lesson_step_id: "m07-s04",
      order_index: 6,
      kind: "single_choice",
      prompt: "What should the thumbs-down handler do?",
      choices: [
        { id: "a", text: "Delete the answer from the logs" },
        { id: "b", text: "Write the question and the expected clause into the eval set" },
        { id: "c", text: "Retrain the model immediately" },
        { id: "d", text: "Email the user an apology" },
      ],
      answer: { choice: "b" },
      explanation: "Every correction becomes a permanent test case.",
      difficulty: 1,
    },
    {
      id: "m07-q07",
      lesson_step_id: "m07-s07",
      order_index: 7,
      kind: "single_choice",
      prompt: "Why report accuracy per routing label, not just one overall number?",
      choices: [
        { id: "a", text: "An overall number can hide one weak tier" },
        { id: "b", text: "Labels make the report shorter" },
        { id: "c", text: "The routing label changes the gold clause" },
        { id: "d", text: "Overall numbers are always wrong" },
      ],
      answer: { choice: "a" },
      explanation: "If \"conflicting\" questions fail, the average can still look fine.",
      difficulty: 2,
    },
  ],

  failure_cases: [
    {
      id: "m07-f01",
      order_index: 1,
      title: "The leaked answer",
      category: "evaluation",
      user_query: "Does Section 4.2(b), which allows disclosure to permitted recipients, allow sharing with a subcontractor?",
      retrieved_context: [],
      bad_output:
        "An eval question reads, \"Does Section 4.2(b), which allows disclosure to permitted recipients, allow sharing with a subcontractor?\" Recall@3 on the set is 100%.",
      symptom: "A perfect score that says nothing about real questions.",
      root_cause: "The question gives away the clause.",
      fix: "Rewrite eval questions in the user's own words, never quoting the clause or its section number unless the question is about the number itself.",
      cause_options: [
        { id: "a", text: "The judge prompt is too lenient on citations" },
        { id: "b", text: "The question gives away the clause" },
        { id: "c", text: "The eval set has too few questions in it" },
      ],
      correct_cause: "b",
    },
    {
      id: "m07-f02",
      order_index: 2,
      title: "The judge that loves long answers",
      category: "evaluation",
      user_query: "(Evaluation: LLM judge scoring answers)",
      retrieved_context: [],
      bad_output: "The LLM judge scores a rambling five-paragraph answer 9/10 and a correct, cited one-line answer 6/10.",
      symptom: "The judge prefers the worse answer.",
      root_cause: "The judge rewards length.",
      fix: "Tell the judge to score only groundedness and citation, not length; calibrate it against hand-graded answers that include short correct ones.",
      cause_options: [
        { id: "a", text: "The golden set has the wrong gold clause for it" },
        { id: "b", text: "Recall@3 was computed on the wrong eval set" },
        { id: "c", text: "The judge rewards length" },
      ],
      correct_cause: "c",
    },
    {
      id: "m07-f03",
      order_index: 3,
      title: "Better score, angrier users",
      category: "evaluation",
      user_query: "(Evaluation: a month of scores vs thumbs-down clicks)",
      retrieved_context: [],
      bad_output: "Groundedness rises from 0.82 to 0.90 over a month, while thumbs-down clicks double.",
      symptom: "The eval score and user satisfaction move in opposite directions.",
      root_cause: "The eval set no longer matches real questions.",
      fix: "Feed thumbs-down questions into the golden set, and refresh it with new user sessions so it tracks what people actually ask.",
      cause_options: [
        { id: "a", text: "The eval set no longer matches real questions" },
        { id: "b", text: "Users started clicking thumbs-down by mistake" },
        { id: "c", text: "The nightly job reported last week's numbers" },
      ],
      correct_cause: "a",
    },
  ],
};

export default m07;
