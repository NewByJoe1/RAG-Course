import type { ModuleContent } from "../types";

// Source: m09-production-harness.md (Week 6). The failure cases have no single
// user query, so user_query gives the harness context in parentheses.

const m09: ModuleContent = {
  id: "m09",
  slug: "harness",
  order_index: 9,
  title: "Production Harness",
  summary:
    "A pipeline that works for one person falls over under real load, and can leak one client's contract into another's answer. Both are fixed by structure, not cleverness. By the end, the pipeline sits behind an API, runs in isolated workers, refuses to answer without a verified citation, and can be switched off in one command.",
  learning_objectives: [
    "Name the parts of a production harness and what each protects against",
    "Explain why tenant isolation belongs in the database, not the prompt",
    "Build a citation-verification gate and a hallucination check that block bad answers",
    "Version every prompt so any answer can be traced to the exact prompt that produced it",
    "Explain why the kill switch fails closed, and why only a human turns it back on",
  ],
  estimated_minutes: 90,
  is_published: true,

  lesson_steps: [
    {
      id: "m09-s01",
      order_index: 1,
      kind: "exercise",
      title: "Warm-up recall",
      body_md: `Answer from memory before checking:

1. What is a canary set, and when does it run? (Module 8)
2. Why track cost per query alongside quality? (Module 8)
3. What should the generation prompt say when the chunks don't answer the question? (Module 1)`,
    },
    {
      id: "m09-s02",
      order_index: 2,
      kind: "concept",
      title: "Why this matters",
      body_md: `The demo sends **50 simultaneous questions** at the Module 8 script. It falls over, and **one tenant's contract leaks into another's answer**.

Both are fixed by structure, not by cleverness.`,
    },
    {
      id: "m09-s03",
      order_index: 3,
      kind: "concept",
      title: "Core idea: the harness around the model",
      body_md: `The harness is everything around the model that makes it safe to depend on:

- a **gateway** that authenticates and rate-limits,
- a **queue** that smooths load,
- **workers** that cannot see each other's data,
- **gates** that block bad answers before they ship, and
- a **kill switch**.

**Analogy:** the airport, not the aeroplane.`,
    },
    {
      id: "m09-s04",
      order_index: 4,
      kind: "example",
      title: "Worked example",
      body_md: `1. Add an **API gateway**, a **job queue** and **one worker per tenant**.
2. Add two gates:
   - **Citation verification:** does the quoted clause exist verbatim in the source?
   - **Hallucination check:** does the answer make a claim the clause does not support?
3. **Version every prompt** with a hash.
4. Add a **fallback** that returns "I could not find a supporting clause" plus the top 3 chunks when a gate fails.
5. Add a **flag that disables generation** entirely.

**Lesson 9.3: guardrails that fail closed**

- **Tenant isolation** lives in the retrieval layer as row-level security, so a query can never see another client's chunks, even if the application code has a bug.
- A **refusal check** runs after generation and blocks anything that cites a clause not in the chunks.
- The **kill switch**, \`serving.enabled\` in \`config/flags.yaml\`, is flipped off automatically when the nightly eval drops below threshold, but **only a human can flip it back on**.

The rule for all three: **when in doubt, refuse.**`,
    },
    {
      id: "m09-s05",
      order_index: 5,
      kind: "exercise",
      title: "Hands-on (three tiers)",
      body_md: `**Predict first:** write down how many of 50 concurrent requests you think the Module 8 script will survive.

- **Guided:** deploy the supplied harness locally; send 50 concurrent requests; confirm isolation.
- **Partial:** write the citation-verification gate. Hint: exact substring match first, then fuzzy.
- **Solo:** design per-tenant isolation so one tenant's fine-tuned re-ranker is never used for another; show a test that proves it.

**Files you create:** \`config/flags.yaml\`, a gateway with RLS policies, and a refusal-check prompt.

**Capstone branch:** \`harness\`, with a gateway, queue, workers, two gates, versioned prompts, a kill switch and a fallback path.

**Check it with your assistant:** paste the Guardrails section of the wiring diagram and ask: "Does my harness branch enforce tenant isolation in the database, run the refusal check after generation, and read the kill switch from config/flags.yaml?"`,
    },
    {
      id: "m09-s06",
      order_index: 6,
      kind: "exercise",
      title: "Failure gallery",
      body_md: `Diagnose the three broken outputs in this module's failure gallery and name the fix for each.`,
    },
    {
      id: "m09-s07",
      order_index: 7,
      kind: "reflection",
      title: "Exit quiz and reflection",
      body_md: `Take the quiz, then write one sentence on what still confuses you. It drives your spaced review.

**Say it in one sentence:** why can a machine turn the kill switch off but only a human turn it on?`,
    },
  ],

  quiz_items: [
    {
      id: "m09-q01",
      lesson_step_id: "m09-s03",
      order_index: 1,
      kind: "single_choice",
      prompt: "What is the production harness?",
      choices: [
        { id: "a", text: "The LLM itself, running on a bigger server" },
        { id: "b", text: "Everything around the model that makes it safe to depend on" },
        { id: "c", text: "The eval script from Module 7" },
        { id: "d", text: "A faster embedding model" },
      ],
      answer: { choice: "b" },
      explanation: "Gateway, queue, isolated workers, gates and a kill switch: the airport, not the aeroplane.",
      difficulty: 1,
    },
    {
      id: "m09-q02",
      lesson_step_id: "m09-s04",
      order_index: 2,
      kind: "single_choice",
      prompt: "Where should tenant isolation be enforced?",
      choices: [
        { id: "a", text: "In the generation prompt (\"only use this client's contracts\")" },
        { id: "b", text: "In the database, with row-level security" },
        { id: "c", text: "In the user interface" },
        { id: "d", text: "In the nightly eval" },
      ],
      answer: { choice: "b" },
      explanation: "A prompt can be ignored or bypassed; database rules hold even if the application has a bug.",
      difficulty: 2,
    },
    {
      id: "m09-q03",
      lesson_step_id: "m09-s04",
      order_index: 3,
      kind: "single_choice",
      prompt: "What does the citation-verification gate check?",
      choices: [
        { id: "a", text: "That the quoted clause exists verbatim in the source contract" },
        { id: "b", text: "That the answer is under 200 words" },
        { id: "c", text: "That the user is logged in" },
        { id: "d", text: "That the citation is formatted in bold" },
      ],
      answer: { choice: "a" },
      explanation: "If the quote isn't really in the contract, the answer is blocked.",
      difficulty: 1,
    },
    {
      id: "m09-q04",
      lesson_step_id: "m09-s04",
      order_index: 4,
      kind: "single_choice",
      prompt: "A gate fails. What should the user see?",
      choices: [
        { id: "a", text: "The answer anyway, with a warning" },
        { id: "b", text: "\"I could not find a supporting clause\", plus the top 3 chunks" },
        { id: "c", text: "An error page with a stack trace" },
        { id: "d", text: "Nothing at all" },
      ],
      answer: { choice: "b" },
      explanation: "The fallback is honest and still useful: here's what was found, but no verified answer.",
      difficulty: 1,
    },
    {
      id: "m09-q05",
      lesson_step_id: "m09-s04",
      order_index: 5,
      kind: "single_choice",
      prompt: "Why version every prompt with a hash?",
      choices: [
        { id: "a", text: "To make prompts run faster" },
        { id: "b", text: "So any answer can be traced to the exact prompt that produced it" },
        { id: "c", text: "To hide prompts from users" },
        { id: "d", text: "Because the API requires it" },
      ],
      answer: { choice: "b" },
      explanation: "Without versions, a silent prompt change can't be found when answers change.",
      difficulty: 2,
    },
    {
      id: "m09-q06",
      lesson_step_id: "m09-s07",
      order_index: 6,
      kind: "single_choice",
      prompt: "Why can a machine turn the kill switch off but only a human turn it on?",
      choices: [
        { id: "a", text: "Machines aren't allowed to change config files" },
        { id: "b", text: "Stopping is always safe; restarting needs someone to confirm the problem is fixed" },
        { id: "c", text: "The switch only has one direction" },
        { id: "d", text: "It saves money at night" },
      ],
      answer: { choice: "b" },
      explanation: "The system fails closed: refusing is embarrassing, leaking or misleading ends the engagement.",
      difficulty: 2,
    },
    {
      id: "m09-q07",
      lesson_step_id: "m09-s04",
      order_index: 7,
      kind: "single_choice",
      prompt: "When a guardrail is unsure, what should it do?",
      choices: [
        { id: "a", text: "Answer, and log a warning" },
        { id: "b", text: "Refuse" },
        { id: "c", text: "Ask the user to decide" },
        { id: "d", text: "Retry until it passes" },
      ],
      answer: { choice: "b" },
      explanation: "When in doubt, refuse. \"I cannot answer right now\" beats a confident wrong answer.",
      difficulty: 1,
    },
  ],

  failure_cases: [
    {
      id: "m09-f01",
      order_index: 1,
      title: "The gate that blocks everything",
      category: "guardrail",
      user_query: "(Harness: every question, through the citation-verification gate)",
      retrieved_context: [],
      bad_output:
        "Every answer comes back as \"I could not find a supporting clause\", even for questions the system answered correctly yesterday. The quotes contain line breaks and double spaces that the source text doesn't.",
      symptom: "A safety gate that refuses correct answers.",
      root_cause: "Exact match tripped on whitespace.",
      fix: "Normalise whitespace in both the quote and the source before comparing, then fall back to fuzzy matching.",
      cause_options: [
        { id: "a", text: "The re-ranker returned the wrong clauses" },
        { id: "b", text: "Exact match tripped on whitespace" },
        { id: "c", text: "The kill switch was left switched off" },
      ],
      correct_cause: "b",
    },
    {
      id: "m09-f02",
      order_index: 2,
      title: "The silent prompt change",
      category: "prompt",
      user_query: "(Harness: the same questions, answered on two days)",
      retrieved_context: [],
      bad_output: "Answers change style overnight, but the logs show the same prompt version on both days.",
      symptom: "Answers change, but the logs say nothing changed.",
      root_cause: "The prompt changed without a version bump.",
      fix: "Compute the prompt version from a hash of its contents, so any edit changes the version automatically.",
      cause_options: [
        { id: "a", text: "The prompt changed without a version bump" },
        { id: "b", text: "The generation model was updated by the provider" },
        { id: "c", text: "A user edited the golden set by mistake" },
      ],
      correct_cause: "a",
    },
    {
      id: "m09-f03",
      order_index: 3,
      title: "The kill switch that leaks",
      category: "guardrail",
      user_query: "(Harness: 300 questions queued when the kill switch flipped at 2am)",
      retrieved_context: [],
      bad_output: "The kill switch flips off at 2am, but 300 questions already in the queue are still answered over the next hour.",
      symptom: "Answers keep shipping after the system was switched off.",
      root_cause: "The switch didn't stop queued jobs.",
      fix: "Have the workers check serving.enabled before answering each job, not only the gateway before accepting new requests.",
      cause_options: [
        { id: "a", text: "The nightly eval didn't flip the switch" },
        { id: "b", text: "The workers were reading an old config file" },
        { id: "c", text: "The switch didn't stop queued jobs" },
      ],
      correct_cause: "c",
    },
  ],
};

export default m09;
