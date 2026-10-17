import type { ModuleContent } from "../types";
import { cite, NDA_CLAUSES as C, RUNNING_QUESTION } from "../nda";

// Module 7, rewritten on the running example. A teammate's synonym-table edit
// helps an Affiliates question and silently drops §4.5 from the subcontractor
// answer; nobody notices until a lawyer does. The rescue is a golden set
// (eval/golden.jsonl) with the subcontractor question as a row, scored by
// evaluate.py: the row passes recall@3 but fails the answer check.
//
// Quiz, step and failure ids are unchanged from the original Module 7, so
// existing attempts and review cards keep pointing at the same slots.

const CORRECT_ANSWER = `Not without the Disclosing Party's prior written consent (${C.contractors.section}, Amendment No. 1). A subcontractor isn't a Permitted Recipient under ${C.permittedRecipient.section}, so ${C.permittedDisclosure.section} doesn't cover it.`;
const CURRENT_ANSWER = `Disclosure to contractors needs the Disclosing Party's prior written consent (${C.contractors.section}). Under ${C.permittedDisclosure.section} you may also share with Permitted Recipients.`;

const GOLDEN_ROW = JSON.stringify({
  id: "nda-001",
  question: RUNNING_QUESTION,
  type: "permission",
  gold_clauses: [C.contractors.section, C.permittedDisclosure.section, C.permittedRecipient.section],
  answer: CORRECT_ANSWER,
});

