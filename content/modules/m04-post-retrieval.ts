import type { ModuleContent } from "../types";
import { cite, NDA_CLAUSES as C, RUNNING_QUESTION } from "../nda";

// Module 4, rewritten on the running example: one NDA (Acme Corp and Beta Ltd)
// and one question, "Can we share this with a subcontractor?". Module 3 left
// about 40 candidates with §4.5 7th; sending all of them to the writer makes
// the answer worse. clean() (remove near-duplicates, cut at the score gap,
// trim) turns 40 into 10 with §4.5 6th, which is where Module 5 picks up.
//
// Quiz, step and failure ids are unchanged from the original Module 4, so
// existing attempts and review cards keep pointing at the same slots.

const m04: ModuleContent = {
  id: "m04",
  slug: "post-retrieval",
  order_index: 4,
  title: "Post-Retrieval",
  summary:
    "Search now hands over about 40 candidate clauses, and sending them all to the writer makes the subcontractor answer slower, costlier and worse. Build one cleaning step that removes near-duplicates, drops weak matches at the score gap and trims what's left, so 40 candidates become 10 and §4.5 survives in 6th place.",
  hook: `You ask the contract assistant, "${RUNNING_QUESTION}" Since Module 3, search finds ${C.contractors.section}, the clause that answers it, but only in 7th place, and the writer reads just the top 3. So you send the writer all 40 candidates. The answer gets slower, costs more, and is still wrong: the writer skims past ${C.contractors.section}, buried in the middle, and quotes half of ${C.permittedDisclosure.section}.`,
  learning_objectives: [
    "Explain why sending the writer more clauses can make the subcontractor answer worse, slower and more expensive",
    `Remove near-duplicates, such as three overlapping copies of ${C.permittedDisclosure.section}, using cosine similarity`,
    "Choose a score threshold by finding the score gap in a list of search scores",
    "Trim clauses to the sentences that matter without ever cutting a sentence or a definition in half",
    "Build a clean() step that logs what it removes and hands about 10 clauses to the next stage",
  ],
  estimated_minutes: 90,
  is_published: true,
  pipeline_stages: ["post-retrieval"],
  explain_back_prompt: `In your own words: sending the writer all 40 candidates made the subcontractor answer worse, not better. Why? And why does the cleaning step remove near-duplicates first, then cut weak matches, and only then trim?`,
  video: null,

  lesson_steps: [
    {
      id: "m04-s01",
      order_index: 1,
      kind: "warm_up",
      title: "Warm-up: what you already know",
      body_md: `Before we start, answer these from what you remember of Module 3. There are no wrong answers. You'll check yourself against the study guide at the end.

1. Module 3 runs a keyword search and a meaning search at the same time. What does each one catch that the other misses?
2. ${C.contractors.section} says "contractors" right there in its text. Why did meaning search on its own rank it 9th, and which search found it?
3. Module 3 hands about 40 candidates forward, with ${C.contractors.section} in 7th place. If the writer still reads only the top 3, what will it answer?`,
    },
    {
      id: "m04-s02",
      order_index: 2,
      kind: "concept",
      title: "Forty clauses is too many",
      body_md: `Let's pick up where Module 3 left off.

Search is finally finding ${C.contractors.section}, the amendment to our non-disclosure agreement (NDA) that says: "${C.contractors.text}" That's the clause that answers our question. But it comes back 7th of about 40 candidates, and the writer only reads the top 3.

So a teammate suggests the obvious fix: send the writer all 40. And lay them out in page order, so the writer reads them like the contract itself. More to read can only help. Right?

Here's what the writer actually gets:
- **Three copies of ${C.permittedDisclosure.section}.** Your index stores the NDA in overlapping pieces, so a clause cut off at the end of one piece is whole in the next. That's good for search, but search found all three pieces.
- **The signature block**, where the two companies sign. It says nothing about sharing.
- **${C.contractors.section}, around 23rd**, deep in the middle of a long pile.

After a long wait, this comes back:

> "Yes. You may disclose to Affiliates and Permitted Recipients. (${C.permittedDisclosure.section} ${C.permittedDisclosure.title})"

Two things went wrong. First, the writer quoted a piece of ${C.permittedDisclosure.section} that stops before its condition: each recipient must be bound by written confidentiality obligations. Second, it never mentioned ${C.contractors.section} at all. Language models read the start and the end of a long prompt most carefully and skim the middle. That's called getting **lost in the middle**, and ${C.contractors.section} was sitting right in it.

It was slow and expensive, too. The prompt grew from about 600 tokens to about 6,000 (a token is a small piece of text, roughly three-quarters of a word). You wait for every one of them, and you pay for every one.

:::key What Module 4 adds
More text isn't better. Module 4 builds **[3] post-retrieval**: one cleaning step that sits between search and the writer. It removes near-duplicates, drops weak matches and trims what's left, so about 40 candidates become 10. That's why the map's 📍 You are here marker sits on that stage.

It doesn't finish the job. After cleaning, ${C.contractors.section} survives in 6th place, behind ${C.definitions.section} Definitions, and the writer still leans on what it reads first. Module 5 adds **[4] re-rank** to put the best clause first.
:::`,
    },
    {
      id: "m04-s03",
      order_index: 3,
      kind: "concept",
      title: "Generous search, strict cleaning",
      body_md: `Here's the idea in one line: **search is generous, cleaning is strict.** Search casts a wide net so it doesn't miss ${C.contractors.section}. Cleaning throws back everything the writer doesn't need.

Picture a paralegal handed a stack of photocopies of the NDA. First they throw out the duplicate pages. Then they set aside the pages that clearly don't matter. Then they highlight only the lines that answer the question. Our cleaning step, a function called \`clean()\`, does the same three things, in the same order:

1. **Remove near-duplicates.** Compare each clause with the ones you've already kept. If two are almost the same text (cosine similarity above 0.95), keep the more complete one. The three copies of ${C.permittedDisclosure.section} become one, and it's the whole clause, condition included.
2. **Drop weak matches.** Every candidate arrives with a score from search. Anything below a cut-off score, the score threshold, goes. That's where the signature block leaves.
3. **Trim.** Cut each remaining clause down to the sentences that relate to the question.

Why this order? Each step makes the next one cheaper and safer. Removing copies first means the threshold judges different clauses, not three versions of the same one. And trimming, the slowest and most careful step, only runs on the 10 clauses that are left, not on all 40.

:::more How clean() keeps a record
\`clean()\` also writes a log: a running record your code prints as it works. One line per question is enough, like "clean: 40 → 24 → 10 candidates, 6,000 → 1,200 tokens", plus the name of every clause it dropped. When an answer goes wrong later, the log tells you in seconds whether ${C.contractors.section} was thrown away during cleaning or never arrived at all.
:::`,
      code_snippet: `def clean(question, candidates):
    """About 40 candidates in, about 10 out, best score first."""
    before = len(candidates)
    kept = dedupe(candidates)             # 1. remove near-duplicates
    after_dedupe = len(kept)
    kept = drop_weak(kept)                # 2. cut at the score gap
    q = embed(question)
    kept = [trim(c, q) for c in kept]     # 3. keep the sentences that matter
    log.info(f"clean: {before} -> {after_dedupe} -> {len(kept)} candidates")
    return kept


def dedupe(candidates, cutoff=0.95):
    kept = []
    # Longest first, so the whole clause wins over a piece of it.
    for c in sorted(candidates, key=lambda c: len(c.text), reverse=True):
        if all(cosine(c.vector, k.vector) <= cutoff for k in kept):
            kept.append(c)
    return sorted(kept, key=lambda c: c.score, reverse=True)`,
      code_language: "python",
    },
    {
      id: "m04-s04",
      order_index: 4,
      kind: "concept",
      title: "Where to cut: finding the gap",
      body_md: `The hardest part of cleaning is choosing the score threshold. Set it too low and the filler stays. Set it too high and you throw away the clause that answers the question.

So don't guess, and don't copy a number from someone else's project. Look at your own scores. Sort the candidates from highest score to lowest and print them. Here are the subcontractor question's scores after the near-duplicates are gone:

- 1.00 ${C.definitions.section} ${C.definitions.title}
- 0.94 ${C.permittedDisclosure.section} ${C.permittedDisclosure.title}
- 0.90 ${C.permittedRecipient.section} ${C.permittedRecipient.title}
- 0.81 ${C.compelledDisclosure.section} ${C.compelledDisclosure.title}
- 0.77 ${C.term.section} ${C.term.title}
- 0.74 ${C.contractors.section} ${C.contractors.title}
- 0.70 to 0.58: four more clauses, such as ${C.governingLaw.section} ${C.governingLaw.title}
- 0.31 the signature block
- 0.29 and below: 13 more weak matches

See the sudden drop between 0.58 and 0.31? That's the **score gap**: strong matches above it, filler below it. Put the threshold in the middle of the gap, at about 0.45. Ten clauses stay, and ${C.contractors.section} is one of them.

One question isn't enough to trust a threshold. Try the same cut on a few other questions about the NDA, like "Does the NDA cover our Affiliates?" and "How long does the NDA last?", and check the clause that answers each one stays above the line.

:::more When there's no clear gap
Module 3's merged scores are tiny numbers, like 0.03, because reciprocal rank fusion adds up fractions like 1 ÷ (60 + rank). To make them easy to read, divide every score by the top one, so the best is always 1.00. That's what the list above shows.

Merged scores sometimes fall smoothly, with no clear gap. Then use each candidate's meaning-search score for this step instead, or simply keep a fixed number, such as the top 10. Whatever you choose, never let the threshold leave fewer than about 5 clauses: an empty prompt only gets you "The contract does not address this."
:::`,
      code_snippet: `THRESHOLD = 0.45   # set from your own score plot: the middle of the gap

def drop_weak(candidates, min_keep=5):
    strong = [c for c in candidates if c.score >= THRESHOLD]
    return strong if len(strong) >= min_keep else candidates[:min_keep]`,
      code_language: "python",
    },
    {
      id: "m04-s05",
      order_index: 5,
      kind: "concept",
      title: "Trimming without breaking a clause",
      body_md: `The last cleaner is **trimming**: keeping only the sentences of each clause that relate to the question.

Most of our NDA's clauses are a single sentence, so they stay whole. Trimming earns its keep on long clauses. ${C.compelledDisclosure.section} ${C.compelledDisclosure.title} runs on for several sentences about court orders and notice, and only its first sentence is about sharing at all. Trimming keeps that one and drops the rest.

Legal text has one hard rule: **never cut in the middle of a sentence.** In a contract, the important part often comes at the end. ${C.permittedDisclosure.section} only lets you share with Permitted Recipients "provided that each is bound by written confidentiality obligations". Cut before "provided" and you've changed the law. So the trimmer splits a clause at full stops only, scores each whole sentence against the question, and keeps the best ones in their original order. And it never trims inside a definition, like ${C.permittedRecipient.section}: a definition is kept whole or not at all.

You can also hand this job to a small, cheap language model with a compression prompt, kept in a file called \`prompts/compress.md\`. Like Module 1's \`prompts/generate.md\`, it's a plain text file of instructions that your code reads and sends to the model, along with one clause and the question. Its most important rule: **copy sentences word for word.** The writer has to quote the NDA exactly, so the trimmer may remove words but never change them.`,
      code_snippet: `# prompts/compress.md
Below are one contract clause and a question.
Copy out only the sentences from the clause that help answer the question.
- Copy them word for word. Never reword, shorten or add anything.
- Keep whole sentences. Never stop in the middle of one.
- Keep any sentence with a condition ("provided that", "unless", "without").
- If no sentence helps, reply exactly: NONE

Clause: {clause}

Question: {question}`,
      code_language: "markdown",
    },
    {
      id: "m04-s06",
      order_index: 6,
      kind: "exercise",
      title: "Hands-on: try it yourself",
      body_md: `**Predict first:** of the 40 candidates for "${RUNNING_QUESTION}", how many do you think will survive all three cleaners? And in what place will ${C.contractors.section} end up? Write both guesses down before you start.

- **Guided:** Run the subcontractor question through your \`retrieve()\` function from Module 3 and print all the candidates. Then run the three cleaners one at a time, and write down the count after each step and where ${C.contractors.section} sits.
- **Partial:** Choose the score threshold yourself. Print the scores from highest to lowest, find the score gap, and put the cut in the middle of it. Then check the same cut on two more questions about the NDA, and make sure the clause that answers each one survives.
- **Solo:** Module 2's synonym table makes search look for "third party", "Permitted Recipient" and "contractor" as well as "subcontractor", so the same clauses come back several times. Fix the duplicates at the right stage, then write two sentences on why you didn't fix them in pre-retrieval instead.

**Files you create:** \`prompts/compress.md\`, an optional prompt file that asks a small model to cut a clause down to its useful sentences, word for word.

**Capstone branch:** save this work on a branch called \`post-retrieval\` in your course project. It needs a \`clean()\` step that sits between \`retrieve()\` and \`generate()\` and logs its counts before and after each cleaner.

**Check it with your assistant:** ask your coding assistant, "Does my post-retrieval branch remove near-duplicates above 0.95, cut weak matches at the score gap, trim only at full stops, log the counts at each step, and hand about 10 clauses on?"`,
    },
    {
      id: "m04-s07",
      order_index: 7,
      kind: "concept",
      title: "What cleaning can't do",
      body_md: `Cleaning is cheap and it helps almost every question. But know its limits before you lean on it.

- **It can only remove, never add.** If ${C.contractors.section} isn't among the 40 candidates, no amount of cleaning brings it back. That's a retrieval miss, and the fix belongs in Modules 2 and 3.
- **It doesn't decide the order.** After cleaning, ${C.contractors.section} is in the prompt, but 6th, behind ${C.definitions.section} Definitions, and the writer still answers from ${C.permittedDisclosure.section}. Putting the best clause first is Module 5's job.
- **Sometimes the whole clause is the point.** If someone asks "Show me ${C.permittedDisclosure.section} in full", don't trim it. Skip the trimmer when the question names a clause.
- **Small prompts don't need it.** If search only ever returns five short clauses, cleaning just adds work.

The question to ask: is the writer reading copies and filler? If yes, clean. If the right clause is missing, look earlier in the pipeline.`,
    },
  ],

  worked_example: [
    {
      id: "m04-w01",
      order_index: 1,
      title: "Search hands over 40 candidates",
      body_md: `The question goes through Module 3's \`retrieve()\`: keyword search and meaning search, merged into one list. About 40 candidates come back. ${C.contractors.section} is in there, 7th. So are three overlapping copies of ${C.permittedDisclosure.section} and the signature block.`,
      code_snippet: `candidates = retrieve("${RUNNING_QUESTION}")   # about 40`,
      code_language: "python",
      stage: "hybrid-retrieval",
      query_state: `About 40 candidates. ${C.contractors.section} is 7th, with three copies of ${C.permittedDisclosure.section} and the signature block in the pile.`,
    },
    {
      id: "m04-w02",
      order_index: 2,
      title: "Remove near-duplicates",
      body_md: `Each candidate is compared with the ones already kept. The three pieces of ${C.permittedDisclosure.section} score above 0.95 against each other, so only the most complete one stays, the whole clause with its condition. Other overlapping copies go the same way. One of the copies of ${C.permittedDisclosure.section} ranked above ${C.contractors.section}, so ${C.contractors.section} moves up from 7th to 6th.`,
      code_snippet: `kept = dedupe(candidates)   # 40 -> 24`,
      code_language: "python",
      stage: "post-retrieval",
      query_state: `24 candidates. One whole copy of ${C.permittedDisclosure.section}; ${C.contractors.section} is now 6th.`,
    },
    {
      id: "m04-w03",
      order_index: 3,
      title: "Cut at the score gap",
      body_md: `Sorted by score, the list drops suddenly from 0.58 to 0.31. The threshold goes in that gap, at 0.45. Everything above stays: ${C.definitions.section}, ${C.permittedDisclosure.section}, ${C.permittedRecipient.section}, ${C.compelledDisclosure.section}, ${C.term.section}, ${C.contractors.section} and four more. The signature block, at 0.31, goes, along with 13 other weak matches.`,
      code_snippet: `kept = drop_weak(kept)   # 24 -> 10 (threshold 0.45)`,
      code_language: "python",
      stage: "post-retrieval",
      query_state: `10 clauses. The signature block is gone; ${C.contractors.section} is 6th.`,
    },
    {
      id: "m04-w04",
      order_index: 4,
      title: "Trim to the sentences that matter",
      body_md: `Most clauses in the NDA are one sentence, so they stay whole. ${C.compelledDisclosure.section} is cut down to its first sentence, the only one about sharing. Nothing is cut mid-sentence, and ${C.permittedRecipient.section}, a definition, is kept whole. The prompt shrinks from about 6,000 tokens to about 1,200.`,
      code_snippet: `def trim(c, q_vector, keep=2):
    sentences = split_at_full_stops(c.text)
    if len(sentences) <= keep or c.is_definition:
        return c                      # short clauses and definitions stay whole
    best = sorted(sentences, key=lambda s: cosine(embed(s), q_vector), reverse=True)[:keep]
    c.text = " ".join(s for s in sentences if s in best)   # original order
    return c`,
      code_language: "python",
      stage: "post-retrieval",
      query_state: "10 clauses, about 1,200 tokens instead of 6,000. No sentence is broken.",
    },
    {
      id: "m04-w05",
      order_index: 5,
      title: "What the writer reads now",
      body_md: `The 10 clean clauses are numbered, best score first, and slotted into \`prompts/generate.md\`:

1. ${C.definitions.section} ${C.definitions.title}
2. ${C.permittedDisclosure.section} ${C.permittedDisclosure.title}
3. ${C.permittedRecipient.section} ${C.permittedRecipient.title}
4. ${C.compelledDisclosure.section} ${C.compelledDisclosure.title}
5. ${C.term.section} ${C.term.title}
6. ${C.contractors.section} ${C.contractors.title}

and four more below. No copies, no signature block, and ${C.contractors.section} made it through.`,
      code_snippet: `[1] (${cite(C.definitions)}) ${C.definitions.text}
[2] (${cite(C.permittedDisclosure)}) ${C.permittedDisclosure.text}
[3] (${cite(C.permittedRecipient)}) ${C.permittedRecipient.text}
…
[6] (${cite(C.contractors)}) ${C.contractors.text}
…

Question: ${RUNNING_QUESTION}`,
      code_language: "text",
      stage: "post-retrieval",
      query_state: `The question plus 10 clean clauses. ${C.contractors.section} is 6th.`,
    },
    {
      id: "m04-w06",
      order_index: 6,
      title: "The answer, and what's still wrong",
      body_md: `The answer comes back three times faster, at about a fifth of the cost:

> "Yes, to Permitted Recipients bound by written confidentiality obligations (${C.permittedDisclosure.section})."

That's better than before: it quotes the whole of ${C.permittedDisclosure.section}, condition included. But it's still the wrong answer. ${C.contractors.section} was in the prompt, 6th, and the writer leaned on the clauses it read first. Cleaning got the right clause in; Module 5 gets it to the top.`,
      stage: "generation",
      query_state: `Answered "Yes, to Permitted Recipients bound by written confidentiality obligations (${C.permittedDisclosure.section})." ${C.contractors.section} was in the prompt but ignored.`,
    },
  ],

  // Every term a learner meets in this module (tests/unit/glossary-coverage.test.ts
  // checks none is missing): contract words first, then the rest.
  glossary: [
    "nda", "clause", "section-sign", "subcontractor", "third-party", "permitted-recipient", "confidential-information",
    "disclosing-party", "receiving-party", "affiliate", "amendment", "notwithstanding", "written-consent", "signature-block",
    "language-model", "prompt", "prompt-file", "compression-prompt", "token", "index", "embedding", "cosine-similarity",
    "keyword-search", "reciprocal-rank-fusion", "synonym-table", "query-rewriting", "candidate", "retrieval-miss",
    "deduplication", "score-threshold", "score-gap", "lost-in-the-middle", "trimming", "re-rank", "function", "log", "branch",
  ],

  study_guide: [
    {
      id: "m04-p01",
      order_index: 1,
      point: "More context isn't better. Sending all 40 candidates buried §4.5 in the middle, and the answer got slower, costlier and still wrong.",
      narration: `Watch the prompt grow from three clauses to forty. Three copies of §4.2(b), the signature block, and §4.5 somewhere around 23rd. The writer reads the beginning and the end carefully and skims the middle, so it never mentions §4.5. And you paid ten times as much for that answer.`,
    },
    {
      id: "m04-p02",
      order_index: 2,
      point: "Search is generous, cleaning is strict. Post-retrieval sits between search and the writer and throws back what the writer doesn't need.",
      narration: `Picture a paralegal with a stack of photocopies. Out go the duplicate pages. Aside go the pages that don't matter. Then they highlight only the lines that answer the question. That's the cleaning step: one function, clean(), between search and the writer.`,
    },
    {
      id: "m04-p03",
      order_index: 3,
      point: "Three cleaners, in order: remove near-duplicates (cosine similarity above 0.95, keep the most complete), drop weak matches, trim.",
      narration: `See the three copies of §4.2(b) collapse into one, the whole clause, condition included. Then the weak matches fall away. Then the long clauses are cut down. Each step makes the next one cheaper, which is why the order matters.`,
    },
    {
      id: "m04-p04",
      order_index: 4,
      point: "Set the score threshold in the score gap of your own scores, and check it on several questions, not one.",
      narration: `Sort the scores from highest to lowest. See the sudden drop, from 0.58 down to 0.31? Strong matches sit above it, filler below. The threshold goes in the middle of that gap, and §4.5, at 0.74, stays safely above the line.`,
    },
    {
      id: "m04-p05",
      order_index: 5,
      point: "Trim only at full stops, keep definitions whole, and never change a word: the writer must quote the NDA exactly.",
      narration: `Watch what happens if §4.2(b) is cut before "provided that". The rule loses its condition, and the answer changes the law. So the trimmer splits only at full stops, keeps whole sentences, and copies them word for word.`,
    },
    {
      id: "m04-p06",
      order_index: 6,
      point: "Cleaning turns about 40 candidates into 10 with §4.5 in 6th place. It gets the right clause in, but can't put it first.",
      narration: `Follow §4.5 through the cleaning: 7th, then 6th once a copy above it is gone, and it survives the cut. The writer now sees it, but sixth, behind the definitions clause, and still answers from §4.2(b). Getting the best clause to the top is where Module 5 picks up.`,
    },
  ],

  quiz_items: [
    {
      id: "m04-q01",
      lesson_step_id: "m04-s02",
      order_index: 1,
      kind: "single_choice",
      prompt: "Your teammate sent the writer all 40 candidates for the subcontractor question. Why did the answer get worse?",
      choices: [
        { id: "a", text: "The writer can only read the first clause it's given" },
        { id: "b", text: "Copies and filler buried §4.5 in the middle, and the writer quoted a piece of §4.2(b) without its condition" },
        { id: "c", text: "A longer prompt always makes the model crash" },
        { id: "d", text: "It didn't get worse; more clauses are always better" },
      ],
      answer: { choice: "b" },
      explanation: "More text dilutes the clause that matters, the model skims the middle of a long prompt, and every extra token costs time and money.",
      difficulty: 1,
    },
    {
      id: "m04-q02",
      lesson_step_id: "m04-s02",
      order_index: 2,
      kind: "short_answer",
      prompt: "Language models read the start and end of a long prompt most carefully and skim what's in between. What is this called?",
      answer: { accepted: ["lost in the middle", "lost-in-the-middle", "getting lost in the middle"] },
      explanation: "Getting lost in the middle is why §4.5, around 23rd of 40, was ignored even though it was in the prompt.",
      difficulty: 1,
    },
    {
      id: "m04-q03",
      lesson_step_id: "m04-s03",
      order_index: 3,
      kind: "single_choice",
      prompt: "Search returns three overlapping copies of §4.2(b). What should the cleaning step do with them?",
      choices: [
        { id: "a", text: "Keep all three, so the writer sees §4.2(b) is important" },
        { id: "b", text: "Keep the shortest, because it's cheapest" },
        { id: "c", text: "They score above 0.95 against each other, so keep only the most complete one" },
        { id: "d", text: "Drop all three, since copies are always filler" },
      ],
      answer: { choice: "c" },
      explanation: "Near-identical pieces are the same clause. Keep the whole one, so the condition \"provided that each is bound by written confidentiality obligations\" survives.",
      difficulty: 1,
    },
    {
      id: "m04-q04",
      lesson_step_id: "m04-s03",
      order_index: 4,
      kind: "multi_choice",
      prompt: "Which of these does the clean() step do?",
      choices: [
        { id: "a", text: "Remove near-duplicate clauses" },
        { id: "b", text: "Rewrite the question in the NDA's own words" },
        { id: "c", text: "Drop candidates below the score threshold" },
        { id: "d", text: "Trim clauses to the sentences that relate to the question" },
        { id: "e", text: "Search the index again for more clauses" },
      ],
      answer: { choices: ["a", "c", "d"] },
      explanation: "Cleaning only removes: copies, weak matches and unneeded sentences. Rewriting the question is pre-retrieval's job, and searching is retrieval's.",
      difficulty: 2,
    },
    {
      id: "m04-q05",
      lesson_step_id: "m04-s04",
      order_index: 5,
      kind: "single_choice",
      prompt: "How should you choose the score threshold for the subcontractor question?",
      choices: [
        { id: "a", text: "Use 0.5, the usual value" },
        { id: "b", text: "Sort your own scores, find the sudden drop, and cut in the middle of it; then check other questions" },
        { id: "c", text: "Keep only the top 3, whatever their scores" },
        { id: "d", text: "Ask the language model to pick a number" },
      ],
      answer: { choice: "b" },
      explanation: "There's usually a visible gap between strong matches and filler. A number copied from elsewhere can sit above §4.5's score and throw it away.",
      difficulty: 2,
    },
    {
      id: "m04-q06",
      lesson_step_id: "m04-s05",
      order_index: 6,
      kind: "single_choice",
      prompt: "The trimmer is shortening §4.2(b). Where is it allowed to cut?",
      choices: [
        { id: "a", text: "After 20 words, to keep every clause short" },
        { id: "b", text: "Anywhere, as long as the words \"Permitted Recipients\" stay" },
        { id: "c", text: "Only at a full stop, so no sentence and no condition is broken" },
        { id: "d", text: "Before \"provided that\", since conditions are usually filler" },
      ],
      answer: { choice: "c" },
      explanation: "In a contract the condition often comes last. Cutting mid-sentence can drop \"provided that each is bound by written confidentiality obligations\" and change the law.",
      difficulty: 2,
    },
    {
      id: "m04-q07",
      lesson_step_id: "m04-s07",
      order_index: 7,
      kind: "single_choice",
      prompt: "After cleaning, §4.5 is in the writer's prompt, 6th of 10, but the answer still only cites §4.2(b). What's the right next step?",
      choices: [
        { id: "a", text: "Lower the score threshold so more clauses get through" },
        { id: "b", text: "Turn off trimming" },
        { id: "c", text: "Put the best clause first with a re-ranker (Module 5)" },
        { id: "d", text: "Send all 40 candidates again" },
      ],
      answer: { choice: "c" },
      explanation: "Cleaning got §4.5 into the prompt but doesn't decide the order. The writer leans on what it reads first, so the next stage puts the best clause at the top.",
      difficulty: 3,
    },
  ],

  failure_cases: [
    {
      id: "m04-f01",
      order_index: 1,
      title: "The threshold that threw away §4.5",
      category: "retrieval_miss",
      user_query: RUNNING_QUESTION,
      retrieved_context: [
        { source: cite(C.definitions), text: C.definitions.text, score: 1.0 },
        { source: cite(C.permittedDisclosure), text: C.permittedDisclosure.text, score: 0.94 },
        { source: cite(C.permittedRecipient), text: C.permittedRecipient.text, score: 0.9 },
        { source: cite(C.compelledDisclosure), text: C.compelledDisclosure.text, score: 0.81 },
      ],
      bad_output: `"Yes, to Permitted Recipients bound by written confidentiality obligations." (${C.permittedDisclosure.section} ${C.permittedDisclosure.title})`,
      symptom: `${C.contractors.section} was among search's candidates, but it isn't in the writer's prompt. Only four clauses survived cleaning.`,
      root_cause: `A fixed threshold of 0.80, copied from another project, sat above ${C.contractors.section}'s score of 0.74. Cleaning threw away the clause that answers the question.`,
      fix: "Sort this pipeline's own scores, put the threshold in the score gap, check it on several questions, and log the name of every clause each cleaner drops.",
      cause_options: [
        { id: "a", text: "The writer skimmed past §4.5 because it was lost in the middle of a long prompt" },
        { id: "b", text: "The threshold was set above §4.5's score" },
        { id: "c", text: "Keyword search stopped finding the word \"contractors\"" },
      ],
      correct_cause: "b",
    },
    {
      id: "m04-f02",
      order_index: 2,
      title: "The trimmer that cut a definition in half",
      category: "chunking",
      user_query: "Is a subcontractor a Permitted Recipient?",
      retrieved_context: [
        {
          source: `${cite(C.permittedRecipient)} (trimmed)`,
          text: '"Permitted Recipient" means any employee, officer or professional adviser of the Receiving Party',
          score: 0.9,
        },
      ],
      bad_output: `"It can be, if the subcontractor acts as a professional adviser to the Receiving Party." (${C.permittedRecipient.section} ${C.permittedRecipient.title})`,
      symptom: "The answer quotes a definition that stops mid-sentence and leaves out two conditions: the person must need to know, and must be bound by written confidentiality obligations.",
      root_cause: `The trimmer cut every clause after 15 words instead of at a full stop, so ${C.permittedRecipient.section} lost the end of its only sentence.`,
      fix: "Trim only at full stops, keep definitions whole, and check that every trimmed clause still ends where a sentence in the NDA ends.",
      cause_options: [
        { id: "a", text: "Query rewriting dropped the words \"needs to know\"" },
        { id: "b", text: "Deduplication kept a shorter copy of §1.4 instead of the whole definition" },
        { id: "c", text: "The trimmer cut §1.4 mid-sentence" },
      ],
      correct_cause: "c",
    },
    {
      id: "m04-f03",
      order_index: 3,
      title: "The deduplication that swallowed §4.5",
      category: "retrieval_miss",
      user_query: RUNNING_QUESTION,
      retrieved_context: [
        { source: cite(C.definitions), text: C.definitions.text, score: 1.0 },
        { source: cite(C.permittedDisclosure), text: C.permittedDisclosure.text, score: 0.94 },
        { source: cite(C.permittedRecipient), text: C.permittedRecipient.text, score: 0.9 },
      ],
      bad_output: `"Yes, to Affiliates and Permitted Recipients bound by written confidentiality obligations." (${C.permittedDisclosure.section} ${C.permittedDisclosure.title})`,
      symptom: `The log shows ${C.contractors.section} was dropped during deduplication, as a near-duplicate of ${C.permittedDisclosure.section}.`,
      root_cause: `Someone loosened the deduplication cut-off to 0.85 to catch more copies. ${C.contractors.section} is short and is about Section 4.2 and disclosure, so its embedding sits close to ${C.permittedDisclosure.section}'s (0.89), and it was dropped as a copy.`,
      fix: "Keep the cut-off strict, above 0.95. Before dropping a near-duplicate, check the two really are the same clause: a different section number means a different clause.",
      cause_options: [
        { id: "a", text: "A loose deduplication cut-off treated §4.5 as a copy" },
        { id: "b", text: "The threshold sat above §4.5's score" },
        { id: "c", text: "The amendment was added to the NDA after the index was last rebuilt" },
      ],
      correct_cause: "a",
    },
  ],
};

export default m04;
