import type { ModuleContent } from "../types";

// Source: m08-automation.md (Week 5, lesson 2). The failure cases have no
// single user query, so user_query gives the monitoring context in parentheses.

const m08: ModuleContent = {
  id: "m08",
  slug: "automation",
  order_index: 8,
  title: "Automation",
  summary:
    "Anything checked by hand eventually stops being checked. Silent degradation is the most common way RAG systems die, and cost creep is the second. By the end, the eval runs nightly on its own, a dashboard shows recall and cost over time, and an alert fires when either moves more than 5%.",
  learning_objectives: [
    "Explain silent degradation and cost creep, the two most common ways RAG systems fail",
    "Schedule the eval to run on its own (cron or GitHub Actions)",
    "Track recall@3, citation accuracy, p95 latency and cost per query on one dashboard",
    "Set alerts on a 5% change, without making them so noisy they get ignored",
    "Add a canary set that blocks a deploy when it fails",
  ],
  estimated_minutes: 90,
  is_published: true,

  lesson_steps: [
    {
      id: "m08-s01",
      order_index: 1,
      kind: "exercise",
      title: "Warm-up recall",
      body_md: `Answer from memory before checking:

1. What does recall@3 measure? (Module 7)
2. Why must the golden set include "the contract does not say" answers? (Module 7)
3. What should the thumbs-down handler write, and where? (Module 7)`,
    },
    {
      id: "m08-s02",
      order_index: 2,
      kind: "concept",
      title: "Why this matters",
      body_md: `The demo adds **50 new contracts** to the index and changes nothing else. Recall drops from **0.86 to 0.71**, and nobody notices for a week.

**Silent degradation** is the most common way RAG systems die.`,
    },
    {
      id: "m08-s03",
      order_index: 3,
      kind: "concept",
      title: "Core idea: schedule, record, alert",
      body_md: `Anything you check by hand you will stop checking. **Schedule the eval, record the numbers, alert on change.**

Track **cost per query** alongside quality, because **cost creep** is the second way these systems die.

**Analogy:** a smoke detector, not a fire inspection.`,
    },
    {
      id: "m08-s04",
      order_index: 4,
      kind: "example",
      title: "Worked example",
      body_md: `1. Wrap \`evaluate.py\` in a scheduled job (cron or GitHub Actions).
2. Write the results to a table.
3. Plot **recall@3, citation accuracy, p95 latency and cost per query** on one dashboard.
4. Add a threshold alert to email or Slack.

The instructor then **breaks the pipeline on purpose** so you can watch the alert arrive.`,
    },
    {
      id: "m08-s05",
      order_index: 5,
      kind: "exercise",
      title: "Hands-on (three tiers)",
      body_md: `**Predict first:** write down how long you think a silent drop would go unnoticed without automation.

- **Guided:** schedule the job and confirm it ran twice.
- **Partial:** add the cost metric; set a budget alert.
- **Solo:** add a canary: 5 questions that must always pass, checked on every deploy, blocking the deploy if they fail.

**Files you create:** \`.github/workflows/eval.yml\` and the nightly scheduler config.

**Capstone branch:** \`automation\`, with a nightly eval, a dashboard and two alerts.

**Check it with your assistant:** paste the Evaluation section of the wiring diagram and ask: "Does my automation branch run the eval in CI on every push, nightly on a schedule, and on a 5% sample of live traffic?"`,
    },
    {
      id: "m08-s06",
      order_index: 6,
      kind: "exercise",
      title: "Failure gallery",
      body_md: `Diagnose the three broken outputs in this module's failure gallery and name the fix for each.`,
    },
    {
      id: "m08-s07",
      order_index: 7,
      kind: "reflection",
      title: "Exit quiz and reflection",
      body_md: `Take the quiz, then write one sentence on what still confuses you. It drives your spaced review.

**Say it in one sentence:** what is the difference between a test that runs in CI and one that runs nightly?`,
    },
  ],

  quiz_items: [
    {
      id: "m08-q01",
      lesson_step_id: "m08-s02",
      order_index: 1,
      kind: "single_choice",
      prompt: "What is the most common way RAG systems die?",
      choices: [
        { id: "a", text: "A sudden crash that everyone notices" },
        { id: "b", text: "Silent degradation that nobody notices" },
        { id: "c", text: "Running out of disk space" },
        { id: "d", text: "Users forgetting their passwords" },
      ],
      answer: { choice: "b" },
      explanation: "Quality slips quietly as data changes, and nobody checks.",
      difficulty: 1,
    },
    {
      id: "m08-q02",
      lesson_step_id: "m08-s03",
      order_index: 2,
      kind: "single_choice",
      prompt: "Why automate the eval instead of running it by hand?",
      choices: [
        { id: "a", text: "Automated evals are more accurate" },
        { id: "b", text: "Anything you check by hand you eventually stop checking" },
        { id: "c", text: "Running it by hand is not allowed" },
        { id: "d", text: "The eval only works on a schedule" },
      ],
      answer: { choice: "b" },
      explanation: "A schedule keeps checking long after people stop remembering to.",
      difficulty: 1,
    },
    {
      id: "m08-q03",
      lesson_step_id: "m08-s03",
      order_index: 3,
      kind: "single_choice",
      prompt: "Why track cost per query alongside quality?",
      choices: [
        { id: "a", text: "Cost creep is the second most common way these systems die" },
        { id: "b", text: "Cost and recall are the same metric" },
        { id: "c", text: "The dashboard needs four lines" },
        { id: "d", text: "Cost only matters during fine-tuning" },
      ],
      answer: { choice: "a" },
      explanation: "A system can stay accurate while quietly becoming too expensive to run.",
      difficulty: 1,
    },
    {
      id: "m08-q04",
      lesson_step_id: "m08-s04",
      order_index: 4,
      kind: "single_choice",
      prompt: "In this module, when should an alert fire?",
      choices: [
        { id: "a", text: "Whenever any number changes at all" },
        { id: "b", text: "When recall or cost moves more than 5%" },
        { id: "c", text: "Only when recall reaches zero" },
        { id: "d", text: "Once a week, regardless of the numbers" },
      ],
      answer: { choice: "b" },
      explanation: "A 5% move is big enough to matter and small enough to catch early.",
      difficulty: 2,
    },
    {
      id: "m08-q05",
      lesson_step_id: "m08-s05",
      order_index: 5,
      kind: "single_choice",
      prompt: "What is a canary set?",
      choices: [
        { id: "a", text: "Five questions that must always pass, checked on every deploy, blocking it if they fail" },
        { id: "b", text: "A backup copy of the index" },
        { id: "c", text: "The first 5 users of a new feature" },
        { id: "d", text: "A list of banned words" },
      ],
      answer: { choice: "a" },
      explanation: "It is a small, fast gate that stops obvious breakage reaching users.",
      difficulty: 2,
    },
    {
      id: "m08-q06",
      lesson_step_id: "m08-s07",
      order_index: 6,
      kind: "single_choice",
      prompt: "What is the difference between a test in CI and one that runs nightly?",
      choices: [
        { id: "a", text: "There is no difference" },
        { id: "b", text: "CI catches problems from your code changes; nightly catches drift when data changes with no code change" },
        { id: "c", text: "Nightly tests are only for cost" },
        { id: "d", text: "CI tests run only on weekends" },
      ],
      answer: { choice: "b" },
      explanation: "Adding 50 contracts changes no code, so only the nightly run catches the drop.",
      difficulty: 2,
    },
    {
      id: "m08-q07",
      lesson_step_id: "m08-s02",
      order_index: 7,
      kind: "single_choice",
      prompt: "Recall drops from 0.86 to 0.71 after new contracts are indexed, with no code change. What catches it?",
      choices: [
        { id: "a", text: "The CI test on the next push" },
        { id: "b", text: "The nightly eval and its alert" },
        { id: "c", text: "The generation prompt" },
        { id: "d", text: "The query rewriter" },
      ],
      answer: { choice: "b" },
      explanation: "No push means CI never runs; the nightly schedule catches data drift.",
      difficulty: 3,
    },
  ],

  failure_cases: [
    {
      id: "m08-f01",
      order_index: 1,
      title: "The 3am alert",
      category: "monitoring",
      user_query: "(Monitoring: the nightly eval alert)",
      retrieved_context: [],
      bad_output: "An alert fires every night at 3am. After a week, the team mutes it, and a real drop goes unnoticed.",
      symptom: "An alert so frequent that people stop reading it.",
      root_cause: "The alert threshold is too tight.",
      fix: "Alert on a meaningful change (more than 5%, or a sustained drop over two runs), so every alert is worth reading.",
      cause_options: [
        { id: "a", text: "The nightly job runs at the wrong hour of the night" },
        { id: "b", text: "The email provider is sending duplicate messages" },
        { id: "c", text: "The alert threshold is too tight" },
      ],
      correct_cause: "c",
    },
    {
      id: "m08-f02",
      order_index: 2,
      title: "The hidden tenant",
      category: "monitoring",
      user_query: "(Monitoring: the recall dashboard)",
      retrieved_context: [],
      bad_output: "The dashboard shows recall steady at 0.86, but one client's recall has fallen to 0.55.",
      symptom: "The headline number looks healthy while one client suffers.",
      root_cause: "Averaging hid one tenant's drop.",
      fix: "Break the dashboard down per tenant (and per routing label), and alert on any single tenant's drop, not just the average.",
      cause_options: [
        { id: "a", text: "Averaging hid one tenant's drop" },
        { id: "b", text: "That tenant's contracts were never indexed at all" },
        { id: "c", text: "The dashboard refreshes only once a week" },
      ],
      correct_cause: "a",
    },
    {
      id: "m08-f03",
      order_index: 3,
      title: "The job that stopped",
      category: "monitoring",
      user_query: "(Monitoring: the nightly scheduler)",
      retrieved_context: [],
      bad_output: "The dashboard has been flat for three weeks with no alerts. The scheduler disabled itself after one failed run.",
      symptom: "No alerts, and a suspiciously flat line.",
      root_cause: "The job stopped and nothing noticed.",
      fix: "Add a heartbeat alert that fires when an expected run is missing, not only when its numbers change.",
      cause_options: [
        { id: "a", text: "Recall genuinely stayed perfectly flat" },
        { id: "b", text: "The job stopped and nothing noticed" },
        { id: "c", text: "The alert threshold was set far too loose" },
      ],
      correct_cause: "b",
    },
  ],
};

export default m08;
