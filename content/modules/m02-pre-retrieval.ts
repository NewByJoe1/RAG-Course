import type { ModuleContent } from "../types";
import { cite, NDA_CLAUSES as C, RUNNING_QUESTION } from "../nda";

// Module 2, in Module 1's lesson format, on the running example: one NDA
// (Acme Corp and Beta Ltd) and one question, "Can we share this with a
// subcontractor?". Module 1's miss was that the NDA never says
// "subcontractor"; this module translates the question into the contract's
// words, filters to the NDA and tags the question for routing. §4.2(b) climbs
// to 2nd, but §4.5 stays 9th, which Module 3 picks up.
//
// Quiz, step and failure ids are unchanged from the original Module 2, so
// existing attempts and review cards keep pointing at the same slots.

const REWRITE = "Is disclosure of Confidential Information to a third party, Permitted Recipient or contractor permitted?";
const M02_ANSWER = `Yes, to Permitted Recipients bound by written confidentiality obligations (${C.permittedDisclosure.section}).`;

const m02: ModuleContent = {
  id: "m02",
  slug: "pre-retrieval",
  order_index: 2,
  title: "Pre-Retrieval",
  summary:
    "Teach the contract assistant to translate \"Can we share this with a subcontractor?\" into the non-disclosure agreement's own words before it searches, narrow the search to the NDA, and tag how hard the question is so the right model answers it.",
  hook: `Module 1's assistant answered "${RUNNING_QUESTION}" with "The contract does not address this." Search the non-disclosure agreement (NDA) for the word "subcontractor" and you'll see why: it isn't there. The NDA says "third party", "Permitted Recipient" and, in ${C.contractors.section}, "contractors", so a search that starts from your words starts in the wrong place.`,
  learning_objectives: [
    "Explain why searching with your own everyday words can miss the clause that answers the subcontractor question",
    "Rewrite a question in the contract's own words with a rewrite prompt sent to a large language model (LLM)",
    "Build a synonym table that adds the NDA's words (third party, Permitted Recipient, contractor) to the question",
    "Use a metadata filter so the search only looks at the NDA's clauses",
    "Tag a question as simple, multi-clause or conflicting, and explain why the tag picks the stronger model when unsure",
  ],
  estimated_minutes: 60,
  is_published: true,
  pipeline_stages: ["pre-retrieval", "routing"],
  explain_back_prompt: `In your own words: the NDA never says "subcontractor". How does translating the question before the search help it find ${C.permittedDisclosure.section}, and why does ${C.contractors.section} still get missed?`,
  video: null,

  lesson_steps: [
    {
      id: "m02-s01",
      order_index: 1,
      kind: "warm_up",
      title: "Warm-up: what you already know",
      body_md: `Before we start, answer these from what you remember of Module 1. There are no wrong answers. You'll check yourself against the study guide at the end.

1. Module 1 described the system as two people: a librarian and a writer. What does each one do?
2. When the simple system answered "${RUNNING_QUESTION}", which clause came back first? And where was ${C.permittedDisclosure.section}?
3. What are the three rules in \`prompts/generate.md\`?`,
    },
    {
      id: "m02-s02",
      order_index: 2,
      kind: "concept",
      title: "The word that isn't there",
      body_md: `Let's pick up where Module 1 left off.

Someone at Beta asks, **"${RUNNING_QUESTION}"** The librarian searches the NDA and brings back ${C.definitions.section} Definitions, ${C.compelledDisclosure.section} Compelled Disclosure and ${C.term.section} Term. The writer reads them and honestly says, "The contract does not address this." The writer did its job. The librarian brought the wrong pages.

Why? Try something simple. Search the NDA for the word "subcontractor". You won't find it, not once. The contract talks about the same idea in its own words:

- **third party**: anyone who isn't Acme or Beta
- **Permitted Recipient** (${C.permittedRecipient.section}): the employees, officers and professional advisers who may be told the secrets
- **contractors**: in ${C.contractors.section}, added later by Amendment No. 1

Your question is in everyday English. The contract is in legal English. A search that starts from your words starts in the wrong place, and a cleverer search can't fix that on its own. **The question has to be translated first.**

:::key What Module 2 adds
This module builds two stages that run before any search. **[1] pre-retrieval** translates the question into the contract's own words. **[1b] routing** labels how hard the question is, so the right model writes the answer. That's why the map's 📍 You are here markers sit on those two stages, at the very start of the pipeline.

What's still wrong afterwards: ${C.permittedDisclosure.section} climbs from 5th to 2nd, and the answer becomes "${M02_ANSWER}" That's much closer. But ${C.contractors.section}, the amendment about contractors, still ranks 9th, so the writer never sees it. Module 3 adds keyword search to find it.
:::`,
    },
    {
      id: "m02-s03",
      order_index: 3,
      kind: "concept",
      title: "Translating the question",
      body_md: `Think about what a lawyer does. A client says, "Can I let my subcontractor see this?" Before opening the file, the lawyer quietly rephrases it: "Is disclosure to a third party permitted?" Same question, contract words. That's the whole idea of pre-retrieval.

We do it with two tools, cheapest first.

**Tool 1: a synonym table**
A short two-column list you write yourself. Everyday words on the left, the contract's words on the right:
- subcontractor → third party, Permitted Recipient, contractor
- share → disclose

Before searching, your code looks for the left-hand words in the question and adds the right-hand ones. No model is needed, and it does exactly what you wrote, every time.

**Tool 2: a rewrite prompt**
A table only knows the words you thought of. So we also ask a language model to restate the question the way a contract would. That's called **query rewriting**. The instructions live in a file called \`prompts/rewrite.md\`, a plain text file just like \`prompts/generate.md\` from Module 1. Your code reads the file, drops in the question, and sends it to a small, fast model.

For our question, the rewrite comes back as:

> "${REWRITE}"

Now the search runs **twice**: once with the original question and once with the rewrite. The two result lists are merged, and each clause keeps its better score. Keeping the original matters: if a rewrite ever goes wrong, the original is still there.

:::more How to write the rewrite prompt
- Ask for a few rewrites, three to five, one per line. Different wordings catch different clauses.
- Tell the model to use the NDA's own capitalised terms, such as Permitted Recipient and Confidential Information.
- Tell it to keep permission words exactly as asked. "May we share" must never become "must we share": that's a different question, answered by a different clause.
- Tell it not to answer the question. Its only job is to reword it.
:::`,
      code_snippet: `SYNONYMS = {
    "subcontractor": ["third party", "Permitted Recipient", "contractor"],
    "share": ["disclose"],
}

def expand(question: str) -> str:
    """Add the contract's words for any everyday word in the question."""
    extra = [alt for word, alts in SYNONYMS.items()
             if word in question.lower() for alt in alts]
    return question + " " + " ".join(extra)

def rewrite_query(question: str, llm) -> dict:
    prompt = open("prompts/rewrite.md").read().format(question=question)
    rewrites = llm(prompt).strip().split("\\n")[:5]
    return {
        "original": question,
        "searches": [expand(question), *rewrites],
        "filters": {"doc_type": "NDA"},
        "tag": tag_question(question, llm),  # prompts/tag.md, see Routing
    }`,
      code_language: "python",
    },
    {
      id: "m02-s04",
      order_index: 4,
      kind: "concept",
      title: "Searching only the contract",
      body_md: `Translating the question fixes one problem. Here's another.

Beta keeps everything about this deal in one project folder: the NDA, Amendment No. 1, and a pile of meeting notes. The notes say "subcontractor" all the time: "We'd like to bring in a subcontractor for the testing work." Search the whole folder and those notes match our question beautifully. But notes aren't rules. Only the contract can tell you what you're allowed to share.

So each clause is stored with a few labels, called **metadata**: which document it came from, what type of document that is, its section number and its page. Before searching, you add a **metadata filter**, a rule like \`doc_type = "NDA"\`, and the search skips everything else.

One detail matters here. Amendment No. 1 changes the NDA, so its clause, ${C.contractors.section}, is labelled as part of the NDA too. Label it as something else and the filter would quietly hide it.

**What changes for our question**

Search with the original question and the rewrite, only in the NDA, and the ranking moves:

1. ${C.definitions.section} ${C.definitions.title}
2. ${C.permittedDisclosure.section} ${C.permittedDisclosure.title}, up from 5th
3. ${C.permittedRecipient.section} ${C.permittedRecipient.title}

The writer now reads the right clauses and answers:

> "${M02_ANSWER}"

That's a real step forward. But look further down the list. ${C.contractors.section}, the amendment about contractors, is still **9th**, so the writer never sees it.`,
      code_snippet: `# Every clause is stored with its metadata.
{"text": "${C.contractors.text}",
 "section": "${C.contractors.section}", "doc": "Amendment No. 1", "doc_type": "NDA", "page": ${C.contractors.page}}

# The search only looks at clauses whose doc_type is "NDA".
results = search(query, top_k=3, filters={"doc_type": "NDA"})
if not results:                      # a filter that matches nothing
    results = search(query, top_k=3)  # search again without it, and log it`,
      code_language: "python",
    },
    {
      id: "m02-s05",
      order_index: 5,
      kind: "concept",
      title: "Routing: who writes the answer",
      body_md: `One more job happens before the search: deciding which model writes the answer.

Some questions about the NDA are easy. "How long does the NDA last?" One clause, ${C.term.section} Term, answers it. Others are harder. Our subcontractor question needs ${C.permittedRecipient.section} and ${C.permittedDisclosure.section} read together: who counts as a Permitted Recipient, and when you may disclose to one.

So the same small model that rewrites the question also gives it a one-word label, a **routing tag**:

- **simple**: one clause answers it → a small, fast, cheap model
- **multi-clause**: several clauses must be read together → the main model
- **conflicting**: the clauses seem to disagree → the strongest model, given extra time to think

The instructions for tagging live in \`prompts/tag.md\`, another plain text file that asks the model: "Is this question simple, multi-clause or conflicting? Reply with one word." Which model handles each tag lives in \`config/models.yaml\`, a plain text settings file with one line per tag. To swap a model you edit that file, not your code.

Our question is tagged **multi-clause**, so the main model writes the answer.

:::key When unsure, go up
If the tagger can't decide, it picks the stronger model, never the weaker one. A strong model on an easy question wastes a few cents. A weak model on a hard legal question can cost a wrong answer, and that costs far more.
:::

The tag is saved with every question. In Module 7 you'll use it to check whether hard questions score worse than easy ones. And in Module 10, once ${C.contractors.section} is in view, its "Notwithstanding Section 4.2" turns our question into a conflicting one.`,
      code_snippet: `# config/models.yaml: which model answers each routing tag
simple: small-model
multi-clause: main-model
conflicting: strongest-model
when_unsure: go_up   # never pick a weaker model than the tag allows`,
      code_language: "yaml",
    },
    {
      id: "m02-s06",
      order_index: 6,
      kind: "exercise",
      title: "Hands-on: try it yourself",
      body_md: `**Predict first:** after translating the question into the NDA's words, where do you think ${C.permittedDisclosure.section} will rank? And will ${C.contractors.section} make the top 3? Write both guesses down before you start.

- **Guided:** Add the synonym table and the supplied rewrite prompt to your Module 1 system. Ask "${RUNNING_QUESTION}" again and write down the top 5 clauses before and after, with their scores.
- **Partial:** Write \`prompts/tag.md\` and \`config/models.yaml\`. Tag five questions about the NDA, including the subcontractor question and "How long does the NDA last?", and check each one goes to the model you'd expect. One hint: when the tag is a close call, the stronger model wins.
- **Solo:** Grow the synonym table to 20 everyday words the NDA says differently (sister company → Affiliate, secret → Confidential Information, how long → Term), and run the search with the table alone, no language model. Compare its top 3 with the rewrite prompt's top 3.

**Files you create:** \`prompts/rewrite.md\`, the plain text prompt that rewrites the question; \`prompts/tag.md\`, the plain text prompt that tags it; and \`config/models.yaml\`, the settings file that says which model answers each tag.

**Capstone branch:** save this work on a branch called \`pre-retrieval\` in your course project. It builds on your naive-rag branch and adds one function, \`rewrite_query()\`, which takes the question and hands back the searches to run, the filter and the routing tag. Add tests too: small pieces of code that run \`rewrite_query()\` on the subcontractor question and check what comes back.

**Check it with your assistant:** ask your coding assistant, "Does my pre-retrieval branch return the original question plus its rewrites, a doc_type filter and a routing tag, and does the tag pick the model from config/models.yaml?"`,
    },
    {
      id: "m02-s07",
      order_index: 7,
      kind: "concept",
      title: "When translating isn't enough",
      body_md: `Pre-retrieval is cheap and it helps a lot. But it has limits, and our NDA shows every one of them.

- **A rewrite can change the meaning.** Turn "May we share this with a subcontractor?" into "Must we disclose…?" and the search lands on ${C.compelledDisclosure.section} Compelled Disclosure, which is about being forced to share. That's why you always search with the original question too.
- **Too many words is as bad as too few.** Add general words like "agreement" or "party" and every clause in the NDA matches a little. That's **over-expansion**, and it buries the clause you wanted.
- **It costs a little time.** The rewrite and the tag are an extra call to a model before every search. For a question already in the NDA's words, like "May the Receiving Party disclose to a Permitted Recipient?", you can skip the rewrite.
- **It can't make the search see a clause it reads badly.** Our rewrite already says "contractor", and ${C.contractors.section} says "contractors". Yet it still ranks 9th, because meaning search reads that short clause as "something about Section 4.2". Finding an exact word is a job for a different kind of search, and that's what Module 3 adds.`,
    },
  ],

  worked_example: [
    {
      id: "m02-w01",
      order_index: 1,
      title: "The question arrives",
      body_md: `Someone at Beta types the same question as in Module 1, in everyday words. This time it doesn't go straight to the search. It goes to pre-retrieval first.`,
      stage: null,
      query_state: `The question now: "${RUNNING_QUESTION}"`,
    },
    {
      id: "m02-w02",
      order_index: 2,
      title: "Look up the synonym table",
      body_md: `The code spots two everyday words with entries in the synonym table: "subcontractor" and "share". It adds the NDA's words for them: third party, Permitted Recipient, contractor, and disclose.`,
      code_snippet: `expand("${RUNNING_QUESTION}")
# "${RUNNING_QUESTION} third party Permitted Recipient contractor disclose"`,
      code_language: "python",
      stage: "pre-retrieval",
      query_state: "The question now: the original words, plus third party, Permitted Recipient, contractor and disclose.",
    },
    {
      id: "m02-w03",
      order_index: 3,
      title: "Rewrite it in contract language",
      body_md: `\`prompts/rewrite.md\` asks a small model to restate the question the way the NDA would. Its best rewrite keeps the meaning (a permission question stays a permission question) and uses the NDA's capitalised terms.`,
      stage: "pre-retrieval",
      query_state: `The question now: also searched as "${REWRITE}"`,
    },
    {
      id: "m02-w04",
      order_index: 4,
      title: "Filter and tag",
      body_md: `Two labels are added before the search. The metadata filter \`doc_type = "NDA"\` keeps Beta's meeting notes out, while Amendment No. 1 stays in. The routing tag is **multi-clause**, because ${C.permittedRecipient.section} and ${C.permittedDisclosure.section} must be read together, so \`config/models.yaml\` sends it to the main model.`,
      code_snippet: `{"original": "${RUNNING_QUESTION}",
 "searches": ["…with synonyms…", "${REWRITE}"],
 "filters": {"doc_type": "NDA"},
 "tag": "multi-clause"}`,
      code_language: "json",
      stage: "routing",
      query_state: "The question now: two searches, NDA clauses only, tagged multi-clause for the main model.",
    },
    {
      id: "m02-w05",
      order_index: 5,
      title: "Search with both",
      body_md: `Both searches run, and each clause keeps its better score:

1. ${C.definitions.section} ${C.definitions.title}: 0.83
2. ${C.permittedDisclosure.section} ${C.permittedDisclosure.title}: 0.82
3. ${C.permittedRecipient.section} ${C.permittedRecipient.title}: 0.80
4. ${C.compelledDisclosure.section} ${C.compelledDisclosure.title}: 0.77
…
9. ${C.contractors.section} ${C.contractors.title}: 0.70

The top 3 go to the writer. ${C.permittedDisclosure.section} has climbed from 5th to 2nd. ${C.contractors.section} is still 9th.`,
      stage: "hybrid-retrieval",
      query_state: `Top 3: ${C.definitions.section}, ${C.permittedDisclosure.section}, ${C.permittedRecipient.section}. ${C.contractors.section} is 9th and left out.`,
    },
    {
      id: "m02-w06",
      order_index: 6,
      title: "The answer, and what's still missing",
      body_md: `The main model reads the three clauses and answers:

> "${M02_ANSWER}"

It's grounded and cited, and much closer than Module 1. But Amendment No. 1 says contractors need the Disclosing Party's prior written consent, and the writer never saw ${C.contractors.section} (page ${C.contractors.page}). So this is still a retrieval miss, just a different one. Module 3 adds keyword search, which can spot the word "contractors" itself.`,
      stage: "generation",
      query_state: `The answer now: "${M02_ANSWER}" Closer, but it never saw ${C.contractors.section}.`,
    },
  ],

  // Every term a learner meets in this module (tests/unit/glossary-coverage.test.ts
  // checks none is missing): contract words first, then the rest.
  glossary: [
    "nda", "clause", "section-sign", "subcontractor", "third-party", "permitted-recipient", "confidential-information",
    "disclosing-party", "receiving-party", "affiliate", "amendment", "notwithstanding", "written-consent",
    "query-rewriting", "synonym-table", "over-expansion", "metadata", "metadata-filter", "routing-tag", "tagging-prompt",
    "settings-file", "llm", "language-model", "prompt", "prompt-file", "index", "chunk", "embedding", "keyword-search",
    "grounding", "retrieval-miss", "re-rank", "cross-encoder", "function", "branch",
  ],

  study_guide: [
    {
      id: "m02-p01",
      order_index: 1,
      point: "Module 1's miss: the librarian fetched §1.1 Definitions first and §4.2(b) came 5th, because the NDA never says \"subcontractor\".",
      narration: `Remember the two jobs: the librarian retrieves the right pages, and the writer answers only from them. In Module 1 the writer followed its three rules from prompts/generate.md: answer only from the clauses, cite every claim, and say "The contract does not address this" when they don't answer. It did exactly that. Watch why the librarian failed: search the NDA for "subcontractor" and nothing lights up.`,
    },
    {
      id: "m02-p02",
      order_index: 2,
      point: "Pre-retrieval translates the question into the contract's words before searching: a synonym table adds the NDA's words, and a rewrite prompt restates the whole question.",
      narration: `See the question pass through the synonym table: "subcontractor" picks up third party, Permitted Recipient and contractor. Then the rewrite prompt turns it into one sentence in the NDA's own language. Both versions are searched, alongside the original.`,
    },
    {
      id: "m02-p03",
      order_index: 3,
      point: "A rewrite must keep the meaning. \"May\" stays \"may\", and the original question is always searched too.",
      narration: `Watch a bad rewrite turn "may we share" into "must we disclose". The search jumps to §5 Compelled Disclosure, a clause about being forced to share. Because the original question is searched as well, the right clauses still have a way in.`,
    },
    {
      id: "m02-p04",
      order_index: 4,
      point: "A metadata filter keeps the search inside the contract: doc_type = NDA, with Amendment No. 1 labelled as part of the NDA.",
      narration: `See Beta's project folder: the NDA, its amendment, and meeting notes full of the word "subcontractor". The filter greys out the notes and keeps both the NDA and Amendment No. 1. If a filter ever matches nothing, the search runs again without it.`,
    },
    {
      id: "m02-p05",
      order_index: 5,
      point: "Routing tags each question simple, multi-clause or conflicting, and config/models.yaml picks the model. When unsure, go up.",
      narration: `Follow the subcontractor question to the tagger. It needs §1.4 and §4.2(b) read together, so it's tagged multi-clause and goes to the main model. If the tagger can't decide, it picks the stronger model: a few cents is cheaper than a wrong legal answer.`,
    },
    {
      id: "m02-p06",
      order_index: 6,
      point: "Result: §4.2(b) climbs to 2nd and the answer is \"Yes, to Permitted Recipients…\". Closer, but §4.5 is still 9th, so it's still a retrieval miss.",
      narration: `See the new ranking: §1.1 first, §4.2(b) second, §1.4 third. The answer finally talks about Permitted Recipients. Now scroll down to 9th place: §4.5, the amendment about contractors, never reached the writer. That's where Module 3 picks up.`,
    },
  ],

  quiz_items: [
    {
      id: "m02-q01",
      lesson_step_id: "m02-s02",
      order_index: 1,
      kind: "single_choice",
      prompt: `Why did the Module 1 system miss ${C.permittedDisclosure.section} for "${RUNNING_QUESTION}"?`,
      choices: [
        { id: "a", text: "The embedding model was too small" },
        { id: "b", text: "The NDA never uses the word \"subcontractor\"" },
        { id: "c", text: "The writer ignored the clauses it was given" },
        { id: "d", text: "The NDA was split into chunks that were too large" },
      ],
      answer: { choice: "b" },
      explanation: "The NDA says \"third party\", \"Permitted Recipient\" and \"contractors\", so a search that starts from the user's word starts in the wrong place.",
      difficulty: 1,
    },
    {
      id: "m02-q02",
      lesson_step_id: "m02-s03",
      order_index: 2,
      kind: "multi_choice",
      prompt: "Which of these happen in pre-retrieval, before the search runs? (Select all that apply.)",
      choices: [
        { id: "a", text: "Rewriting the question in the NDA's words" },
        { id: "b", text: "Adding words from the synonym table" },
        { id: "c", text: "Adding a metadata filter such as doc_type = NDA" },
        { id: "d", text: "Re-ranking the clauses with a cross-encoder" },
      ],
      answer: { choices: ["a", "b", "c"] },
      explanation: "Re-ranking checks the clauses after the search has found them (Module 5). The other three shape the search before it runs.",
      difficulty: 1,
    },
    {
      id: "m02-q03",
      lesson_step_id: "m02-s02",
      order_index: 3,
      kind: "short_answer",
      prompt: "Name one word or phrase the NDA uses where Beta would say \"subcontractor\".",
      answer: { accepted: ["third party", "third parties", "permitted recipient", "permitted recipients", "contractor", "contractors"] },
      explanation: "The NDA talks about third parties, Permitted Recipients (§1.4) and, since Amendment No. 1, contractors (§4.5).",
      difficulty: 1,
    },
    {
      id: "m02-q04",
      lesson_step_id: "m02-s03",
      order_index: 4,
      kind: "single_choice",
      prompt: "Why does the system search with the original question as well as the rewrite?",
      choices: [
        { id: "a", text: "Two searches are always twice as accurate as one" },
        { id: "b", text: "The rewrite prompt can only return one rewrite" },
        { id: "c", text: "If a rewrite goes wrong, the original still gives the right clauses a way in" },
        { id: "d", text: "The metadata filter only works on the original" },
      ],
      answer: { choice: "c" },
      explanation: "A rewrite can drift in meaning. Keeping the original is a cheap safety net.",
      difficulty: 2,
    },
    {
      id: "m02-q05",
      lesson_step_id: "m02-s03",
      order_index: 5,
      kind: "single_choice",
      prompt: "A rewrite turns \"May we share this with a subcontractor?\" into \"When must the Receiving Party disclose Confidential Information?\" What went wrong?",
      choices: [
        { id: "a", text: "Too many words were added" },
        { id: "b", text: "The rewrite changed a permission question into an obligation question" },
        { id: "c", text: "The metadata filter was wrong" },
        { id: "d", text: "Nothing: \"may\" and \"must\" mean the same in contracts" },
      ],
      answer: { choice: "b" },
      explanation: "\"May\" asks what you're allowed to do; \"must\" asks what you're forced to do. That points the search at §5 Compelled Disclosure instead of §4.2(b).",
      difficulty: 2,
    },
    {
      id: "m02-q06",
      lesson_step_id: "m02-s04",
      order_index: 6,
      kind: "single_choice",
      prompt: "Beta's meeting notes mention \"subcontractor\" many times. Why add the filter doc_type = NDA?",
      choices: [
        { id: "a", text: "The notes are too long to embed" },
        { id: "b", text: "The notes talk about subcontractors, but only the contract sets the rules" },
        { id: "c", text: "The filter makes the language model answer faster" },
        { id: "d", text: "Without it, Amendment No. 1 would be left out" },
      ],
      answer: { choice: "b" },
      explanation: "The notes would match the question's words well and crowd out the clauses that actually answer it. The amendment is labelled as part of the NDA, so the filter keeps it.",
      difficulty: 2,
    },
    {
      id: "m02-q07",
      lesson_step_id: "m02-s05",
      order_index: 7,
      kind: "single_choice",
      prompt: "The tagger can't decide whether the subcontractor question is simple or multi-clause. What should it do?",
      choices: [
        { id: "a", text: "Pick simple, to save money" },
        { id: "b", text: "Pick multi-clause, so the stronger model answers" },
        { id: "c", text: "Refuse to answer the question" },
        { id: "d", text: "Pick one at random and log it" },
      ],
      answer: { choice: "b" },
      explanation: "When unsure, go up. A strong model on an easy question wastes a little money; a weak model on a hard one risks a wrong legal answer.",
      difficulty: 3,
    },
  ],

  failure_cases: [
    {
      id: "m02-f01",
      order_index: 1,
      title: "The question that matched everything",
      category: "ranking",
      user_query: RUNNING_QUESTION,
      retrieved_context: [
        { source: cite(C.definitions), text: C.definitions.text, score: 0.84 },
        { source: "Signature block, p.6", text: "In witness whereof, the parties have signed this Agreement as of the Effective Date.", score: 0.83 },
        { source: cite(C.governingLaw), text: C.governingLaw.text, score: 0.82 },
      ],
      bad_output: `"This Agreement is governed by the laws of the State of Delaware. Confidential Information means non-public information marked confidential." (${C.governingLaw.section} Governing Law, ${C.definitions.section} Definitions)`,
      symptom: `The answer is about the wrong things, and ${C.permittedDisclosure.section} is nowhere in sight.`,
      root_cause: `Over-expansion: the synonym table and rewrite added general words like "agreement", "party" and "information", which appear in nearly every clause. Everything matched a little, and ${C.permittedDisclosure.section} sank out of the top 3.`,
      fix: "Expand only the key idea (subcontractor), with a few specific contract words. Cap how many words get added, and never add words that appear in most clauses.",
      cause_options: [
        { id: "a", text: "The metadata filter let Beta's meeting notes into the search" },
        { id: "b", text: "The expansion added words found in every clause" },
        { id: "c", text: "The writer ignored §4.2(b)" },
      ],
      correct_cause: "b",
    },
    {
      id: "m02-f02",
      order_index: 2,
      title: "The rewrite that changed the meaning",
      category: "prompt",
      user_query: "May we share this with a subcontractor?",
      retrieved_context: [
        { source: cite(C.compelledDisclosure), text: C.compelledDisclosure.text, score: 0.88 },
        { source: cite(C.definitions), text: C.definitions.text, score: 0.74 },
      ],
      bad_output: `"Yes, you must disclose it if the law requires you to, after giving the Disclosing Party prompt notice." (${C.compelledDisclosure.section} Compelled Disclosure)`,
      symptom: "The answer is about being forced to share, not about being allowed to share.",
      root_cause: `The rewrite ("When must the Receiving Party disclose Confidential Information to a third party?") turned "may", a permission word, into "must", an obligation word. That matches ${C.compelledDisclosure.section} Compelled Disclosure, not ${C.permittedDisclosure.section}, and the original question wasn't searched as a backup.`,
      fix: "Tell the rewrite prompt to keep permission words (may, must, shall) exactly as asked, always search with the original question too, and compare each rewrite with the original before using it.",
      cause_options: [
        { id: "a", text: "The synonym table had no entry for the word \"share\"" },
        { id: "b", text: "Meaning search can't tell §5 from §4.2(b)" },
        { id: "c", text: "The rewrite turned \"may\" into \"must\"" },
      ],
      correct_cause: "c",
    },
    {
      id: "m02-f03",
      order_index: 3,
      title: "The filter that found nothing",
      category: "retrieval_miss",
      user_query: RUNNING_QUESTION,
      retrieved_context: [],
      bad_output: "\"The contract does not address this.\"",
      symptom: "The same answer as Module 1, but this time the writer was handed no clauses at all.",
      root_cause: "The filter asked for doc_type = \"nda\" in small letters, but every clause was stored with the label \"NDA\". No clause matched, so the search returned nothing and the writer had nothing to read.",
      fix: "Pick filter values from the labels actually stored, not free text. If a filtered search comes back empty, search again without the filter, and log that it happened.",
      cause_options: [
        { id: "a", text: "The filter's label didn't match any stored clause" },
        { id: "b", text: "The NDA was never added to the index after Amendment No. 1" },
        { id: "c", text: "The rewrite prompt sent an empty question" },
      ],
      correct_cause: "a",
    },
  ],
};

export default m02;
