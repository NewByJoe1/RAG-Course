import type { ModuleContent } from "../types";
import { cite, NDA_CLAUSES as C, RUNNING_QUESTION } from "../nda";

// Module 9, rewritten on the running example. In production, the answer to the
// subcontractor question quotes a sentence that isn't in the NDA (a
// hallucinated quote), and under load one customer sees another customer's
// clause. The rescue is the harness around the pipeline: gateway, queue,
// workers, gates (citation verification, groundedness, tenant check), versioned
// prompts, a kill switch, fail closed and a fallback. It sets up what Module 10
// recalls: the gates block a made-up quote, but the muddled second route passes
// every gate, because that's a reasoning problem, not a checking one.
//
// Quiz, step and failure ids are unchanged from the original Module 9, so
// existing attempts and review cards keep pointing at the same slots.

const FAKE_QUOTE = "Subcontractors may receive Confidential Information if they are bound by written confidentiality obligations.";
const BAD_ANSWER = `Yes, with conditions. ${C.contractors.section} states: "${FAKE_QUOTE}" (${C.contractors.section} ${C.contractors.title})`;
const FALLBACK = `I couldn't verify a quote in this answer, so I'm not showing it. These clauses look relevant: ${C.contractors.section} ${C.contractors.title}, ${C.permittedDisclosure.section} ${C.permittedDisclosure.title}, ${C.permittedRecipient.section} ${C.permittedRecipient.title}. Please read them directly.`;

