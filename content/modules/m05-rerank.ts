import type { ModuleContent } from "../types";
import { cite, NDA_CLAUSES as C, RUNNING_QUESTION } from "../nda";

// Module 5, rewritten on the running example: one NDA (Acme Corp and Beta Ltd)
// and one question, "Can we share this with a subcontractor?". Module 4 left 10
// clean clauses with §4.5 6th behind §1.1 Definitions, and the writer answers
// from §4.2(b). A cross-encoder re-ranker puts §4.5 1st, §4.2(b) 2nd and §1.4
// 3rd. The answer now cites §4.5 but keeps a muddled second route (fixed in
// Module 10). The solo task builds the 30 legal pairs Module 6 trains on.
//
// Quiz, step and failure ids are unchanged from the original Module 5, so
// existing attempts and review cards keep pointing at the same slots.

const m05: ModuleContent = {
  id: "m05",
  slug: "rerank",
  order_index: 5,
  title: "Re-Ranking",
  summary:
    "The clause that answers the subcontractor question now reaches the writer, but 6th of 10, and the writer leans on what it reads first. Add a cross-encoder re-ranker that reads the question and each clean clause together, puts §4.5 first, and passes only the top 3 on. Then build 30 legal question-and-clause pairs to test it, ready for Module 6.",
  hook: `You ask the contract assistant, "${RUNNING_QUESTION}" Since Module 4, ${C.contractors.section}, the clause that answers it, reaches the writer. But it's 6th of 10, with ${C.definitions.section} Definitions first. The writer leans on what it reads first and answers "Yes, to Permitted Recipients (${C.permittedDisclosure.section})", as if ${C.contractors.section} weren't there.`,
  learning_objectives: [
    `Explain why the order of clauses in the prompt changes the subcontractor answer, even when ${C.contractors.section} is already there`,
    "Tell a bi-encoder (fast, compares the question and a clause separately) from a cross-encoder (slow, reads them together)",
    `Add a re-ranker after the cleaning step that puts ${C.contractors.section} first and passes only the top 3 to 5 clauses on`,
    "Balance how many clauses you re-rank against the time limit for each answer",
    "Build 30 legal (question, clause, relevant?) pairs to test the re-ranker, ready for Module 6 to train on",
  ],
  estimated_minutes: 90,
  is_published: true,
  pipeline_stages: ["re-rank"],
  explain_back_prompt: `In your own words: after Module 4, ${C.contractors.section} was already in the writer's prompt, yet the answer ignored it. Why does moving it from 6th to 1st change the answer? And why can a cross-encoder see that ${C.contractors.section} answers the question when search couldn't?`,
  video: null,

  lesson_steps: [
    {
      id: "m05-s01",
      order_index: 1,
      kind: "warm_up",
      title: "Warm-up: what you already know",
      body_md: `Before we start, answer these from what you remember of Module 4. There are no wrong answers. You'll check yourself against the study guide at the end.

1. Sending the writer all 40 candidates made the subcontractor answer worse. Can you name two reasons why?
2. The cleaning step does three things, in a set order. What are they, and why that order?
3. After cleaning, where does ${C.contractors.section} sit among the 10 clauses, and what does the writer still answer?`,
    },
    {
      id: "m05-s02",
      order_index: 2,
      kind: "concept",
      title: "Right clause, wrong place",
      body_md: `Let's look at what the writer reads after Module 4.

Our non-disclosure agreement (NDA) has been searched, and the results cleaned. Ten clauses go into the prompt, best search score first:

1. ${C.definitions.section} ${C.definitions.title}
2. ${C.permittedDisclosure.section} ${C.permittedDisclosure.title}
3. ${C.permittedRecipient.section} ${C.permittedRecipient.title}
4. ${C.compelledDisclosure.section} ${C.compelledDisclosure.title}
5. ${C.term.section} ${C.term.title}
6. ${C.contractors.section} ${C.contractors.title}

and four more. Clause 6 is the one that answers the question: "${C.contractors.text}" And here's the answer:

> "Yes, to Permitted Recipients bound by written confidentiality obligations (${C.permittedDisclosure.section})."

${C.contractors.section} was right there, and the writer still ignored it. Language models lean hardest on whatever they read first. That's called **anchoring**. The first clauses set the story, and a short amendment in 6th place doesn't change it.

So the right clause has to come first. But why isn't it first already? Because search scores each clause by comparing two lists of numbers, the question's and the clause's, made separately. It never reads the two side by side. ${C.definitions.section} is all about information being shared, so its numbers land close to the question's. ${C.contractors.section} is short and starts "Notwithstanding Section 4.2", so its numbers say "something about Section 4.2" more than "who can we share with".

:::key What Module 5 adds
Module 5 builds **[4] re-rank**: a second, more careful look at the 10 clean clauses. It reads the question and each clause together, puts the single best one first, and passes only the top 3 to 5 to the writer. That's why the map's 📍 You are here marker sits on that stage.

It fixes the order, not the reading. After re-ranking, the answer leads with ${C.contractors.section}, but it still offers a second route under ${C.permittedDisclosure.section}, which a subcontractor can't use. Module 6 trains the re-ranker to cope with lawyers' wording, and Module 10 teaches the writer that an amendment overrides the clause it amends.
:::`,
    },
    {
      id: "m05-s03",
      order_index: 3,
      kind: "concept",
      title: "Glancing versus reading",
      body_md: `There are two ways a model can judge whether a clause answers a question. Think of finding a book in a library. You can glance along the spines, or you can take each book down and read the page.

**Glancing: the bi-encoder.** This is the embedding model you've used since Module 1. It turns the question into a list of numbers, turns each clause into a list of numbers, and compares the lists. It never sees the question and the clause together. That makes it fast: the clauses' numbers are worked out once, before anyone asks, so each search only compares lists.

**Reading: the cross-encoder.** This model takes the question and one clause as a single piece of text and reads them together, like a lawyer with both on the desk. It can see that "subcontractor" in the question matches "contractors" in ${C.contractors.section}, and that "no disclosure may be made… without the Disclosing Party's prior written consent" is a direct answer to "Can we share this?". It gives each pair one match score.

The catch is speed. Nothing can be prepared in advance, because the cross-encoder needs the question. It has to read every pair fresh, every time someone asks. That's fine for 10 clauses and far too slow for a whole library of contracts.

:::key Fast to find, careful to rank
**Search with the fast one; re-rank the short list with the careful one.** The bi-encoder and keyword search find about 40 candidates, cleaning cuts them to 10, and the cross-encoder reads those 10 and puts the best first.
:::`,
      code_snippet: `from sentence_transformers import CrossEncoder

# A ready-made cross-encoder, downloaded once. Its name goes in config/models.yaml.
reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

def rerank(question, clauses, k=3):
    """Read each (question, clause) pair together and keep the best k."""
    pairs = [(question, c.text) for c in clauses]
    scores = reranker.predict(pairs)          # one match score per pair
    ranked = sorted(zip(clauses, scores), key=lambda x: x[1], reverse=True)
    return [c for c, _ in ranked[:k]]`,
      code_language: "python",
    },
    {
      id: "m05-s04",
      order_index: 4,
      kind: "concept",
      title: "Re-ranking the subcontractor question",
      body_md: `Now run the 10 clean clauses through the cross-encoder, one pair at a time. Here's the new order, with each pair's match score from 0 to 1:

1. ${C.contractors.section} ${C.contractors.title}: 0.96
2. ${C.permittedDisclosure.section} ${C.permittedDisclosure.title}: 0.89
3. ${C.permittedRecipient.section} ${C.permittedRecipient.title}: 0.71
4. ${C.definitions.section} ${C.definitions.title}: 0.35
5. ${C.compelledDisclosure.section} ${C.compelledDisclosure.title}: 0.22

${C.contractors.section} jumps from 6th to 1st. ${C.definitions.section} Definitions, which only says what counts as a secret, not who may hear it, drops to 4th.

Then keep only the best few. How many you keep is called k, and the top k clauses are the **top-k**. For contract questions, k is usually 3 to 5. We keep 3, so the writer now reads ${C.contractors.section}, ${C.permittedDisclosure.section} and ${C.permittedRecipient.section}, in that order.

**What it costs: time**
Every pair is a fresh read. On a normal laptop, our cross-encoder takes about 0.2 seconds for 10 clauses, and about 0.8 seconds for 40. If the whole answer has to arrive within 2 seconds, that matters. This wait is called **latency**, and the time you allow for each answer is your latency budget.

That's one more reason Module 4's cleaning comes first. Re-ranking 10 clean clauses is quick. Re-ranking 40 raw candidates, three of them copies of ${C.permittedDisclosure.section}, is four times slower and wastes reads on copies.

:::more Setting it in one place
How many clauses to re-rank and how many to keep belong in \`config/models.yaml\`, the settings file from Module 2 that says which model does which job. Put the re-ranker's name there too. Then you can try k = 3 or k = 5, or swap in a better re-ranker in Module 6, by editing one line instead of your code.
:::`,
      code_snippet: `# config/models.yaml
reranker:
  model: cross-encoder/ms-marco-MiniLM-L-6-v2
  rerank_up_to: 10   # how many clean clauses to read
  k: 3               # how many to pass to the writer`,
      code_language: "yaml",
    },
    {
      id: "m05-s05",
      order_index: 5,
      kind: "concept",
      title: "Testing the re-ranker with your own pairs",
      body_md: `One good result on one question proves very little. Before you trust the re-ranker, test it on a set of examples where you already know the right answer.

Each example is a pair: a question, one clause from the NDA, and your verdict, relevant or not. For example:

- "${RUNNING_QUESTION}" with ${C.contractors.section} → **relevant**
- "${RUNNING_QUESTION}" with ${C.compelledDisclosure.section} ${C.compelledDisclosure.title} → **not relevant**
- "May the Receiving Party disclose to a subcontractor?" with ${C.contractors.section} → **relevant**
- "How long does the NDA last?" with ${C.term.section} ${C.term.title} → **relevant**
- "Which state's law applies?" with ${C.governingLaw.section} ${C.governingLaw.title} → **relevant**

Look at the second one. ${C.compelledDisclosure.section} is about disclosure too, so it looks like an answer, but it only covers sharing because a court or the law demands it. A wrong clause that looks very like the right one is called a **hard negative**. Hard negatives are the most useful pairs you can write, because they're exactly where a re-ranker slips.

Aim for 30 pairs: about 10 questions, each with its relevant clause, a hard negative and one clearly unrelated clause. Ask some questions the way Beta's staff would and some the way a lawyer would. Then score the re-ranker: for how many questions does the relevant clause come out on top?

Expect a few misses. The ready-made re-ranker learned from millions of web searches, not contracts. Asked "May the Receiving Party disclose to a subcontractor?", it may put ${C.compelledDisclosure.section} first, because "disclose" appears in both. Keep that list of misses. In Module 6 these 30 pairs become training pairs, and you'll fine-tune the re-ranker until it stops making them.`,
      code_snippet: `{"question": "Can we share this with a subcontractor?", "clause": "§4.5", "relevant": true}
{"question": "Can we share this with a subcontractor?", "clause": "§5", "relevant": false}
{"question": "Can we share this with a subcontractor?", "clause": "§9", "relevant": false}
{"question": "May the Receiving Party disclose to a subcontractor?", "clause": "§4.5", "relevant": true}
{"question": "May the Receiving Party disclose to a subcontractor?", "clause": "§5", "relevant": false}
{"question": "How long does the NDA last?", "clause": "§7", "relevant": true}`,
      code_language: "text",
    },
    {
      id: "m05-s06",
      order_index: 6,
      kind: "exercise",
      title: "Hands-on: try it yourself",
      body_md: `**Predict first:** after re-ranking, in what place will ${C.contractors.section} land for "${RUNNING_QUESTION}"? And out of 10 questions about the NDA, how many will have their answering clause in 1st place? Write both guesses down before you start.

- **Guided:** Plug a ready-made cross-encoder into your pipeline, right after \`clean()\`. For the subcontractor question and 9 other questions about the NDA, write down where the answering clause sits before and after re-ranking.
- **Partial:** Time it. Re-rank 5, 10, 20 and 40 clauses and note how long each takes. Your whole answer has a 2-second latency budget: choose how many clauses to re-rank and how many to keep, and set both in \`config/models.yaml\`.
- **Solo:** Write 30 legal (question, clause, relevant?) pairs from the NDA. Include the subcontractor question in everyday words and in a lawyer's words, and give each question a hard negative. Score the re-ranker on them, and list every question it gets wrong. Keep the file: Module 6 trains on these pairs.

**Files you create:** \`data/rerank_pairs.jsonl\`, a plain text file with one labelled pair per line, and a re-ranker entry in \`config/models.yaml\`, your settings file.

**Capstone branch:** save this work on a branch called \`rerank\` in your course project. It needs a cross-encoder that re-ranks the clean clauses and keeps the top-k, with k set in the settings file so you can change it.

**Check it with your assistant:** ask your coding assistant, "Does my rerank branch run after clean(), score each (question, clause) pair with a cross-encoder, keep the top k from config/models.yaml, and log how long re-ranking takes?"`,
    },
    {
      id: "m05-s07",
      order_index: 7,
      kind: "concept",
      title: "When re-ranking isn't the answer",
      body_md: `A re-ranker is one of the best upgrades you can make. But know what it can't do.

- **It can't find what's missing.** It only re-orders what cleaning hands it. If ${C.contractors.section} was dropped in Module 4, or never found by search, the re-ranker can't bring it back.
- **It costs time on every question.** Each pair is a fresh read. Re-rank the clean 10, never the raw 40.
- **It doesn't always need to run.** "Show me ${C.permittedDisclosure.section}" names the clause. Keyword search already puts it first, so skip the wait.
- **A ready-made re-ranker learned from web searches.** Lawyers' wording, like "May the Receiving Party disclose…", can fool it. That's Module 6.
- **It orders clauses; it doesn't read the law.** With ${C.contractors.section} first, the writer now says contractors need prior written consent, but it also offers ${C.permittedDisclosure.section} as a second route. A subcontractor isn't a Permitted Recipient, and the amendment says "Notwithstanding Section 4.2". Getting that reasoning right is Module 10's job.`,
    },
  ],

  worked_example: [
    {
      id: "m05-w01",
      order_index: 1,
      title: "What cleaning hands over",
      body_md: `Module 4's \`clean()\` hands over 10 clauses, best search score first. ${C.definitions.section} Definitions is 1st and ${C.contractors.section}, the clause that answers the question, is 6th.`,
      stage: "post-retrieval",
      query_state: `10 clean clauses. ${C.definitions.section} is 1st; ${C.contractors.section} is 6th.`,
    },
    {
      id: "m05-w02",
      order_index: 2,
      title: "Without re-ranking: the writer anchors",
      body_md: `Sent to the writer in that order, the 10 clauses produce:

> "Yes, to Permitted Recipients bound by written confidentiality obligations (${C.permittedDisclosure.section})."

The writer built its answer from the first clauses it read. ${C.contractors.section}, in 6th place, never made it into the answer.`,
      stage: "generation",
      query_state: `Answered from ${C.permittedDisclosure.section}; ${C.contractors.section} was in the prompt but ignored.`,
    },
    {
      id: "m05-w03",
      order_index: 3,
      title: "Read each pair together",
      body_md: `Instead, each of the 10 clauses is paired with the question, and the cross-encoder reads every pair as one piece of text and gives it a match score. Ten pairs take about 0.2 seconds.`,
      code_snippet: `top = rerank("${RUNNING_QUESTION}", cleaned, k=3)`,
      code_language: "python",
      stage: "re-rank",
      query_state: "10 (question, clause) pairs, each with a match score from 0 to 1.",
    },
    {
      id: "m05-w04",
      order_index: 4,
      title: "The new order",
      body_md: `Sorted by match score:

1. ${C.contractors.section} ${C.contractors.title}: 0.96
2. ${C.permittedDisclosure.section} ${C.permittedDisclosure.title}: 0.89
3. ${C.permittedRecipient.section} ${C.permittedRecipient.title}: 0.71
4. ${C.definitions.section} ${C.definitions.title}: 0.35

With k = 3, only the first three go on. ${C.contractors.section} jumps from 6th to 1st, and ${C.definitions.section} drops out.`,
      code_snippet: `[1] (${cite(C.contractors)}) ${C.contractors.text}
[2] (${cite(C.permittedDisclosure)}) ${C.permittedDisclosure.text}
[3] (${cite(C.permittedRecipient)}) ${C.permittedRecipient.text}

Question: ${RUNNING_QUESTION}`,
      code_language: "text",
      stage: "re-rank",
      query_state: `Top 3: ${C.contractors.section}, ${C.permittedDisclosure.section}, ${C.permittedRecipient.section}. ${C.definitions.section} drops out.`,
    },
    {
      id: "m05-w05",
      order_index: 5,
      title: "The answer now",
      body_md: `The writer reads ${C.contractors.section} first, and it shows:

> "Disclosure to contractors needs the Disclosing Party's prior written consent (${C.contractors.section}). Under ${C.permittedDisclosure.section} you may also share with Permitted Recipients."

For the first time, the answer cites the clause that actually governs subcontractors.`,
      stage: "generation",
      query_state: `Answered "Disclosure to contractors needs the Disclosing Party's prior written consent (${C.contractors.section})…", plus a second route under ${C.permittedDisclosure.section}.`,
    },
    {
      id: "m05-w06",
      order_index: 6,
      title: "What's still wrong",
      body_md: `Read the second sentence again. It suggests a subcontractor could be shared with under ${C.permittedDisclosure.section}. But ${C.permittedRecipient.section} says Permitted Recipients are employees, officers and professional advisers, so a subcontractor isn't one. And ${C.contractors.section} begins "Notwithstanding Section 4.2", so it wins anyway.

Search, cleaning and re-ranking have done their jobs: the right three clauses arrived in the right order. What's left is reading them like a lawyer, which is Module 10's job. First, Module 6 makes sure the re-ranker still puts ${C.contractors.section} first when a lawyer asks the question in different words.`,
      stage: "generation",
      query_state: `Right clause first, but the answer still offers a second route under ${C.permittedDisclosure.section}.`,
    },
  ],

  // Every term a learner meets in this module (tests/unit/glossary-coverage.test.ts
  // checks none is missing): contract words first, then the rest.
  glossary: [
    "nda", "clause", "section-sign", "subcontractor", "permitted-recipient", "confidential-information",
    "disclosing-party", "receiving-party", "affiliate", "amendment", "notwithstanding", "written-consent",
    "language-model", "prompt", "index", "embedding", "keyword-search", "query-rewriting", "candidate",
    "deduplication", "score-threshold", "score-gap", "anchoring", "re-rank", "bi-encoder", "cross-encoder", "top-k",
    "latency", "latency-budget", "settings-file", "hard-negative", "training-pair", "fine-tuning", "log", "branch",
  ],

  study_guide: [
    {
      id: "m05-p01",
      order_index: 1,
      point: "Order matters. The writer anchors on what it reads first, so §4.5 in 6th place was in the prompt and still ignored.",
      narration: `Watch the writer read ten clauses, starting with the definitions clause and §4.2(b). By the time it reaches §4.5, in 6th place, its answer is already set: yes, to Permitted Recipients. Being in the prompt isn't enough. The best clause has to come first.`,
    },
    {
      id: "m05-p02",
      order_index: 2,
      point: "A bi-encoder compares the question and a clause separately: fast, but it never reads them together. A cross-encoder reads each pair together: slow, but far more careful.",
      narration: `See the bi-encoder glance along the shelf: one list of numbers for the question, one for each clause, worked out ahead of time. Now see the cross-encoder take each clause down and read it next to the question. It notices "contractors" and "without prior written consent". That's what search missed.`,
    },
    {
      id: "m05-p03",
      order_index: 3,
      point: "Search with the fast model, clean, then re-rank the short list with the careful one and keep the top 3 to 5.",
      narration: `Follow the funnel: about 40 candidates from search, 10 after cleaning, and the cross-encoder reads those 10 and keeps the best 3. The careful model only ever sees a short list, which is what keeps it affordable.`,
    },
    {
      id: "m05-p04",
      order_index: 4,
      point: "After re-ranking, §4.5 is 1st, §4.2(b) 2nd and §1.4 3rd, and the answer cites §4.5, but still offers a muddled second route.",
      narration: `See §4.5 jump from 6th to 1st, and the definitions clause drop out of the top three. The answer now says contractors need the Disclosing Party's prior written consent. Then it adds a second route under §4.2(b), which a subcontractor can't use. The order is fixed; the legal reading comes in Module 10.`,
    },
    {
      id: "m05-p05",
      order_index: 5,
      point: "Re-ranking costs time on every question: about 0.2 seconds for 10 clauses, four times that for 40. Clean first and cap how many you re-rank.",
      narration: `Watch the timer as the list grows. Ten clauses, a fifth of a second. Forty, nearly a second, and three of those reads are copies of §4.2(b). Clean first, set the numbers in the settings file, and keep the whole answer inside its latency budget.`,
    },
    {
      id: "m05-p06",
      order_index: 6,
      point: "Test the re-ranker on 30 (question, clause, relevant?) pairs, including hard negatives. Module 6 trains on the same pairs.",
      narration: `Look at the pair "May the Receiving Party disclose to a subcontractor?" with §5 Compelled Disclosure. It shares the word "disclose", but it's the wrong clause: a hard negative. The ready-made re-ranker sometimes falls for it. Write down every miss like this, because in Module 6 these pairs become its training.`,
    },
  ],

  quiz_items: [
    {
      id: "m05-q01",
      lesson_step_id: "m05-s02",
      order_index: 1,
      kind: "single_choice",
      prompt: "After Module 4, §4.5 is in the writer's prompt, 6th of 10. Why is that still a problem?",
      choices: [
        { id: "a", text: "The writer never reads past the 5th clause" },
        { id: "b", text: "The writer anchors on what it reads first, so §1.1 and §4.2(b) shape the answer" },
        { id: "c", text: "Clauses in 6th place are deleted before generation" },
        { id: "d", text: "It isn't a problem; the writer weighs every clause equally" },
      ],
      answer: { choice: "b" },
      explanation: "The first clauses set the story. The clause that answers the question belongs at the top.",
      difficulty: 1,
    },
    {
      id: "m05-q02",
      lesson_step_id: "m05-s03",
      order_index: 2,
      kind: "single_choice",
      prompt: "What's the key difference between a bi-encoder and a cross-encoder?",
      choices: [
        { id: "a", text: "A bi-encoder reads the question and clause together; a cross-encoder compares them separately" },
        { id: "b", text: "A bi-encoder turns the question and clause into numbers separately; a cross-encoder reads them together in one go" },
        { id: "c", text: "They're the same model with different names" },
        { id: "d", text: "A cross-encoder only matches exact words, like keyword search" },
      ],
      answer: { choice: "b" },
      explanation: "Reading the pair together is what lets the cross-encoder see that §4.5's \"contractors… without prior written consent\" answers the question.",
      difficulty: 1,
    },
    {
      id: "m05-q03",
      lesson_step_id: "m05-s03",
      order_index: 3,
      kind: "single_choice",
      prompt: "Why not use the cross-encoder to search the whole index instead of just re-ranking?",
      choices: [
        { id: "a", text: "It needs the question, so nothing can be prepared ahead, and reading every clause fresh for every question is far too slow" },
        { id: "b", text: "It can't read legal text" },
        { id: "c", text: "It only ever returns one clause" },
        { id: "d", text: "It must be fine-tuned before it works at all" },
      ],
      answer: { choice: "a" },
      explanation: "The bi-encoder's clause numbers are worked out once in advance. The cross-encoder must read each pair at question time, so it only gets a short list.",
      difficulty: 2,
    },
    {
      id: "m05-q04",
      lesson_step_id: "m05-s04",
      order_index: 4,
      kind: "multi_choice",
      prompt: "The re-ranker runs on the 10 clean clauses with k = 3. Which clauses reach the writer for the subcontractor question?",
      choices: [
        { id: "a", text: "§4.5 Contractors (Amendment No. 1)" },
        { id: "b", text: "§1.1 Definitions" },
        { id: "c", text: "§4.2(b) Permitted Disclosure" },
        { id: "d", text: "§1.4 Permitted Recipient" },
      ],
      answer: { choices: ["a", "c", "d"] },
      explanation: "§4.5 scores 0.96, §4.2(b) 0.89 and §1.4 0.71. §1.1 Definitions, at 0.35, drops out of the top 3.",
      difficulty: 2,
    },
    {
      id: "m05-q05",
      lesson_step_id: "m05-s04",
      order_index: 5,
      kind: "single_choice",
      prompt: "A teammate re-ranks all 40 raw candidates and the answer misses its 2-second budget. What's the best fix?",
      choices: [
        { id: "a", text: "Use a bigger language model to write the answer" },
        { id: "b", text: "Remove the re-ranker" },
        { id: "c", text: "Clean first, so the re-ranker only reads about 10 clauses with no copies" },
        { id: "d", text: "Skip search and re-rank the whole index" },
      ],
      answer: { choice: "c" },
      explanation: "Re-ranking time grows with every pair. Cleaning first cuts 40 reads to 10 and stops the re-ranker wasting reads on copies of §4.2(b).",
      difficulty: 2,
    },
    {
      id: "m05-q06",
      lesson_step_id: "m05-s05",
      order_index: 6,
      kind: "short_answer",
      prompt: "For \"May the Receiving Party disclose to a subcontractor?\", §5 Compelled Disclosure looks like an answer but isn't. What do you call a wrong clause that looks very like the right one?",
      answer: { accepted: ["hard negative", "a hard negative", "hard negatives"] },
      explanation: "Hard negatives are the most useful pairs to write, because they're exactly where a re-ranker slips.",
      difficulty: 2,
    },
    {
      id: "m05-q07",
      lesson_step_id: "m05-s06",
      order_index: 7,
      kind: "single_choice",
      prompt: "What are your 30 (question, clause, relevant?) pairs for?",
      choices: [
        { id: "a", text: "Training the query rewrite prompt" },
        { id: "b", text: "Testing the re-ranker now, and fine-tuning it in Module 6" },
        { id: "c", text: "Replacing the NDA's index" },
        { id: "d", text: "Setting the score threshold in the cleaning step" },
      ],
      answer: { choice: "b" },
      explanation: "They measure the ready-made re-ranker today, and become training pairs in Module 6.",
      difficulty: 3,
    },
  ],

  failure_cases: [
    {
      id: "m05-f01",
      order_index: 1,
      title: "The re-ranker that never saw §4.5",
      category: "ranking",
      user_query: RUNNING_QUESTION,
      retrieved_context: [
        { source: `${cite(C.permittedDisclosure)} (rank 1)`, text: C.permittedDisclosure.text, score: 0.89 },
        { source: `${cite(C.permittedRecipient)} (rank 2)`, text: C.permittedRecipient.text, score: 0.71 },
        { source: `${cite(C.definitions)} (rank 3)`, text: C.definitions.text, score: 0.35 },
      ],
      bad_output: `"Yes, to Permitted Recipients bound by written confidentiality obligations." (${C.permittedDisclosure.section} ${C.permittedDisclosure.title})`,
      symptom: `${C.contractors.section} survived cleaning, but it isn't among the re-ranked clauses at all.`,
      root_cause: `To save time, someone set the re-ranker to read only the first 5 clean clauses. ${C.contractors.section} was 6th, so the cross-encoder never saw it.`,
      fix: "Re-rank every clean clause (10 take about 0.2 seconds). If you need to save time, cut the list in the cleaning step, where the score gap is, not by chopping it before the re-ranker.",
      cause_options: [
        { id: "a", text: "The cross-encoder scored §4.5 low because short amendments say little on their own" },
        { id: "b", text: "The writer ignored §4.5's \"Notwithstanding\"" },
        { id: "c", text: "The re-ranker only read the first 5, and §4.5 was 6th" },
      ],
      correct_cause: "c",
    },
    {
      id: "m05-f02",
      order_index: 2,
      title: "Fooled by a shared word",
      category: "ranking",
      user_query: "May the Receiving Party disclose to a subcontractor?",
      retrieved_context: [
        { source: `${cite(C.compelledDisclosure)} (rank 1)`, text: C.compelledDisclosure.text, score: 0.91 },
        { source: `${cite(C.contractors)} (rank 2)`, text: C.contractors.text, score: 0.86 },
        { source: `${cite(C.permittedDisclosure)} (rank 3)`, text: C.permittedDisclosure.text, score: 0.8 },
      ],
      bad_output: `"Only if required by law, regulation or court order, and after giving the Disclosing Party prompt notice." (${C.compelledDisclosure.section} ${C.compelledDisclosure.title})`,
      symptom: `Asked in a lawyer's words, the re-ranker puts ${C.compelledDisclosure.section} first, a clause about court orders, above the clause that answers the question.`,
      root_cause: `The ready-made cross-encoder learned from web searches, where sharing a word with the question is a strong clue. "Disclose" appears in the question and twice in ${C.compelledDisclosure.section}.`,
      fix: `Add look-alike pairs like this one (hard negatives) to your 30 pairs. If the ready-made re-ranker keeps failing them, that's the case for fine-tuning it in Module 6.`,
      cause_options: [
        { id: "a", text: "It matched the word \"disclose\", not the meaning" },
        { id: "b", text: "Cleaning dropped §4.5 before the re-ranker saw it" },
        { id: "c", text: "The question's legal wording made the rewrite step search only for compelled disclosure" },
      ],
      correct_cause: "a",
    },
    {
      id: "m05-f03",
      order_index: 3,
      title: "Re-ranking before cleaning",
      category: "ranking",
      user_query: RUNNING_QUESTION,
      retrieved_context: [
        {
          source: `${cite(C.permittedDisclosure)} (piece 1 of 3, rank 1)`,
          text: C.permittedDisclosure.text,
          score: 0.89,
        },
        {
          source: `${cite(C.permittedDisclosure)} (piece 2 of 3, rank 2)`,
          text: "The Receiving Party may disclose Confidential Information only: (a) with the Disclosing Party's prior written consent; or (b) to its Affiliates and Permitted Recipients,",
          score: 0.88,
        },
        {
          source: `${cite(C.permittedDisclosure)} (piece 3 of 3, rank 3)`,
          text: "…to its Affiliates and Permitted Recipients, provided that each is bound by written confidentiality obligations no less protective than this Agreement.",
          score: 0.87,
        },
      ],
      bad_output: `"Yes, to Affiliates and Permitted Recipients bound by written confidentiality obligations." (${C.permittedDisclosure.section}, cited three times)`,
      symptom: `The top 3 are three copies of ${C.permittedDisclosure.section}. ${C.contractors.section} came 4th and was cut, and re-ranking took four times as long.`,
      root_cause: `The re-ranker ran on the raw 40 candidates before the cleaning step, so the overlapping copies of ${C.permittedDisclosure.section} filled every slot in the top 3.`,
      fix: "Run the cleaning step first (remove near-duplicates, cut at the score gap, trim), then re-rank the 10 clauses that are left.",
      cause_options: [
        { id: "a", text: "The cross-encoder failed to load, so the search order, with its copies, was passed on unchanged" },
        { id: "b", text: "Re-ranking ran before the duplicates were removed" },
        { id: "c", text: "k was set too high, so too many clauses went on" },
      ],
      correct_cause: "b",
    },
  ],
};

export default m05;
