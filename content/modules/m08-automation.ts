import type { ModuleContent } from "../types";
import { cite, NDA_CLAUSES as C, RUNNING_QUESTION } from "../nda";

// Module 8, rewritten on the running example. Module 7 turned the subcontractor
// question into a golden-set row; here that row (and evaluate.py) runs by
// itself: on every change (CI), every night (a scheduled job), with a
// dashboard, alerts and canary questions. The opening failure: an index
// rebuild with a new embedding model knocked §4.5 out of the top 3 and nobody
// ran the eval for 11 days. It sets up what Module 9 recalls: CI vs nightly,
// the subcontractor canary, and the same-night alert.
//
// Quiz, step and failure ids are unchanged from the original Module 8, so
// existing attempts and review cards keep pointing at the same slots.

const ANSWER_M02 = `Yes, to Permitted Recipients bound by written confidentiality obligations (${C.permittedDisclosure.section}).`;

const m08: ModuleContent = {
  id: "m08",
  slug: "automation",
  order_index: 8,
  title: "Automation",
  summary:
    "Make the evaluation from Module 7 run by itself: on every change, every night, with a dashboard, alerts and canary questions, so that when an index rebuild knocks §4.5 out of the subcontractor answer, someone hears about it the same night instead of 11 days later.",
  hook: `In Module 7 you turned "${RUNNING_QUESTION}" into a test with a known right answer. Then a teammate rebuilt the index with a new embedding model, ${C.contractors.section} slipped out of the top 3, and that test failed for 11 days. Nobody noticed, because nobody remembered to run it.`,
  learning_objectives: [
    "Explain silent degradation: how a contract assistant can get worse with no error message, and why checks done by hand stop happening",
    "Run the evaluation on every change with continuous integration (CI), and every night with a scheduled job",
    "Track recall@3, citation accuracy, groundedness, cost per query and p95 latency on one dashboard, split by routing tag",
    "Write alert rules that catch a real drop the same night without raising false alarms",
    "Use the subcontractor question as a canary that stops a deploy when §4.5 falls out of the top 3",
  ],
  estimated_minutes: 90,
  is_published: true,
  pipeline_stages: ["eval-guardrails"],
  explain_back_prompt: `In your own words: the index rebuild changed no code, yet ${C.contractors.section} fell out of the top 3. Which of the two automatic runs catches that, which one would catch a bad edit to the synonym table, and why do you need both?`,
  video: null,

  lesson_steps: [
    {
      id: "m08-s01",
      order_index: 1,
      kind: "warm_up",
      title: "Warm-up: what you already know",
      body_md: `Before we start, answer these from what you remember of Module 7. There are no wrong answers. You'll check yourself against the study guide at the end.

1. In Module 7 you added "${RUNNING_QUESTION}" to your golden set, the file \`eval/golden.jsonl\`. What does that one row hold?
2. \`evaluate.py\` gives three scores: recall@3, citation accuracy and groundedness. What does each one tell you?
3. The subcontractor row passed one of those checks and failed another. Which, and why?`,
    },
    {
      id: "m08-s02",
      order_index: 2,
      kind: "concept",
      title: "Eleven quiet days",
      body_md: `Let's start with a story.

On a Tuesday evening, a teammate rebuilds the index of your non-disclosure agreement (NDA) with a newer embedding model. It's faster and cheaper. They use it for both the clauses and the questions, so Module 1's rule (one embedding model for both) is kept. Nothing crashes. Every question still gets a fluent, cited answer.

But the new model scores every clause a little differently. It scores the short amendment, ${C.contractors.section}, just low enough that the cleaning step from Module 4 throws it away as a weak match. The re-ranker never sees it. So when someone asks **"${RUNNING_QUESTION}"**, the answer goes back to what it was in Module 2:

> "${ANSWER_M02}"

That's wrong. Under ${C.contractors.section} you need the Disclosing Party's prior written consent first.

Your golden set would have caught this in under a minute. The subcontractor row fails recall@3 the moment ${C.contractors.section} leaves the top 3. But \`evaluate.py\` only runs when somebody types the command, and that fortnight everyone was busy. Eleven days later, a lawyer at Beta spots the answer and asks what happened.

This is **silent degradation**: the system gets worse with no error message, nothing red, nothing broken. Just wrong answers, delivered with confidence.

:::key The rescue: make the test run itself
Anything you check by hand, you'll eventually stop checking. So the fix isn't a better test. It's making the test you already have run **on every change**, **every night**, and tell a person **the moment it fails**. Think of a smoke detector, not a yearly fire inspection.
:::`,
    },
    {
      id: "m08-s03",
      order_index: 3,
      kind: "concept",
      title: "On every change: CI and canary questions",
      body_md: `The first place to run the eval is every time someone changes the code. That's called **continuous integration**, or **CI**.

Your course project lives on GitHub, a website that stores your code and its history. GitHub has a built-in runner called GitHub Actions. You give it a **workflow file**, \`.github/workflows/eval.yml\`. That's a plain text file that tells GitHub two things: **when** to run (on every change you send it, and every night) and **what** to run (your evaluation). Each run starts a fresh computer, runs the steps in order, and shows a green tick or a red cross next to your change.

A red cross means the change can't be deployed until someone fixes it.

**Canary questions: the ones that must never fail**

Running all of \`eval/golden.jsonl\` on every change is slow and costs money. So you pick a handful of questions that must always pass, called **canary questions**, after the canaries miners carried to warn them of bad air. You keep them in their own file, \`eval/canaries.jsonl\`: a plain text file with one question per line and what must be true of its answer. If any canary fails, the run goes red and the change stops.

"${RUNNING_QUESTION}" is your first canary. Remember Module 7's story: a teammate edited the synonym table to help a question about Affiliates, and the subcontractor question quietly lost ${C.contractors.section}. With this canary in CI, that edit gets a red cross before it ever goes live.

:::key What Module 8 adds, and what's still wrong
Module 8 doesn't change how a single answer is found or written. It changes **when the checks run**. That's the evaluation half of **[6] eval & guardrails**, so the map's 📍 You are here marker sits on that one stage. Your golden set and \`evaluate.py\` from Module 7 now run by themselves, and a person hears about a failure the same night.

Two things are still wrong. These checks test the golden set at night, not the live answer a lawyer reads at 2 in the afternoon, so a single bad answer can still slip through. Module 9 adds checks on every live answer. And the subcontractor answer itself still offers a muddled second route under ${C.permittedDisclosure.section}. Module 10 fixes that.
:::

:::more Why the canary checks §4.5, not the whole answer
A canary must be something that passes **today**, or it blocks every change. The full subcontractor answer still fails Module 7's answer check, because of that muddled second route. So the canary checks the parts that do work now: ${C.contractors.section} is in the top 3, and the answer cites ${C.contractors.section}. The full answer check stays on the dashboard, where you can watch it improve in Module 10.
:::`,
      code_snippet: `{"question": "Can we share this with a subcontractor?", "must_be_in_top3": ["§4.5"], "must_cite": ["§4.5"]}
{"question": "May the Receiving Party disclose to a subcontractor?", "must_be_in_top3": ["§4.5"], "must_cite": ["§4.5"]}`,
      code_language: "json",
    },
    {
      id: "m08-s04",
      order_index: 4,
      kind: "concept",
      title: "Every night: the scheduled job and the dashboard",
      body_md: `CI only runs when the code changes. But look back at the story: the index rebuild changed **no code at all**. Neither does adding a new NDA to the index, or the model provider quietly updating its language model. CI would have stayed silent through all of those.

So the same workflow file also runs the full golden set **every night**, as a **scheduled job**: a task the computer starts by itself at a set time. The time is written as a **cron schedule**, a short code like \`17 3 * * *\`, which means "at 3:17, every day". Nobody has to remember.

Each night's scores are saved, one row per night, so you can see them change over time.

**The dashboard: one page, five numbers**

A **dashboard** is one page of charts. Yours shows five lines, night by night:

- **Recall@3:** did the right clause, like ${C.contractors.section}, reach the top 3?
- **Citation accuracy:** do the cited clauses really say what the answer claims?
- **Groundedness:** is every claim backed by the clauses the writer was given?
- **p95 latency:** how long the slow answers take. It's the wait that 95 of every 100 answers beat. An average hides the slow ones.
- **Cost per query:** what one answer costs, mostly the model's fee for the tokens it reads and writes.

Split each line by routing tag, too. The subcontractor question is tagged multi-clause, and multi-clause questions are the ones most likely to break.

Why watch cost? Because of **cost creep**, the second quiet killer. Say someone raises the number of clauses sent to the writer from 5 to 15 "to be safe". The subcontractor answer doesn't change, so every quality line stays flat. But each answer now reads three times as many tokens, and costs about three times as much. Only the cost line shows it.

:::more Reading the cron schedule
A cron schedule has five parts, separated by spaces: minute, hour, day of the month, month, day of the week. A star means "every". So \`17 3 * * *\` is minute 17 of hour 3, on every day of every month. Picking an odd minute like 17 avoids the rush at the top of the hour, when everyone else's jobs start.

One catch: GitHub turns off scheduled jobs in a project that's had no changes for 60 days. That's why you'll also add a heartbeat alert in the next part.
:::`,
      code_snippet: `# .github/workflows/eval.yml
name: eval

on:
  push:                    # every change you send to GitHub (CI)
  schedule:
    - cron: "17 3 * * *"   # and every night at 03:17
  workflow_dispatch:       # plus a "Run now" button

jobs:
  eval:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@v4
      - name: Canary questions (any failure stops the change)
        run: python evaluate.py --set eval/canaries.jsonl --fail-on-any
      - name: Full golden set
        run: bash eval/run.sh          # runs evaluate.py, writes eval/metrics.json
      - name: Check the alert rules
        run: python eval/alerts.py
      # ...keep the template's steps that write and upload eval/results.json`,
      code_language: "yaml",
    },
    {
      id: "m08-s05",
      order_index: 5,
      kind: "concept",
      title: "Alerts people actually read",
      body_md: `A score on a dashboard helps only if someone looks at it. An **alert** is an automatic message, an email or a post in the team chat, sent to a person when a number crosses a line. Three rules cover most of what goes wrong:

1. **Any canary fails: alert at once.** If the subcontractor question loses ${C.contractors.section}, someone hears about it tonight, whatever the averages say.
2. **A score drops more than 5 points below last week's average: alert.** Comparing with a week, not just last night, smooths out the normal wobble.
3. **No run at all: alert.** This is a **heartbeat alert**. If the nightly job hasn't reported in 26 hours, something stopped it, and silence is not good news.

Each alert should say what failed, what the system returned instead, and what changed since it last passed. For our story, that's one message: the subcontractor canary got ${C.permittedDisclosure.section}, ${C.permittedRecipient.section} and ${C.definitions.section} instead of ${C.contractors.section}, and the index was rebuilt at 18:40.

**Don't cry wolf**

The opposite mistake is just as dangerous. If an alert fires every night over tiny wiggles, people mute it within a week. That's **alert fatigue**, and the night the subcontractor row really fails, nobody reads the message. Every alert should be worth getting out of a chair for. Send each one to a named person, not a crowded channel.

When an alert fires, the first move is usually a **rollback**: put the last version that worked back live, then work out what went wrong.`,
      code_snippet: `# eval/alerts.py: compare tonight's scores with the last 7 nights
import json, statistics
from notify import send  # your helper that emails or posts to the team chat

tonight = json.load(open("eval/metrics.json"))
week = [json.loads(line) for line in open("eval/history.jsonl")][-7:]

for metric in ["recall_at_3", "citation_accuracy", "groundedness"]:
    usual = statistics.mean(night[metric] for night in week)
    if usual - tonight[metric] > 0.05:  # more than 5 points down
        send(f"{metric} fell from {usual:.2f} to {tonight[metric]:.2f}")

for row in tonight["canary_failures"]:  # any canary failing is an alert
    send(f"Canary failed: {row['question']} got {row['top3']}")

with open("eval/history.jsonl", "a") as f:  # one line per night
    f.write(json.dumps(tonight) + "\\n")`,
      code_language: "python",
    },
    {
      id: "m08-s06",
      order_index: 6,
      kind: "exercise",
      title: "Hands-on: try it yourself",
      body_md: `**Predict first:** without automation, how many days do you think a lost ${C.contractors.section} would go unnoticed on your team? Write your guess down before you start.

- **Guided:** Write \`.github/workflows/eval.yml\` so it runs \`evaluate.py\` on every change and every night. Send a small change to GitHub and watch the run go green. Then check the next morning that the nightly run happened too.
- **Partial:** Add \`eval/canaries.jsonl\` with the subcontractor question in both wordings. Break it on purpose: remove "contractor" from the synonym table, send the change, and confirm the run goes red and names ${C.contractors.section}.
- **Solo:** Write \`eval/alerts.py\` with the three rules (canary, a drop of more than 5 points, heartbeat). Add cost per query and p95 latency to the dashboard, then rebuild the index with a different embedding model and time how long the alert takes to reach you.

**Files you create:** \`.github/workflows/eval.yml\`, your workflow file, with its nightly \`schedule\` lines (the scheduler settings); \`eval/canaries.jsonl\`, the questions that must always pass; and \`eval/alerts.py\`, the small program that compares tonight's scores with last week's and sends the alerts.

**Capstone branch:** save this work on a branch called \`automation\` in your course project, with a nightly eval, a dashboard and two alerts. Leave it running: the course counts your successful nightly runs, and you need at least three.

**Check it with your assistant:** ask your coding assistant, "Does my automation branch run the eval in CI on every change and nightly on a schedule, fail the run when the subcontractor canary loses §4.5, and alert when a score drops more than 5 points or a nightly run is missing?"`,
    },
    {
      id: "m08-s07",
      order_index: 7,
      kind: "concept",
      title: "What automation can't catch",
      body_md: `Automation makes your checks reliable. It doesn't make them complete. Three limits to keep in mind, all on our NDA:

- **It only checks the questions you wrote down.** If a lawyer asks "Can we share this with a consultant?" and ${C.contractors.section} goes missing, no row fails, because there is no row. Every real mistake you find should become a new golden-set row, so it can never come back unnoticed.
- **It checks the system at night, not each answer by day.** A language model doesn't write exactly the same words twice. The nightly run can pass while one live answer at 2 in the afternoon goes wrong. Module 9 checks every live answer before it's shown.
- **It costs something.** The nightly run asks the model every golden-set question, and groundedness needs a second model call to grade each answer. That's real money every night, so keep the canary set small and the full set for the nightly run.

Before adding a new check, ask two questions. Would a person really stop what they're doing for this alert? And if it never fired again, would anyone notice?`,
    },
  ],

  worked_example: [
    {
      id: "m08-w01",
      order_index: 1,
      title: "The row that went quiet",
      body_md: `Here's the subcontractor row from \`eval/golden.jsonl\`, as Module 7 left it. It expects ${C.contractors.section}, ${C.permittedDisclosure.section} and ${C.permittedRecipient.section}. Before the rebuild, ${C.contractors.section} came back first. After it, for 11 days, ${C.contractors.section} wasn't in the top 3 at all, and no one ran the check.`,
      stage: null,
      query_state: `"${RUNNING_QUESTION}" A golden-set row that has been failing for 11 days, unseen.`,
    },
    {
      id: "m08-w02",
      order_index: 2,
      title: "Replay: the rebuild, with automation in place",
      body_md: `Now replay the same Tuesday with this module's work in place. At 18:40 the index is rebuilt with the new embedding model. That's done on the server, not by changing code, so CI doesn't run. Nothing is checked yet, and the NDA's subcontractor answer is already wrong for anyone who asks this evening.`,
      stage: "eval-guardrails",
      query_state: `${C.contractors.section} has just dropped out of the top 3. No code changed, so CI is silent.`,
    },
    {
      id: "m08-w03",
      order_index: 3,
      title: "3:17: the nightly run",
      body_md: `At 3:17 the scheduled job starts by itself. It runs the canaries first, then the full golden set. The subcontractor canary fails straight away: the top 3 are ${C.permittedDisclosure.section}, ${C.permittedRecipient.section} and ${C.definitions.section}. ${C.contractors.section} is gone.`,
      code_snippet: `canary  "Can we share this with a subcontractor?"
  must be in top 3: §4.5
  got:              §4.2(b), §1.4, §1.1
  FAILED`,
      code_language: "text",
      stage: "eval-guardrails",
      query_state: `Canary failed: top 3 are ${C.permittedDisclosure.section}, ${C.permittedRecipient.section}, ${C.definitions.section}.`,
    },
    {
      id: "m08-w04",
      order_index: 4,
      title: "The averages barely move",
      body_md: `Look at the dashboard. Overall recall@3 dips from 0.92 to 0.88: two rows out of about 50 failed, the subcontractor row and one other about contractors. That's 4 points, less than the 5-point rule. On averages alone, nobody would be woken up.

But split by routing tag, multi-clause questions fall much further. And the canary rule doesn't care about averages: one failing canary is enough.`,
      stage: "eval-guardrails",
      query_state: "Recall@3 0.92 → 0.88 overall. Too small for the averages rule; the canary rule fires.",
    },
    {
      id: "m08-w05",
      order_index: 5,
      title: "The alert arrives the same night",
      body_md: `By 3:30 the alert is waiting for the person on duty. It says what failed, what came back instead and what changed since the last pass:

> "Canary failed: '${RUNNING_QUESTION}' ${C.contractors.section} not in the top 3 (got ${C.permittedDisclosure.section}, ${C.permittedRecipient.section}, ${C.definitions.section}). Last passed: last night. Since then: index rebuilt at 18:40 with a new embedding model."

Eleven days of silence have become nine hours.`,
      stage: "eval-guardrails",
      query_state: "Alert sent at 3:30, the same night as the rebuild.",
    },
    {
      id: "m08-w06",
      order_index: 6,
      title: "Roll back, then fix",
      body_md: `In the morning, the person on duty rolls back to yesterday's index, so ${C.contractors.section} is back in first place within minutes. Then they look at why the new model scores the short amendment so low before trying it again.

The answer is back where Module 7 left it: "Disclosure to contractors needs the Disclosing Party's prior written consent (${C.contractors.section}). Under ${C.permittedDisclosure.section} you may also share with Permitted Recipients." Still that muddled second route, which Module 10 fixes, but no longer silently worse.`,
      stage: "eval-guardrails",
      query_state: `${C.contractors.section} is back in the top 3 after the rollback. The answer is Module 7's again, muddled second route and all.`,
    },
  ],

  // Every term a learner meets in this module (tests/unit/glossary-coverage.test.ts
  // checks none is missing): contract words first, then the rest.
  glossary: [
    "nda", "clause", "section-sign", "confidential-information", "permitted-recipient", "subcontractor", "disclosing-party", "receiving-party", "affiliate",
    "amendment", "notwithstanding", "written-consent", "language-model", "token", "branch", "index", "embedding", "synonym-table",
    "re-rank", "eval", "guardrail", "golden-set", "routing-tag", "recall-at-3", "citation-accuracy", "groundedness", "ci",
    "deploy", "alert", "dashboard", "canary", "eval-script", "answer-check", "silent-degradation", "scheduled-job", "cron",
    "github", "github-actions", "workflow-file", "cost-per-query", "cost-creep", "p95-latency", "heartbeat-alert", "alert-fatigue", "roll-back",
  ],

  study_guide: [
    {
      id: "m08-p01",
      order_index: 1,
      point: "Module 7's golden set holds the subcontractor row (§4.5, §4.2(b), §1.4 and the right answer). evaluate.py scores recall@3, citation accuracy and groundedness. The row passes recall@3 but fails the answer check.",
      narration: `Watch the subcontractor row go through evaluate.py. Recall@3 asks: did §4.5 reach the top 3? Yes. Citation accuracy asks: do the cited clauses say what the answer claims? Groundedness asks: is every claim backed by the clauses? The row still fails the answer check, because the answer offers a second route under §4.2(b). That's measured, not guessed.`,
    },
    {
      id: "m08-p02",
      order_index: 2,
      point: "Silent degradation: an index rebuild knocked §4.5 out of the top 3, with no error, and the failing row went unseen for 11 days because the eval only ran by hand.",
      narration: `See the index being rebuilt with a new embedding model. Nothing crashes. The amendment's score dips just enough for the cleaning step to drop it, and the answer slides back to "Yes, to Permitted Recipients". The test that would catch it sits unused for 11 days. Anything checked by hand eventually stops being checked.`,
    },
    {
      id: "m08-p03",
      order_index: 3,
      point: "CI runs the eval on every code change. Canary questions, starting with the subcontractor question, must always pass, and a failing canary stops the change.",
      narration: `Watch a teammate edit the synonym table and send the change to GitHub. The workflow file starts a fresh computer and runs the canaries. The subcontractor canary loses §4.5, the run goes red, and the change can't go live until it's fixed.`,
    },
    {
      id: "m08-p04",
      order_index: 4,
      point: "A nightly scheduled job runs the full golden set, because many changes aren't code: an index rebuild, a new NDA, a provider's model update.",
      narration: `Follow the clock to 3:17. No one has changed any code today, but the index was rebuilt this evening. The scheduled job starts by itself, the subcontractor canary fails, and the scores are saved as tonight's row.`,
    },
    {
      id: "m08-p05",
      order_index: 5,
      point: "One dashboard shows recall@3, citation accuracy, groundedness, p95 latency and cost per query, split by routing tag. Cost creep only shows on the cost line.",
      narration: `See the five lines, night by night. Split by routing tag, the multi-clause line dips further than the average. Then watch someone send 15 clauses instead of 5: the quality lines stay flat, and only the cost line climbs.`,
    },
    {
      id: "m08-p06",
      order_index: 6,
      point: "Three alert rules: any canary fails, a score drops more than 5 points below last week's average, or a run goes missing. Too many alerts and people stop reading them.",
      narration: `Watch the alert land at 3:30, nine hours after the rebuild instead of 11 days. It names the question, the clauses that came back instead, and what changed. In the morning the index is rolled back and §4.5 is first again.`,
    },
  ],

  quiz_items: [
    {
      id: "m08-q01",
      lesson_step_id: "m08-s02",
      order_index: 1,
      kind: "single_choice",
      prompt: `Why did the subcontractor row fail for 11 days before anyone noticed?`,
      choices: [
        { id: "a", text: "The golden set didn't include the subcontractor question" },
        { id: "b", text: "The eval only ran when someone remembered to run it" },
        { id: "c", text: "The new embedding model caused an error that hid the results" },
        { id: "d", text: "Recall@3 can't detect a missing clause" },
      ],
      answer: { choice: "b" },
      explanation: "The test existed and would have failed in under a minute. It just never ran. Silent degradation gives no error, so only a scheduled check catches it.",
      difficulty: 1,
    },
    {
      id: "m08-q02",
      lesson_step_id: "m08-s03",
      order_index: 2,
      kind: "single_choice",
      prompt: "A teammate edits the synonym table, and the subcontractor canary loses §4.5. With CI in place, what happens?",
      choices: [
        { id: "a", text: "The change goes live, and the nightly run reports it the next morning" },
        { id: "b", text: "Nothing, because canaries only run at night" },
        { id: "c", text: "The run goes red and the change can't be deployed until it's fixed" },
        { id: "d", text: "The synonym table is restored automatically" },
      ],
      answer: { choice: "c" },
      explanation: "CI runs the canaries on every code change. A failing canary marks the change red, which stops it going live.",
      difficulty: 1,
    },
    {
      id: "m08-q03",
      lesson_step_id: "m08-s04",
      order_index: 3,
      kind: "single_choice",
      prompt: "The index was rebuilt on the server with a new embedding model. No code changed. Which run catches §4.5 going missing?",
      choices: [
        { id: "a", text: "The CI run on the next code change" },
        { id: "b", text: "The nightly scheduled run" },
        { id: "c", text: "Neither: only a person reading answers can catch it" },
        { id: "d", text: "The re-ranker, which flags missing clauses" },
      ],
      answer: { choice: "b" },
      explanation: "CI runs only when code changes. The nightly job runs whatever happened, so it catches changes that aren't code: rebuilds, new contracts, model updates.",
      difficulty: 2,
    },
    {
      id: "m08-q04",
      lesson_step_id: "m08-s02",
      order_index: 4,
      kind: "short_answer",
      prompt: "What's the name for a system getting quietly worse with no error message, like the subcontractor answer losing §4.5?",
      answer: { accepted: ["silent degradation", "degradation", "silent decay"] },
      explanation: "Silent degradation: nothing crashes and nothing turns red. Only the answers get worse.",
      difficulty: 1,
    },
    {
      id: "m08-q05",
      lesson_step_id: "m08-s05",
      order_index: 5,
      kind: "multi_choice",
      prompt: "Which of these should send an alert?",
      choices: [
        { id: "a", text: "The subcontractor canary no longer finds §4.5 in the top 3" },
        { id: "b", text: "Groundedness moves from 0.94 to 0.93 overnight" },
        { id: "c", text: "Recall@3 falls 6 points below last week's average" },
        { id: "d", text: "No nightly run has reported in 26 hours" },
      ],
      answer: { choices: ["a", "c", "d"] },
      explanation: "A failing canary, a real drop and a missing run all matter. A 1-point wobble is normal; alerting on it trains people to ignore alerts.",
      difficulty: 2,
    },
    {
      id: "m08-q06",
      lesson_step_id: "m08-s06",
      order_index: 6,
      kind: "single_choice",
      prompt: "Why does the subcontractor canary check that §4.5 is in the top 3 and cited, but not that the whole answer is right?",
      choices: [
        { id: "a", text: "Whole answers can't be checked automatically" },
        { id: "b", text: "The whole answer still fails today, so that check would stop every change" },
        { id: "c", text: "Checking the answer would cost too much on every change" },
        { id: "d", text: "§4.5 is the only clause that matters" },
      ],
      answer: { choice: "b" },
      explanation: "A canary must pass today. The answer still offers a muddled second route under §4.2(b) until Module 10, so that check lives on the dashboard instead.",
      difficulty: 3,
    },
    {
      id: "m08-q07",
      lesson_step_id: "m08-s07",
      order_index: 7,
      kind: "single_choice",
      prompt: "A lawyer asks \"Can we share this with a consultant?\" and the answer misses §4.5. The golden set has no row for it. Will the nightly run catch it?",
      choices: [
        { id: "a", text: "Yes, because recall@3 checks every possible question" },
        { id: "b", text: "Yes, because the subcontractor canary covers similar wordings" },
        { id: "c", text: "No. It only checks the questions you wrote down, so add this one as a row" },
        { id: "d", text: "No, because consultants aren't covered by the NDA" },
      ],
      answer: { choice: "c" },
      explanation: "Automation runs your checks reliably, but only your checks. Every real mistake should become a new golden-set row.",
      difficulty: 2,
    },
  ],

  failure_cases: [
    {
      id: "m08-f01",
      order_index: 1,
      title: "The alert everyone muted",
      category: "monitoring",
      user_query: `${RUNNING_QUESTION} (nightly golden-set run)`,
      retrieved_context: [
        { source: cite(C.permittedDisclosure), text: C.permittedDisclosure.text, score: 0.83 },
        { source: cite(C.permittedRecipient), text: C.permittedRecipient.text, score: 0.79 },
        { source: cite(C.definitions), text: C.definitions.text, score: 0.74 },
      ],
      bad_output: `Alert, 03:31: "groundedness 0.93 → 0.92". The same kind of message has arrived every night for three weeks, so the team muted it. Tonight's real failure, the subcontractor row losing ${C.contractors.section}, sat in the same muted channel.`,
      symptom: `${C.contractors.section} is missing from the top 3, and an alert did fire, but nobody read it.`,
      root_cause: "The alert fired on every tiny night-to-night wobble in groundedness, so people learned to ignore it. Alert fatigue hid the one alert that mattered.",
      fix: "Alert only on drops of more than 5 points below last week's average, or on any failing canary. Send each alert to a named person, not a busy channel.",
      cause_options: [
        { id: "a", text: "The nightly job ran before the index rebuild had finished, so it tested an out-of-date copy" },
        { id: "b", text: "The golden set had no row for the subcontractor question" },
        { id: "c", text: "The alert fired on normal nightly wobble" },
      ],
      correct_cause: "c",
    },
    {
      id: "m08-f02",
      order_index: 2,
      title: "The average that hid it",
      category: "monitoring",
      user_query: `${RUNNING_QUESTION} (one row of the nightly run)`,
      retrieved_context: [
        { source: cite(C.permittedDisclosure), text: C.permittedDisclosure.text, score: 0.83 },
        { source: cite(C.permittedRecipient), text: C.permittedRecipient.text, score: 0.79 },
        { source: cite(C.definitions), text: C.definitions.text, score: 0.74 },
      ],
      bad_output: "Dashboard: recall@3 0.92 → 0.88. No alert: the drop is under the 5-point rule. The subcontractor row has failed, but it's one of about 50 rows.",
      symptom: "The headline number looks almost fine while the most important question is broken.",
      root_cause: `Averaging over every row hid one row's failure. The subcontractor row lost ${C.contractors.section}, but one failing row moves the average by only 2 points.`,
      fix: "Make the subcontractor question a canary that alerts on its own, and split the dashboard by routing tag so a multi-clause drop stands out.",
      cause_options: [
        { id: "a", text: "Averaging hid the one row that failed" },
        { id: "b", text: "The nightly run skipped the multi-clause questions to save time and money" },
        { id: "c", text: "The dashboard only refreshes once a week" },
      ],
      correct_cause: "a",
    },
    {
      id: "m08-f03",
      order_index: 3,
      title: "The job that stopped",
      category: "monitoring",
      user_query: `${RUNNING_QUESTION} (last checked 23 days ago)`,
      retrieved_context: [
        { source: `${cite(C.contractors)} (last nightly run, 23 days ago)`, text: C.contractors.text, score: 0.91 },
        { source: `${cite(C.permittedDisclosure)} (last nightly run, 23 days ago)`, text: C.permittedDisclosure.text, score: 0.86 },
      ],
      bad_output: "The dashboard has been perfectly flat for 23 days, with no alerts. GitHub had switched the nightly schedule off after 60 days with no changes to the project.",
      symptom: "No alerts and a suspiciously flat line. The subcontractor row hasn't been checked for over three weeks.",
      root_cause: "The scheduled job stopped running, and every alert rule only looked at scores. With no new scores, nothing could fire.",
      fix: "Add a heartbeat alert that fires when an expected nightly run is missing, not only when its numbers change.",
      cause_options: [
        { id: "a", text: "The subcontractor row really did pass every night, so there was nothing to report" },
        { id: "b", text: "The nightly job stopped and nothing noticed" },
        { id: "c", text: "The alert emails were going to a spam folder" },
      ],
      correct_cause: "b",
    },
  ],
};

export default m08;