const m09: ModuleContent = {
  id: "m09",
  slug: "harness",
  order_index: 9,
  title: "Production Harness",
  summary:
    "Put the pipeline inside a production harness: a gateway, a queue and workers that keep customers apart, plus gates that check every live answer before it's shown. A made-up quote about subcontractors is blocked and replaced by a safe refusal, and one switch can turn answering off.",
  hook: `A lawyer at Beta asks the live contract assistant, "${RUNNING_QUESTION}" The answer quotes ${C.contractors.section} as saying "${FAKE_QUOTE}" It looks official. But that sentence isn't in the non-disclosure agreement (NDA) at all: the model made it up. The same week, on a busy morning, another user was shown a clause from a different customer's NDA.`,
  learning_objectives: [
    "Explain what a production harness is: the gateway, queue, workers and checks around the pipeline that make it safe to rely on",
    "Build a citation-verification gate that blocks any answer whose quote isn't in the NDA word for word",
    "Keep each customer's contracts walled off, with tenant isolation enforced in the database rather than in the prompt",
    "Version every prompt, and add a kill switch, a fallback and a fail-closed rule",
    "Explain why a safe refusal beats a confident made-up quote in a legal answer",
  ],
  estimated_minutes: 95,
  is_published: true,
  pipeline_stages: ["eval-guardrails"],
  explain_back_prompt: `In your own words: the nightly eval from Module 8 was passing, yet a live answer quoted a sentence that isn't in ${C.contractors.section}. Why didn't the eval catch it, and which gate stops it now?`,
  video: null,

  lesson_steps: [
    {
      id: "m09-s01",
      order_index: 1,
      kind: "warm_up",
      title: "Warm-up: what you already know",
      body_md: `Before we start, answer these from what you remember of Module 8. There are no wrong answers. You'll check yourself against the study guide at the end.

1. In Module 8 the eval started running by itself at two different moments. What were they, and what kind of change does each one catch?
2. What is a canary question? Why does the subcontractor canary check ${C.contractors.section}, but not the whole answer?
3. An index rebuild knocked ${C.contractors.section} out of the top 3. How quickly did someone hear about it, and how?`,
    },
    {
      id: "m09-s02",
      order_index: 2,
      kind: "concept",
      title: "The quote nobody wrote",
      body_md: `Let's start with a story.

Your contract assistant is now in **production**: the live version that Beta's lawyers use every day. One afternoon a lawyer asks, **"${RUNNING_QUESTION}"**

Retrieval does its job. ${C.contractors.section} comes back first, ${C.permittedDisclosure.section} second and ${C.permittedRecipient.section} third, just as Module 5 arranged. The writer has the real ${C.contractors.section} right in front of it. And it writes this:

> ${BAD_ANSWER}

Now read what ${C.contractors.section} really says:

> "${C.contractors.text}"

The model blended ${C.contractors.section} with the condition from ${C.permittedDisclosure.section}, then put quote marks around the blend. That's a **hallucination**: a quote that isn't in the text it was given. And it flips the meaning. A lawyer who trusts that quote tells Beta it can share with a subcontractor once the subcontractor signs a confidentiality agreement, without asking Acme. That's exactly what ${C.contractors.section} forbids.

Why didn't Module 8 catch it? The nightly run checks the golden set at 3:17. This answer was written at 2:40 in the afternoon, for one person. A language model doesn't write the same words twice, so tonight's test answer can be fine while this afternoon's live one isn't. **The eval tests the system. Nothing was testing this answer.**

The same week, a second failure: on a busy Monday morning, with a hundred people asking at once, a Beta user was shown a clause from a different customer's NDA. In a product whose whole job is keeping secrets.

Neither is fixed by a cleverer model. Both are fixed by structure: the checks and walls you build **around** the model.

:::key What Module 9 adds, and what's still wrong
Module 8 built the evaluation half of **[6] eval & guardrails**. Module 9 builds the other half, the **guardrails**: automatic checks that look at every live answer before anyone sees it, and block it if it fails. That's why the map's 📍 You are here marker sits on that stage again. Finding and writing the answer don't change. The new parts wrap around them.

What's still wrong: guardrails block bad answers, they don't write better ones. The subcontractor answer still says "Under ${C.permittedDisclosure.section} you may also share with Permitted Recipients", and that passes every check, because each sentence really is backed by a clause. Knowing that ${C.contractors.section} overrides ${C.permittedDisclosure.section} is legal reasoning, and that's Module 10.
:::`,
    },
    {
      id: "m09-s03",
      order_index: 3,
      kind: "concept",
      title: "The harness: everything around the model",
      body_md: `Think of an airport. The aeroplane flies, but the airport is what makes flying safe: check-in, waiting lines, separate lounges, security checks, and a control tower that can stop all flights. The **production harness** is the airport around your pipeline.

Follow the subcontractor question through it:

1. **The gateway** is the single front door every question comes through. It checks who's asking and which customer they belong to (here, Beta). It also applies a **rate limit**: a cap on how many questions one user can send per minute, so one busy user can't slow everyone else down.
2. **The queue** is a waiting line. The gateway puts the question at the end, together with a label saying "customer: Beta". When a hundred questions arrive at once, they wait their turn instead of crashing the system.
3. **Workers** are programs that take one question off the front of the queue, run the whole pipeline from Modules 1 to 6 on it, and return the answer. Several run side by side, so the line keeps moving.
4. **Gates** check the answer before it leaves. That's the next part.
5. **The kill switch** turns answering off. That's the part after.

**Why the other customer's clause leaked**

Each customer is a **tenant**: their contracts are theirs alone. Keeping tenants walled off is called **tenant isolation**.

The old script from Module 8 kept "the current customer" in one shared setting. When two questions arrived at the same moment, the second one overwrote it, and Beta's search ran over another customer's clauses. Nobody had seen this, because nobody had sent questions concurrently before.

The fix has two layers. First, the customer label travels with every job, so a worker never has to guess. Second, the **database** enforces it too, with **row-level security**: each stored clause is labelled with its customer, and the database hides every row that doesn't match, whatever the code asks for. Writing "only use Beta's contracts" in the prompt isn't enough. A prompt is a request. A database rule is a lock.

:::more How you prove it: a load test
A **load test** sends many questions at once on purpose, to see whether the system copes before real users find out. Send 100 concurrent questions, half as Beta and half as a second test customer, all asking about subcontractors. Then count the answers that cite a clause from the other customer. The only acceptable number is zero.
:::`,
      code_snippet: `# worker.py: one worker, taking questions off the queue one at a time
while True:
    job = queue.next()                            # waits for the next question
    flags = load_flags("config/flags.yaml")
    if not flags["serving"]["enabled"]:           # kill switch is off
        job.reply(SAFE_REFUSAL)
        continue
    with db.as_customer(job.customer):            # row-level security: this customer's rows only
        clauses = retrieve(job.question)          # the pipeline from Modules 1 to 6
        draft = generate(job.question, clauses, prompt=PROMPTS["generate"])
        job.reply(check_gates(draft, clauses, job.customer))`,
      code_language: "python",
    },
    {
      id: "m09-s04",
      order_index: 4,
      kind: "concept",
      title: "Gates: check every answer before it's shown",
      body_md: `A **gate** is one automatic check that an answer must pass before anyone sees it. The subcontractor answer goes through three, in order:

1. **Citation verification: is every quote really there?** Take each sentence the answer puts in quote marks and search the NDA for it, word for word. The made-up quote isn't anywhere in the NDA, so the answer is blocked.
2. **The groundedness check: is every claim backed?** A second model reads the answer and the clauses, and for each claim names the clause that supports it, or says "none". Its instructions live in a prompt file, \`prompts/refusal_check.md\`: a plain text file your code reads and sends to the model. "If they are bound by written confidentiality obligations" has no support in ${C.contractors.section}, so this gate would block it too.
3. **The tenant check: is every cited clause Beta's?** Row-level security should already guarantee it. Checking again costs almost nothing and catches the day someone breaks the first wall.

**Fail closed**

Sometimes a gate can't run: the store holding the NDA's text doesn't respond, or the checking model takes too long. Then the answer is blocked, not waved through. This is called **failing closed**, like a fire door that shuts when the power goes.

**The fallback: what the lawyer sees instead**

A blocked answer isn't a blank screen. The lawyer gets the **fallback**: a **safe refusal**, an honest "I can't give you a verified answer", plus the clauses that were found, so they can read them:

> "${FALLBACK}"

The rule for every gate is **when in doubt, refuse**. A refusal is annoying. A made-up quote in a legal answer can cost Beta its relationship with Acme.

:::more Tidying before you compare
Text copied out of a PDF (Portable Document Format) file often has line breaks and double spaces in odd places, and curly quote marks where the model writes straight ones. So before comparing, tidy both the quote and the NDA the same way: squash every run of spaces and line breaks into one space, straighten the quote marks, and ignore capitals. Otherwise the gate blocks correct answers too.
:::`,
      code_snippet: `# gates.py: run before any answer is shown
import re

def tidy(text):
    text = text.replace("“", '"').replace("”", '"').replace("’", "'")
    return " ".join(text.split()).lower()      # one space between words

def quotes_are_real(answer, nda_text):
    nda = tidy(nda_text)
    for quote in re.findall(r'"([^"]+)"', tidy(answer)):
        if quote not in nda:
            return False, quote
    return True, None

def check_gates(draft, clauses, customer):
    try:
        ok, bad = quotes_are_real(draft.text, nda_text_for(customer))
        if not ok:
            return fallback(clauses, reason=f"quote not found: {bad}")
        if not grounded(draft, clauses):      # uses prompts/refusal_check.md
            return fallback(clauses, reason="unsupported claim")
        if any(c.customer != customer for c in draft.cited):
            return fallback(clauses, reason="clause from another customer")
        return draft
    except Exception:
        return fallback(clauses, reason="a check couldn't run")  # fail closed`,
      code_language: "python",
    },
    {
      id: "m09-s05",
      order_index: 5,
      kind: "concept",
      title: "Labels and switches: versioned prompts and the kill switch",
      body_md: `Two more pieces make the harness safe to run for months, not just for a demo.

**Versioned prompts: which instructions wrote this answer?**

When the made-up subcontractor quote turns up, your first question is: which prompt produced it? Prompt files change. Someone tightens a sentence in \`prompts/generate.md\` on Thursday, and by Friday the answers read differently.

So every prompt gets a **version** label, worked out as a **hash** of the file: a short fingerprint calculated from its contents. Change one letter and the fingerprint changes, so no edit can sneak through unlabelled. Every answer is saved in the **answer log**, the running record the system writes as it works, along with the question, the customer, the prompt version and which gates passed. Now you can replay the exact prompt that wrote the made-up quote, fix it, and prove the fix.

**The kill switch: one setting that stops everything**

The **kill switch** is a single setting, \`serving.enabled\`, in the flags file \`config/flags.yaml\`. That's a plain text settings file of on/off switches that the workers read before every question. Set it to false and every question gets the safe refusal.

Two details matter:

- **Workers check it before every job**, not just the gateway before accepting new ones. Otherwise the questions already waiting in the queue still get answered after you've switched off.
- **A machine may switch it off; only a person switches it back on.** If Module 8's nightly run finds the subcontractor canary failing, or the gates suddenly block one answer in five, the system can turn itself off. Stopping is always safe. Starting again needs someone to confirm the problem is fixed.`,
      code_snippet: `# config/flags.yaml: on/off switches the workers read before every question
serving:
  enabled: true          # the kill switch. false = every answer is a safe refusal
  auto_off_when:         # a machine may turn it off...
    canary_failed: true
    blocked_share_over: 0.20
  # ...but only a person sets enabled back to true.

prompts:
  generate: prompts/generate.md        # version = hash of the file, saved with every answer
  refusal_check: prompts/refusal_check.md`,
      code_language: "yaml",
    },
    {
      id: "m09-s06",
      order_index: 6,
      kind: "exercise",
      title: "Hands-on: try it yourself",
      body_md: `**Predict first:** if 100 questions arrive at once, half from Beta and half from another customer, how many answers do you think the Module 8 version will mix up? Write your guess down before you start.

- **Guided:** Run the harness on your own computer: the gateway, the queue and two workers. Do a load test: send 100 concurrent subcontractor questions, half as Beta and half as a second test customer. Count the answers that cite the other customer's clauses. It must be zero.
- **Partial:** Write the citation-verification gate. Test it twice: on the made-up quote ("${FAKE_QUOTE}"), which must be blocked, and on the real ${C.contractors.section} sentence copied with a line break in the middle, which must pass.
- **Solo:** Add the kill switch. Put 20 questions in the queue, set \`serving.enabled\` to false, and show that every one of them, including those already waiting, gets the safe refusal. Write it as a test that runs in CI (continuous integration) with the rest of your eval.

**Files you create:** \`config/flags.yaml\`, the flags file holding the kill switch; the gateway, with row-level security rules in the database so each customer only sees their own clauses; and \`prompts/refusal_check.md\`, the refusal-check prompt your groundedness check sends to the model.

**Capstone branch:** save this work on a branch called \`harness\` in your course project, with a gateway, a queue, workers, two gates, versioned prompts, a kill switch and a fallback. The course reads three numbers from it: zero answers leaked across customers, at least 100 concurrent users tested, and a kill switch test that passed.

**Check it with your assistant:** ask your coding assistant, "Does my harness branch keep customers apart with row-level security in the database, block any answer whose quote isn't word for word in the NDA, fail closed when a check can't run, and have every worker read serving.enabled from config/flags.yaml before each job?"`,
    },
    {
      id: "m09-s07",
      order_index: 7,
      kind: "concept",
      title: "What the harness can't fix",
      body_md: `The harness makes the system safe to rely on. It doesn't make it right. Three limits, all on our NDA:

- **Gates block. They don't reason.** The answer from Module 7, "Disclosure to contractors needs the Disclosing Party's prior written consent (${C.contractors.section}). Under ${C.permittedDisclosure.section} you may also share with Permitted Recipients", passes every gate. Each quote is real and each sentence is backed by a clause. But it leaves a lawyer wondering whether a subcontractor could count as a Permitted Recipient. It can't, and seeing why is Module 10's job.
- **Every gate costs time and money.** The groundedness check is a second model call on every answer. It adds about a second and a little cost each time, so watch p95 latency and cost per query on Module 8's dashboard.
- **A gate that's too strict refuses correct answers.** Each refusal is cheaper than a made-up quote, but a system that refuses everything won't be used. Track how often each gate blocks, and look into any sudden jump.

Before adding a gate, ask: what exact mistake does it stop, and how will you know when it blocks something it shouldn't?`,
    },
  ],

  worked_example: [
    {
      id: "m09-w01",
      order_index: 1,
      title: "Through the front door",
      body_md: `The lawyer's question reaches the gateway. It checks who's asking (a Beta lawyer, signed in), that they're under the rate limit, and which customer they belong to. Then it puts the question in the queue with that label attached, so no worker ever has to guess whose NDA to search.`,
      stage: null,
      query_state: `"${RUNNING_QUESTION}" plus a label: customer Beta. Third in the queue.`,
    },
    {
      id: "m09-w02",
      order_index: 2,
      title: "A worker picks it up",
      body_md: `A free worker takes the question off the queue. First it reads the kill switch: answering is on. Then it opens the database as Beta, so row-level security hides every other customer's clauses, and runs the pipeline. Search, cleaning and re-ranking bring back ${C.contractors.section} first, ${C.permittedDisclosure.section} second and ${C.permittedRecipient.section} third.`,
      stage: "hybrid-retrieval",
      query_state: `Top 3, all Beta's: ${C.contractors.section}, ${C.permittedDisclosure.section}, ${C.permittedRecipient.section}.`,
    },
    {
      id: "m09-w03",
      order_index: 3,
      title: "The writer drafts an answer",
      body_md: `The writer gets the three clauses and \`prompts/generate.md\`, version 3f9c2a1. Its draft looks confident and cited, but its quote of ${C.contractors.section} is a blend of ${C.contractors.section} and ${C.permittedDisclosure.section}. Before the harness, this is what the lawyer saw.`,
      code_snippet: BAD_ANSWER,
      code_language: "text",
      stage: "generation",
      query_state: "A draft answer with a quote nobody wrote. Not shown to anyone yet.",
    },
    {
      id: "m09-w04",
      order_index: 4,
      title: "Gate 1: is the quote really there?",
      body_md: `Citation verification tidies the quote and the NDA the same way, then searches for the quote word for word. It isn't there. The nearest real sentence is ${C.contractors.section}, which says something quite different: no disclosure to contractors without the Disclosing Party's prior written consent.`,
      code_snippet: `quote:   "${FAKE_QUOTE.toLowerCase()}"
in NDA?  no
nearest: ${C.contractors.section} "${C.contractors.text}"
result:  BLOCKED (quote not found)`,
      code_language: "text",
      stage: "eval-guardrails",
      query_state: `Blocked by citation verification: the quote isn't in the NDA.`,
    },
    {
      id: "m09-w05",
      order_index: 5,
      title: "The fallback is shown",
      body_md: `The groundedness check agrees: nothing in ${C.contractors.section} supports "if they are bound by written confidentiality obligations". So instead of the draft, the lawyer sees the fallback, a safe refusal with the clauses that were found:

> "${FALLBACK}"

It's less satisfying than a yes or a no. But the lawyer can read ${C.contractors.section} in ten seconds and see the real rule, and nobody acts on a made-up quote.`,
      stage: "eval-guardrails",
      query_state: "The made-up quote is blocked. A safe refusal, with the clauses found, is shown instead.",
    },
    {
      id: "m09-w06",
      order_index: 6,
      title: "What gets logged",
      body_md: `Every answer, shown or blocked, leaves one line in the answer log: the question, the customer, the prompt version, the clauses and which gate stopped it. With that line you can replay the exact prompt that made up the subcontractor quote, fix it, and add the question to the golden set with a quote check, so the nightly run from Module 8 watches for it too.`,
      code_snippet: `{"question": "${RUNNING_QUESTION}", "customer": "beta",
 "prompt_version": "generate.md@3f9c2a1", "top3": ["§4.5", "§4.2(b)", "§1.4"],
 "gates": {"quote": "failed", "grounded": "failed", "tenant": "passed"},
 "shown": "fallback"}`,
      code_language: "json",
      stage: "eval-guardrails",
      query_state: "Logged with prompt version 3f9c2a1 and the gate that blocked it, ready to replay.",
    },
  ],

  // Every term a learner meets in this module (tests/unit/glossary-coverage.test.ts
  // checks none is missing): contract words first, then the rest.
  glossary: [
    "nda", "clause", "section-sign", "confidential-information", "permitted-recipient", "subcontractor", "disclosing-party", "receiving-party", "affiliate",
    "amendment", "notwithstanding", "written-consent", "language-model", "prompt", "prompt-file", "pdf", "database", "branch",
    "index", "re-rank", "eval", "guardrail", "golden-set", "kill-switch", "ci", "alert", "dashboard",
    "canary", "hallucination", "citation-verification", "tenant-isolation", "fail-closed", "scheduled-job", "cost-per-query", "p95-latency", "production",
    "harness", "gateway", "rate-limit", "queue", "worker", "concurrent", "load-test", "row-level-security", "gate",
    "groundedness-check", "safe-refusal", "fallback", "versioned-prompt", "hash", "flags-file", "log",
  ],

  study_guide: [
    {
      id: "m09-p01",
      order_index: 1,
      point: "Module 8 runs the eval on every change (CI) and every night (a scheduled job). The subcontractor canary checks §4.5 is in the top 3 and cited, and an alert reached someone the same night as the index rebuild.",
      narration: `Watch the two automatic runs from Module 8. A code change starts CI, which runs the canaries, and a failing canary stops the change. At 3:17 every night the full golden set runs, which catches changes that aren't code, like the index rebuild. The alert arrived the same night, not 11 days later.`,
    },
    {
      id: "m09-p02",
      order_index: 2,
      point: "The eval tests the system on the golden set. Guardrails test each live answer before it's shown. A made-up quote can pass the nightly run and still reach a lawyer in the afternoon.",
      narration: `See the lawyer's question come in at 2:40 in the afternoon. Retrieval puts §4.5 first, and the writer still invents a quote that blends §4.5 with §4.2(b)'s condition. The nightly run passed at 3:17. Nothing was checking this one answer, until now.`,
    },
    {
      id: "m09-p03",
      order_index: 3,
      point: "The harness: a gateway (front door, who and which customer, rate limit), a queue (waiting line), workers (run the pipeline, one question each), gates and a kill switch.",
      narration: `Follow the subcontractor question through the airport. The gateway checks the lawyer and labels the question "customer: Beta". It waits in the queue. A worker picks it up, runs the pipeline, and hands the draft to the gates before anything leaves.`,
    },
    {
      id: "m09-p04",
      order_index: 4,
      point: "Tenant isolation belongs in the database (row-level security), not the prompt. Prove it with a load test of 100 concurrent questions from two customers: zero leaks.",
      narration: `Watch two questions arrive at the same moment in the old script. The second overwrites the shared customer setting, and Beta sees another customer's clause. Now the label travels with each job, and the database itself hides every row that isn't Beta's.`,
    },
    {
      id: "m09-p05",
      order_index: 5,
      point: "Gates: every quote must be in the NDA word for word, every claim backed by a clause, every cited clause the asker's own. If a gate can't run, fail closed. Show the fallback: a safe refusal plus the clauses found.",
      narration: `See the made-up quote meet the first gate. It's tidied, searched for in the NDA, and not found. The answer is blocked, and the lawyer gets an honest refusal with §4.5, §4.2(b) and §1.4 listed to read. When in doubt, refuse.`,
    },
    {
      id: "m09-p06",
      order_index: 6,
      point: "Every prompt is versioned by a hash and logged with each answer. The kill switch, serving.enabled in config/flags.yaml, is checked by workers before every job; a machine may turn it off, only a person turns it on.",
      narration: `Watch the log line for the blocked answer: question, customer, prompt version, and the gate that stopped it. Then watch the canary fail at night and the system switch itself off. Even the questions already waiting get the safe refusal. In the morning, a person checks the fix and switches it back on.`,
    },
  ],

  quiz_items: [
    {
      id: "m09-q01",
      lesson_step_id: "m09-s02",
      order_index: 1,
      kind: "single_choice",
      prompt: `Retrieval put §4.5 first, yet the answer quoted ${C.contractors.section} as saying "${FAKE_QUOTE}" Where did it go wrong?`,
      choices: [
        { id: "a", text: "Retrieval: §4.5 should have been ranked even higher" },
        { id: "b", text: "Generation: the writer made up a quote that isn't in the NDA" },
        { id: "c", text: "The index is out of date and missing Amendment No. 1" },
        { id: "d", text: "The gateway sent the question to the wrong customer" },
      ],
      answer: { choice: "b" },
      explanation: "The right clause arrived first. The writer blended it with §4.2(b)'s condition and put quote marks round the blend: a hallucination, caught by a gate, not by better search.",
      difficulty: 1,
    },
    {
      id: "m09-q02",
      lesson_step_id: "m09-s03",
      order_index: 2,
      kind: "single_choice",
      prompt: "A hundred lawyers ask about subcontractors in the same minute. Which part of the harness stops the system from falling over?",
      choices: [
        { id: "a", text: "The kill switch, which turns answering off when it's busy" },
        { id: "b", text: "The queue, which holds the questions in line while workers take them one at a time" },
        { id: "c", text: "The citation-verification gate" },
        { id: "d", text: "The golden set" },
      ],
      answer: { choice: "b" },
      explanation: "The gateway accepts the questions, the queue holds them in order, and several workers work through them side by side.",
      difficulty: 1,
    },
    {
      id: "m09-q03",
      lesson_step_id: "m09-s03",
      order_index: 3,
      kind: "single_choice",
      prompt: "Where should the rule \"Beta only sees Beta's contracts\" be enforced?",
      choices: [
        { id: "a", text: "In the prompt: \"Only use Beta's contracts\"" },
        { id: "b", text: "In the database, with row-level security" },
        { id: "c", text: "In the nightly eval" },
        { id: "d", text: "In the fallback message" },
      ],
      answer: { choice: "b" },
      explanation: "A prompt is a request the model can't keep if the wrong clause is already in front of it. The database rule holds even when the code has a bug.",
      difficulty: 2,
    },
    {
      id: "m09-q04",
      lesson_step_id: "m09-s04",
      order_index: 4,
      kind: "short_answer",
      prompt: "What is the gate called that checks every quote in an answer appears in the NDA word for word?",
      answer: { accepted: ["citation verification", "citation-verification gate", "citation verification gate", "quote check"] },
      explanation: "Citation verification tidies the quote and the NDA the same way, then searches for the quote. Not found means blocked.",
      difficulty: 1,
    },
    {
      id: "m09-q05",
      lesson_step_id: "m09-s04",
      order_index: 5,
      kind: "multi_choice",
      prompt: "The made-up subcontractor quote is blocked. What belongs in the fallback the lawyer sees?",
      choices: [
        { id: "a", text: "An honest statement that there's no verified answer" },
        { id: "b", text: "The clauses that were found, such as §4.5 and §4.2(b), to read directly" },
        { id: "c", text: "The blocked draft, marked \"may be wrong\"" },
        { id: "d", text: "Nothing at all, so no one is misled" },
      ],
      answer: { choices: ["a", "b"] },
      explanation: "The fallback is a safe refusal plus the clauses found. Showing the draft defeats the gate, and a blank screen helps no one.",
      difficulty: 2,
    },
    {
      id: "m09-q06",
      lesson_step_id: "m09-s05",
      order_index: 6,
      kind: "single_choice",
      prompt: "Why may a machine switch the kill switch off, but only a person switch it back on?",
      choices: [
        { id: "a", text: "Machines aren't allowed to edit config/flags.yaml" },
        { id: "b", text: "Stopping is always safe; starting again needs someone to confirm the problem is fixed" },
        { id: "c", text: "The switch can only move in one direction" },
        { id: "d", text: "It saves money overnight" },
      ],
      answer: { choice: "b" },
      explanation: "The system fails closed. A refusal is embarrassing; a made-up quote or a leaked clause can end a client relationship.",
      difficulty: 2,
    },
    {
      id: "m09-q07",
      lesson_step_id: "m09-s07",
      order_index: 7,
      kind: "single_choice",
      prompt: "The answer \"Disclosure to contractors needs prior written consent (§4.5). Under §4.2(b) you may also share with Permitted Recipients\" passes every gate. Why?",
      choices: [
        { id: "a", text: "The gates are switched off for multi-clause questions" },
        { id: "b", text: "Each quote is real and each sentence is backed by a clause; the problem is legal reasoning" },
        { id: "c", text: "The answer is completely correct" },
        { id: "d", text: "The groundedness check only reads the first sentence" },
      ],
      answer: { choice: "b" },
      explanation: "Gates check that answers are faithful to the clauses, not that they reason well about them. Seeing that §4.5 overrides §4.2(b) is Module 10.",
      difficulty: 3,
    },
  ],

  failure_cases: [
    {
      id: "m09-f01",
      order_index: 1,
      title: "The quote that isn't there",
      category: "hallucination",
      user_query: RUNNING_QUESTION,
      retrieved_context: [
        { source: cite(C.contractors), text: C.contractors.text, score: 0.94 },
        { source: cite(C.permittedDisclosure), text: C.permittedDisclosure.text, score: 0.88 },
        { source: cite(C.permittedRecipient), text: C.permittedRecipient.text, score: 0.81 },
      ],
      bad_output: BAD_ANSWER,
      symptom: `A confident, cited answer whose quote appears nowhere in the NDA, and which says the opposite of ${C.contractors.section}.`,
      root_cause: `Retrieval was fine: ${C.contractors.section} came first. The writer blended it with ${C.permittedDisclosure.section}'s condition and put quote marks around the blend, and nothing checked the answer before it was shown.`,
      fix: "Add citation verification (every quote must be in the NDA word for word) and a groundedness check, fail closed, and show the fallback when either blocks.",
      cause_options: [
        { id: "a", text: "The re-ranker put §4.2(b) above §4.5, so the writer leaned on the wrong clause first" },
        { id: "b", text: "Nothing checked that the quote exists in the NDA" },
        { id: "c", text: "The index predates Amendment No. 1" },
      ],
      correct_cause: "b",
    },
    {
      id: "m09-f02",
      order_index: 2,
      title: "Another customer's clause",
      category: "guardrail",
      user_query: `${RUNNING_QUESTION} (asked by Beta during a busy hour)`,
      retrieved_context: [
        {
          source: "A different customer's NDA, p.2 (not Beta's)",
          text: "(Not reprinted here: this clause belongs to another customer, which is exactly the problem.)",
          score: 0.9,
        },
        { source: cite(C.contractors), text: C.contractors.text, score: 0.87 },
      ],
      bad_output: "\"Yes. Subcontractors may receive confidential material once they sign a confidentiality agreement.\" (citing a different customer's NDA, p.2)",
      symptom: `Beta sees a clause from someone else's contract: a leak inside a tool built to keep secrets. And the answer contradicts Beta's own ${C.contractors.section}.`,
      root_cause: "The worker kept \"the current customer\" in one shared setting. Two questions arrived at once, the second overwrote it, and Beta's search ran over another customer's clauses. Nothing in the database stopped it.",
      fix: "Send the customer label with every job, enforce it in the database with row-level security, check every cited clause belongs to the asker, and load-test 100 concurrent questions from two customers: zero leaks.",
      cause_options: [
        { id: "a", text: "The prompt never said \"use only Beta's contracts\", so the model looked further afield" },
        { id: "b", text: "The other customer's clause matched the word \"subcontractor\"" },
        { id: "c", text: "Customers were kept apart in code, not in the database" },
      ],
      correct_cause: "c",
    },
    {
      id: "m09-f03",
      order_index: 3,
      title: "The gate that blocked the right answer",
      category: "guardrail",
      user_query: "May the Receiving Party disclose to a subcontractor?",
      retrieved_context: [
        {
          source: `${cite(C.contractors)} (as stored from the PDF)`,
          text: "Notwithstanding Section 4.2, no disclosure may be made to contractors without the Disclosing Party's prior written\nconsent.",
          score: 0.93,
        },
      ],
      bad_output: `"I couldn't verify a quote in this answer, so I'm not showing it." The blocked draft was right: it quoted ${C.contractors.section} exactly.`,
      symptom: "The new gate refuses a correct answer. On the day it went live, refusals jumped from about 1 answer in 50 to 1 in 3.",
      root_cause: `The stored NDA text has a line break between "prior written" and "consent", left over from the PDF. The gate compared exact characters, so the real quote of ${C.contractors.section} didn't match.`,
      fix: "Tidy both sides before comparing: squash runs of spaces and line breaks into one space, straighten quote marks, ignore capitals. Then run the gate over the golden set and count wrong refusals.",
      cause_options: [
        { id: "a", text: "Spaces and line breaks differed from the stored NDA text" },
        { id: "b", text: "The kill switch had been left off after a test" },
        { id: "c", text: "The groundedness check was swapped overnight for a stricter model that rejects every quote" },
      ],
      correct_cause: "a",
    },
  ],
};

export default m09;