const m07: ModuleContent = {
  id: "m07",
  slug: "eval",
  order_index: 7,
  title: "Refinement",
  summary:
    "Stop judging changes on one question. Build a golden set of test questions with known answers, starting with the subcontractor question, and a small program that scores finding the clauses and writing the answer separately, so a change that breaks something shows up as a number, not as a lawyer's complaint.",
  hook: `A teammate tidies the synonym table to help a question about sharing with Affiliates. It works, and nobody asks "${RUNNING_QUESTION}" again. Three weeks later a lawyer does, and the answer has lost ${C.contractors.section}. One edit fixed one question and quietly broke another.`,
  learning_objectives: [
    "Explain why checking a change on one question can hide a change that breaks another",
    "Build a golden set of test questions, each with its gold clauses and a correct answer checked against the non-disclosure agreement (NDA), starting with the subcontractor question",
    "Score finding the clauses (recall@3) separately from the answer (citation accuracy, groundedness and the answer check)",
    "Use a second large language model (LLM) as a judge, and check its grades against answers you graded by hand",
    "Report scores per routing tag, and turn every thumbs-down into a new golden-set row",
  ],
  estimated_minutes: 90,
  is_published: true,
  pipeline_stages: ["eval-guardrails"],
  explain_back_prompt: `In your own words: the subcontractor row finds ${C.contractors.section}, ${C.permittedDisclosure.section} and ${C.permittedRecipient.section} in the top 3, cites them correctly, and every claim is backed by a clause. So why does it still fail, and which check catches it?`,
  video: null,

  lesson_steps: [
    {
      id: "m07-s01",
      order_index: 1,
      kind: "warm_up",
      title: "Warm-up: what you already know",
      body_md: `Before we start, answer these from what you remember of Module 6. There are no wrong answers. You'll check yourself against the study guide at the end.

1. A lawyer asked, "May the Receiving Party disclose to a subcontractor?" Which clause did the ready-made re-ranker wrongly put first, and why?
2. Why did you keep some training pairs aside, in a held-out set, instead of training on all of them?
3. After fine-tuning, how did you check that the tuned re-ranker really was better than the base model?`,
    },
    {
      id: "m07-s02",
      order_index: 2,
      kind: "concept",
      title: "One fix, one silent break",
      body_md: `Here's how the system broke without anyone noticing.

A colleague at Beta asks, "Can we share this with our parent company?" A parent company is an Affiliate, and ${C.permittedDisclosure.section} allows sharing with Affiliates. But the answer came back vague. So a teammate opens the **synonym table**, Module 2's short list that adds the NDA's own words to a question before searching. They tidy two rows into one: **third party → Affiliates, Permitted Recipient**. They ask the parent-company question again. Much better. Done.

What they didn't notice: the old subcontractor row said **subcontractor → third party, Permitted Recipient, contractor**. In the tidy-up, "contractor" fell out. Without it, keyword search no longer spots "contractors" in ${C.contractors.section}, so ${C.contractors.section} never makes the ten clauses the re-ranker reads. A re-ranker can only reorder what reaches it.

So "${RUNNING_QUESTION}" slides back to Module 2's answer: "Yes, to Permitted Recipients bound by written confidentiality obligations (${C.permittedDisclosure.section})." No error. No warning. Three weeks later, a lawyer spots it.

The teammate wasn't careless. They did what we've done all course: change something, try **one question**, and move on. That's the real problem.

:::key What Module 7 adds
Module 7 starts the last stage: **[6] eval & guardrails**. Eval is short for evaluation: testing the system on questions whose right answers you already know. That's why the map's 📍 You are here marker sits on that stage.

You'll build a **golden set**, a fixed list of test questions with known answers, with the subcontractor question as its first row, and a small program that scores the whole pipeline on it. Then a change like the teammate's shows up as a number dropping, the same day.

Three things are still missing. Someone still has to remember to run it, which Module 8 automates. The guardrails half, blocking a bad answer before a user sees it, comes in Module 9. And the eval will show the answer's muddled second route under ${C.permittedDisclosure.section}, which Module 10 fixes.
:::`,
    },
    {
      id: "m07-s03",
      order_index: 3,
      kind: "concept",
      title: "The golden set: questions with known answers",
      body_md: `A golden set lives in a file called \`eval/golden.jsonl\`. It's a plain text file of test questions, one per line. Each line, or **row**, holds four things:

- **The question**, worded the way a real person asks it.
- **Its type**, such as permission, duration or definition, so you can see which kinds of question are weak.
- **The gold clauses**: the clauses that must be found to answer it. For the subcontractor question that's ${C.contractors.section}, ${C.permittedDisclosure.section} and ${C.permittedRecipient.section}.
- **The correct answer**, written by someone who read the NDA and checked it.

The subcontractor question goes in first. Its correct answer is the one this whole course is working towards: "${CORRECT_ANSWER}"

Notice what that row is **not**. It isn't the answer the system gives today. It's the answer it **should** give. The golden set is the measuring stick, so it has to be right even when the system isn't.

**Three rules for good rows**
1. **Use people's own words.** Never put the clause or its section number into the question. "Does ${C.permittedDisclosure.section} allow sharing with a subcontractor?" gives the answer away.
2. **Include questions the NDA doesn't answer.** At least one row in ten should have the answer "The contract does not address this." Otherwise you never test whether the system admits it.
3. **Start small and real.** Fifty rows is plenty to begin: about 30 questions your team really asked, and 20 written to fill the gaps.

:::more The nine kinds of question to cover
Aim for a few rows of each: **permission** (can we share it?), **obligation** (what must we do?), **restriction** (what can't we do?), **duration** (how long does it last?), **money** (who pays?), **definition-dependent** (does a subcontractor count as a Permitted Recipient?), **conflict** (two clauses seem to disagree, like ${C.contractors.section} and ${C.permittedDisclosure.section}), **absence** (the NDA doesn't say), and **paraphrase pairs** (the same question in two wordings, like the plain and the lawyer's version from Module 6). At least one row in ten should honestly be "it depends".
:::`,
      code_snippet: `# eval/golden.jsonl: one test question per line
${GOLDEN_ROW}
{"id": "nda-002", "question": "Can we share this with our parent company?", "type": "permission", "gold_clauses": ["§4.2(b)"], "answer": "Yes, Affiliates may receive it if each is bound by written confidentiality obligations no less protective than this Agreement (§4.2(b))."}
{"id": "nda-003", "question": "May the Receiving Party disclose to a subcontractor?", "type": "paraphrase", "gold_clauses": ["§4.5", "§4.2(b)", "§1.4"], "answer": "Same as nda-001."}
{"id": "nda-004", "question": "How long does this NDA last?", "type": "duration", "gold_clauses": ["§7"], "answer": "Two years from the Effective Date (§7)."}
{"id": "nda-005", "question": "Is there a fee if we break the NDA?", "type": "absence", "gold_clauses": [], "answer": "The contract does not address this."}`,
      code_language: "json",
    },
    {
      id: "m07-s04",
      order_index: 4,
      kind: "concept",
      title: "Scoring two things separately",
      body_md: `Now you need something to run the questions. That's \`evaluate.py\`, a small program you write. It reads every row of the golden set, sends each question through the whole pipeline, and scores what comes back. Then it writes the scores to \`eval/results.json\`, a plain text file you can open and compare between runs.

It scores two things **separately**, because they break for different reasons.

**1. Did we find the right clauses?**
- **Recall@3:** are the row's gold clauses in the top 3 clauses the writer reads? For the subcontractor row today: ${C.contractors.section}, ${C.permittedDisclosure.section}, ${C.permittedRecipient.section}. All three. **Pass.**

**2. Did we write a good answer from them?**
- **Citation accuracy:** does each cited clause really say what the answer claims? The answer cites ${C.contractors.section} for "prior written consent", and it does say that. **Pass.**
- **Groundedness:** is every claim backed by the clauses the writer was given? "Under ${C.permittedDisclosure.section} you may also share with Permitted Recipients" is backed by ${C.permittedDisclosure.section}'s text. **Pass.**
- **Answer check:** does the answer say what the row's correct answer says? The correct answer says ${C.permittedDisclosure.section} **doesn't** cover a subcontractor. Ours offers it as a second route. **Fail.**

That's the payoff. Every other score says the answer is fine. Only the answer check, comparing against a known right answer, catches the muddle. Now it's **measured, not guessed**.

**Who grades the answer?** Recall@3 is simple counting. The other three need reading, so a second language model does the grading: an approach called **LLM-as-judge**. You give it instructions in a prompt file, such as \`prompts/judge_groundedness.md\`, plus the answer, the clauses and the row's correct answer. Before you trust it, grade 10 answers yourself and check the judge mostly agrees with you.`,
      code_snippet: `# evaluate.py: run every golden-set question and score it
import json
from pipeline import answer_question   # your pipeline: rewrite, retrieve, clean, re-rank, generate
from judge import judge                # asks the judge model, using prompts/judge_*.md

rows = [json.loads(line) for line in open("eval/golden.jsonl")]
results = []
for row in rows:
    out = answer_question(row["question"])
    top3 = [c.section for c in out.clauses[:3]]
    results.append({
        "id": row["id"],
        "tag": out.routing_tag,                                   # simple, multi-clause or conflicting
        "recall_at_3": all(g in top3 for g in row["gold_clauses"]),
        "citation_accuracy": judge("citation", out, row),
        "groundedness": judge("groundedness", out, row),
        "answer_check": judge("answer", out, row),                # compares with row["answer"]
    })
json.dump(results, open("eval/results.json", "w"), indent=2)`,
      code_language: "python",
    },
    {
      id: "m07-s05",
      order_index: 5,
      kind: "concept",
      title: "Reading the results",
      body_md: `A golden set is only useful if you read its results the right way. Three habits help.

**Compare against a baseline.** Before any change, run the eval and keep the results. That's your **baseline**. After the change, run it again and compare row by row. Replay the teammate's synonym-table edit and the comparison says it plainly: the parent-company row got better, and the subcontractor row lost ${C.contractors.section} from its top 3. That's a **regression**: something that worked and quietly got worse. Now you see it before the change goes live, not three weeks later.

**Split the scores by routing tag.** Since Module 2, every question gets a routing tag: simple, multi-clause or conflicting. One overall number hides a weak group. Recall@3 of 0.88 across the set sounds fine. Split by tag, simple questions score 0.96 and multi-clause ones 0.71. The subcontractor question is tagged multi-clause, so that's the group to work on.

**Turn complaints into rows.** Add a thumbs-down button to the answers. When someone clicks it, save their question and what they expected. Someone checks it against the NDA, writes the gold clauses and the correct answer, and adds it to \`eval/golden.jsonl\`. Every mistake a user finds becomes a test the system has to pass from then on.`,
      code_snippet: `# compare.py: what changed between two runs
before = {r["id"]: r for r in json.load(open("eval/baseline.json"))}
after = {r["id"]: r for r in json.load(open("eval/results.json"))}
for id, r in after.items():
    for metric in ["recall_at_3", "citation_accuracy", "groundedness", "answer_check"]:
        if before[id][metric] and not r[metric]:
            print(f"REGRESSED  {id}  {metric}")

# REGRESSED  nda-001  recall_at_3     <- "Can we share this with a subcontractor?" lost §4.5`,
      code_language: "python",
    },
    {
      id: "m07-s06",
      order_index: 6,
      kind: "exercise",
      title: "Hands-on: try it yourself",
      body_md: `**Predict first:** on your current pipeline, will the subcontractor row pass recall@3? Will it pass the answer check? Write down both guesses before you run anything.

- **Guided:** Write \`eval/golden.jsonl\` with the subcontractor row first and at least 9 more questions about the NDA, covering different kinds of question. Run \`evaluate.py\` and list the 5 worst rows.
- **Partial:** Save your results as the baseline. Then make the teammate's synonym-table edit on purpose, run the eval again, and show which row breaks. Undo it, fix your worst row by changing only one stage, and show that no other row regressed.
- **Solo:** Write a judge prompt for groundedness, \`prompts/judge_groundedness.md\`. Grade 10 answers yourself, let the judge grade the same 10, and count how often you agree. Change the prompt until you agree on at least 9.

**Files you create:** \`eval/golden.jsonl\`, your test questions, one per line; \`eval/results.json\`, the scores from each run; and \`prompts/judge_citation.md\` and \`prompts/judge_groundedness.md\`, the judge's instructions.

**Capstone branch:** save this work on a branch called \`eval\` in your course project. It needs \`evaluate.py\` and a results table saved alongside the code every time you change something.

**Check it with your assistant:** ask your coding assistant, "Does my eval branch read eval/golden.jsonl, include the subcontractor question as a row, compute recall@3, citation accuracy, groundedness and the answer check, and report each one per routing tag?"`,
    },
    {
      id: "m07-s07",
      order_index: 7,
      kind: "concept",
      title: "What an eval can't tell you",
      body_md: `A golden set is a big step up from trying one question. But it has limits, and it's worth knowing them.

- **It only checks what's in it.** It knows "${RUNNING_QUESTION}" because you put it there. It knows nothing about "Can the subcontractor's engineers see Acme's drawings?" until someone adds that row. Keep feeding it thumbs-downs and real questions, or the score drifts away from what people actually ask.
- **The judge can be wrong too.** It's a language model, so it can be fooled, for example by long answers that sound thorough. Re-check it against hand-graded answers whenever you change its prompt.
- **It doesn't run itself.** Right now someone still has to remember to run \`evaluate.py\` after every change. Forget once, and the subcontractor row can fail for days. Module 8 makes it run automatically.
- **It measures; it doesn't fix.** The eval tells you the subcontractor answer still offers a route under ${C.permittedDisclosure.section} it shouldn't. Fixing that takes legal know-how, which is Module 10.`,
    },
  ],

  worked_example: [
    {
      id: "m07-w01",
      order_index: 1,
      title: "The question becomes a row",
      body_md: `The subcontractor question goes into \`eval/golden.jsonl\` as its first row, with its gold clauses and the correct answer, checked against the NDA by hand.`,
      code_snippet: GOLDEN_ROW,
      code_language: "json",
      stage: "eval-guardrails",
      query_state: `A test row: gold clauses ${C.contractors.section}, ${C.permittedDisclosure.section}, ${C.permittedRecipient.section}, plus the correct answer.`,
    },
    {
      id: "m07-w02",
      order_index: 2,
      title: "Run it through the pipeline",
      body_md: `\`evaluate.py\` sends "${RUNNING_QUESTION}" through every stage you've built: rewrite, search, clean, re-rank, write. It records the top 3 clauses, the routing tag and the answer:

> "${CURRENT_ANSWER}"`,
      stage: null,
      query_state: `Top 3: ${C.contractors.section}, ${C.permittedDisclosure.section}, ${C.permittedRecipient.section}. Tagged multi-clause.`,
    },
    {
      id: "m07-w03",
      order_index: 3,
      title: "Score the clauses it found",
      body_md: `Recall@3 compares the top 3 with the row's gold clauses. ${C.contractors.section}, ${C.permittedDisclosure.section} and ${C.permittedRecipient.section} are all there. Finding the clauses is working.`,
      stage: "eval-guardrails",
      query_state: "Recall@3: pass (3 of 3 gold clauses in the top 3).",
    },
    {
      id: "m07-w04",
      order_index: 4,
      title: "Score the answer",
      body_md: `The judge model grades the answer three ways:

- **Citation accuracy: pass.** ${C.contractors.section} really does require prior written consent.
- **Groundedness: pass.** Every sentence is backed by a clause the writer was given.
- **Answer check: fail.** The correct answer says ${C.permittedDisclosure.section} doesn't cover a subcontractor, because a subcontractor isn't a Permitted Recipient under ${C.permittedRecipient.section}. Our answer offers it as a second route.

The muddle is now a measured failure on a named row, not a hunch.`,
      stage: "eval-guardrails",
      query_state: "Citations and groundedness pass. The answer check fails on the second route.",
    },
    {
      id: "m07-w05",
      order_index: 5,
      title: "Replay the teammate's edit",
      body_md: `Save these results as the baseline. Now apply the synonym-table edit that dropped "contractor" and run the eval again. The comparison shows both sides at once: the parent-company row improves, and the subcontractor row loses ${C.contractors.section} from its top 3, so recall@3 fails. The edit is caught before it goes live.`,
      stage: "eval-guardrails",
      query_state: `With the edit: ${C.contractors.section} out of the top 3, recall@3 fails. Regression caught.`,
    },
    {
      id: "m07-w06",
      order_index: 6,
      title: "Read the report by routing tag",
      body_md: `Across the 50 rows, recall@3 is 0.88. Split by routing tag, simple questions score 0.96 and multi-clause ones 0.71, and the answer check is weakest on multi-clause rows too. The subcontractor row sits in that weak group, with a failure you can name. Module 8 will run this report on every change; Module 10 will fix the answer.`,
      stage: "eval-guardrails",
      query_state: "Measured: finds the right clauses, but the answer fails the answer check.",
    },
  ],

  // Every term a learner meets in this module (tests/unit/glossary-coverage.test.ts
  // checks none is missing): contract words first, then the rest.
  glossary: [
    "nda", "clause", "section-sign", "subcontractor", "third-party", "permitted-recipient", "confidential-information",
    "disclosing-party", "receiving-party", "affiliate", "amendment", "notwithstanding", "written-consent",
    "eval", "golden-set", "gold-clause", "eval-script", "metric", "recall-at-3", "citation-accuracy", "groundedness", "answer-check",
    "llm", "llm-as-judge", "language-model", "prompt", "citation", "baseline", "regression", "routing-tag", "guardrail",
    "synonym-table", "keyword-search", "re-rank", "fine-tuning", "base-model", "training-pair", "held-out-set", "branch",
  ],

  study_guide: [
    {
      id: "m07-p01",
      order_index: 1,
      point: "Checking a change on one question hides what it breaks elsewhere. One synonym-table edit fixed the Affiliates question and dropped §4.5 from the subcontractor answer.",
      narration: `Watch a teammate merge two rows of the synonym table and re-ask the parent-company question. It improves. Off screen, the word "contractor" has fallen out, and the subcontractor question quietly loses §4.5. Nobody looks, because nobody asked it again.`,
    },
    {
      id: "m07-p02",
      order_index: 2,
      point: "A golden set is a file of test questions with known answers. Each row holds the question, its type, its gold clauses and the correct answer.",
      narration: `See the first line of eval/golden.jsonl: "Can we share this with a subcontractor?", with gold clauses §4.5, §4.2(b) and §1.4, and the answer a lawyer would give. It's not what the system says today. It's what it should say, the measuring stick for every change.`,
    },
    {
      id: "m07-p03",
      order_index: 3,
      point: "Good rows use people's own words, never the clause number, and at least one in ten should be \"The contract does not address this.\"",
      narration: `Compare two test questions. One names §4.2(b) and passes every time, telling you nothing. The other says "subcontractor", the way people really ask. Add rows the NDA can't answer, too, so you test whether the system admits it.`,
    },
    {
      id: "m07-p04",
      order_index: 4,
      point: "Score finding the clauses (recall@3) separately from the answer (citation accuracy, groundedness and the answer check).",
      narration: `Follow the subcontractor row through evaluate.py. The top 3 hold all three gold clauses: pass. The citations are correct, every claim is backed: pass, pass. Then the answer check compares it with the correct answer and fails it, for offering a route under §4.2(b) that doesn't apply.`,
    },
    {
      id: "m07-p05",
      order_index: 5,
      point: "A second language model can grade answers (LLM-as-judge), but only after you've checked it agrees with answers you graded by hand.",
      narration: `See ten answers graded twice: once by you, once by the judge. Where you disagree, the judge prompt needs work. A judge that loves long answers would score a rambling paragraph above the correct one-liner.`,
    },
    {
      id: "m07-p06",
      order_index: 6,
      point: "Compare every run with a baseline, split scores by routing tag, and turn every thumbs-down into a new row.",
      narration: `Watch the replayed edit: the comparison flags the subcontractor row the moment it regresses. Split by routing tag, multi-clause questions score lowest. And each thumbs-down a user clicks becomes a row the system must pass from then on.`,
    },
  ],

  quiz_items: [
    {
      id: "m07-q01",
      lesson_step_id: "m07-s02",
      order_index: 1,
      kind: "single_choice",
      prompt: "A teammate's synonym-table edit improved the Affiliates question, and they checked only that question. Why is that dangerous?",
      choices: [
        { id: "a", text: "Checking one question takes too long" },
        { id: "b", text: "A fix for one question can silently break another, like the subcontractor question losing §4.5" },
        { id: "c", text: "The synonym table can't be edited once it's built" },
        { id: "d", text: "It isn't; one good question is enough" },
      ],
      answer: { choice: "b" },
      explanation: "Only running the whole golden set shows what a change broke elsewhere.",
      difficulty: 1,
    },
    {
      id: "m07-q02",
      lesson_step_id: "m07-s03",
      order_index: 2,
      kind: "multi_choice",
      prompt: "Which of these belong in the subcontractor question's row of eval/golden.jsonl?",
      choices: [
        { id: "a", text: "The question in a user's own words: \"Can we share this with a subcontractor?\"" },
        { id: "b", text: "The gold clauses: §4.5, §4.2(b) and §1.4" },
        { id: "c", text: "The correct answer, checked against the NDA" },
        { id: "d", text: "Whatever answer the system gives today" },
      ],
      answer: { choices: ["a", "b", "c"] },
      explanation: "The row records what the system should do, not what it does now. Otherwise it could never catch a wrong answer.",
      difficulty: 1,
    },
    {
      id: "m07-q03",
      lesson_step_id: "m07-s04",
      order_index: 3,
      kind: "single_choice",
      prompt: "The subcontractor row's gold clauses are §4.5, §4.2(b) and §1.4. The writer reads §4.5, §4.2(b) and §1.4. What does recall@3 say?",
      choices: [
        { id: "a", text: "Pass: all the gold clauses are in the top 3" },
        { id: "b", text: "Fail: the answer still offers a second route" },
        { id: "c", text: "Nothing yet, because recall@3 needs a judge model" },
        { id: "d", text: "Fail: there should be more than 3 clauses" },
      ],
      answer: { choice: "a" },
      explanation: "Recall@3 only measures finding the clauses. The muddled answer is caught by a different check.",
      difficulty: 1,
    },
    {
      id: "m07-q04",
      lesson_step_id: "m07-s04",
      order_index: 4,
      kind: "single_choice",
      prompt: "The subcontractor answer passes recall@3, citation accuracy and groundedness, yet a lawyer says it's wrong. Which check catches it?",
      choices: [
        { id: "a", text: "Recall@3 at a higher cut-off" },
        { id: "b", text: "Citation accuracy, run twice" },
        { id: "c", text: "The answer check, which compares it with the row's correct answer" },
        { id: "d", text: "None; an eval can't catch this" },
      ],
      answer: { choice: "c" },
      explanation: "Every claim is backed by a clause, but the answer offers a route under §4.2(b) that the correct answer rules out. Only comparing with the known answer shows it.",
      difficulty: 2,
    },
    {
      id: "m07-q05",
      lesson_step_id: "m07-s03",
      order_index: 5,
      kind: "single_choice",
      prompt: "Why should at least one row in ten have the answer \"The contract does not address this.\"?",
      choices: [
        { id: "a", text: "To make the golden set longer" },
        { id: "b", text: "To test that the system admits when the NDA is silent instead of guessing" },
        { id: "c", text: "Because one clause in ten is blank" },
        { id: "d", text: "To lower the overall score on purpose" },
      ],
      answer: { choice: "b" },
      explanation: "If the set never needs that answer, a system that always invents one would still score well.",
      difficulty: 2,
    },
    {
      id: "m07-q06",
      lesson_step_id: "m07-s05",
      order_index: 6,
      kind: "single_choice",
      prompt: "A user clicks thumbs-down on an answer about sharing with a subcontractor. What should happen to it?",
      choices: [
        { id: "a", text: "Delete the answer from the records" },
        { id: "b", text: "After checking the NDA, add the question, gold clauses and correct answer to the golden set" },
        { id: "c", text: "Retrain the re-ranker straight away" },
        { id: "d", text: "Nothing; one click isn't evidence" },
      ],
      answer: { choice: "b" },
      explanation: "Every mistake a user finds becomes a test the system has to pass from then on.",
      difficulty: 1,
    },
    {
      id: "m07-q07",
      lesson_step_id: "m07-s05",
      order_index: 7,
      kind: "single_choice",
      prompt: "Recall@3 is 0.88 overall, but 0.71 for multi-clause questions like the subcontractor one. Why report it per routing tag?",
      choices: [
        { id: "a", text: "One overall number can hide a weak group of questions" },
        { id: "b", text: "Routing tags make the report shorter" },
        { id: "c", text: "The routing tag changes the gold clauses" },
        { id: "d", text: "Overall numbers are always wrong" },
      ],
      answer: { choice: "a" },
      explanation: "The average looks fine while the hardest questions, the ones that matter most, fail.",
      difficulty: 2,
    },
  ],

  failure_cases: [
    {
      id: "m07-f01",
      order_index: 1,
      title: "The question that gives the answer away",
      category: "evaluation",
      user_query: `Does Section 4.2(b), which allows disclosure to Permitted Recipients, allow sharing with a subcontractor?`,
      retrieved_context: [
        { source: cite(C.permittedDisclosure), text: C.permittedDisclosure.text, score: 0.97 },
        { source: cite(C.permittedRecipient), text: C.permittedRecipient.text, score: 0.9 },
        { source: cite(C.contractors), text: C.contractors.text, score: 0.83 },
      ],
      bad_output: "This golden-set row passes recall@3 every run, and the whole set scores 100%. Yet lawyers keep reporting answers that miss §4.5.",
      symptom: "A perfect score that says nothing about the questions people really ask.",
      root_cause: `The question names ${C.permittedDisclosure.section} and its wording, so keyword search finds it instantly. Real users never ask that way, so the row tests nothing they'd run into.`,
      fix: `Write golden-set questions in users' own words ("${RUNNING_QUESTION}"), and never put the clause or its number in the question unless the question is about the number itself.`,
      cause_options: [
        { id: "a", text: "The judge prompt is too lenient when it checks citations" },
        { id: "b", text: "The question gives away the clause" },
        { id: "c", text: "The golden set has too few rows to be useful" },
      ],
      correct_cause: "b",
    },
    {
      id: "m07-f02",
      order_index: 2,
      title: "The judge that loves long answers",
      category: "evaluation",
      user_query: RUNNING_QUESTION,
      retrieved_context: [
        { source: cite(C.contractors), text: C.contractors.text, score: 0.95 },
        { source: cite(C.permittedDisclosure), text: C.permittedDisclosure.text, score: 0.86 },
        { source: cite(C.permittedRecipient), text: C.permittedRecipient.text, score: 0.8 },
      ],
      bad_output: `The judge gives a rambling five-paragraph answer about confidentiality in general 9/10, and the correct one-line answer citing ${C.contractors.section} 6/10.`,
      symptom: "The judge prefers the worse answer.",
      root_cause: "The judge prompt asked for a \"thorough, helpful\" answer, so it rewards length. Nobody checked its grades against answers graded by hand.",
      fix: "Tell the judge to score only whether each claim is backed by the clauses and matches the correct answer, never length. Check it against hand-graded answers that include short correct ones.",
      cause_options: [
        { id: "a", text: "The golden set lists the wrong gold clause for this question" },
        { id: "b", text: "Recall@3 was worked out on an old copy of the golden set" },
        { id: "c", text: "The judge rewards length" },
      ],
      correct_cause: "c",
    },
    {
      id: "m07-f03",
      order_index: 3,
      title: "Better score, unhappier users",
      category: "evaluation",
      user_query: "Can the subcontractor's engineers see Acme's drawings?",
      retrieved_context: [
        { source: cite(C.permittedDisclosure), text: C.permittedDisclosure.text, score: 0.84 },
        { source: cite(C.definitions), text: C.definitions.text, score: 0.8 },
        { source: cite(C.permittedRecipient), text: C.permittedRecipient.text, score: 0.77 },
      ],
      bad_output: `"Yes, to Permitted Recipients bound by written confidentiality obligations." (${C.permittedDisclosure.section} ${C.permittedDisclosure.title})`,
      symptom: "Groundedness on the golden set rose from 0.82 to 0.90 this month, while thumbs-down clicks doubled, many on questions like this one.",
      root_cause: "The golden set only holds questions written months ago. New ways of asking, like this one, aren't in it, so the score can't see them fail.",
      fix: "After checking the NDA, turn every thumbs-down into a new golden-set row, and add fresh questions from real users regularly so the set keeps up with what people ask.",
      cause_options: [
        { id: "a", text: "The golden set no longer matches real questions" },
        { id: "b", text: "Users started clicking thumbs-down by mistake on good answers" },
        { id: "c", text: "The scores were read from last week's results file" },
      ],
      correct_cause: "a",
    },
  ],
};

export default m07;
