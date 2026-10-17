import type { ModuleContent } from "../types";
import { cite, NDA_CLAUSES as C, RUNNING_QUESTION } from "../nda";

// Module 1, rewritten on the running example: one NDA (Acme Corp and Beta Ltd)
// and one question, "Can we share this with a subcontractor?". It sets up what
// Module 2 recalls: the librarian and the writer, the naive system retrieving
// the definitions clause instead of §4.2(b), and the three rules in
// prompts/generate.md.
//
// Quiz, step and failure ids are unchanged from the original Module 1, so
// existing attempts and review cards keep pointing at the same slots.

const m01: ModuleContent = {
  id: "m01",
  slug: "rag-foundations",
  order_index: 1,
  title: "RAG Foundations",
  summary:
    "Build the simplest retrieval-augmented generation (RAG) pipeline on one non-disclosure agreement (NDA), ask it whether you can share the NDA with a subcontractor, and learn to tell a retrieval miss from a writing mistake when it gets the answer wrong.",
  hook: `You ask a simple contract assistant, "${RUNNING_QUESTION}" It reads your non-disclosure agreement (NDA) and tells you the NDA doesn't cover subcontractors. But ${C.permittedDisclosure.section} does, and the assistant never even saw it.`,
  learning_objectives: [
    "Explain what retrieval-augmented generation (RAG) is, and why a language model needs it to answer questions about your own contract",
    "Follow the subcontractor question through a simple RAG pipeline, one stage at a time",
    "Describe how embeddings and cosine similarity find clauses by meaning, and where that falls short",
    "Write a prompt that answers only from the NDA, cites every claim, and admits when the NDA doesn't say",
    "Tell whether a wrong answer came from finding the clauses (retrieval) or from writing the answer (generation)",
  ],
  estimated_minutes: 90,
  is_published: true,
  pipeline_stages: ["hybrid-retrieval", "generation"],
  explain_back_prompt: `In your own words: the simple system said the NDA doesn't cover subcontractors, but ${C.permittedDisclosure.section} does. Was that a retrieval mistake or a generation mistake, and how can you tell?`,
  video: null,

  lesson_steps: [
    {
      id: "m01-s01",
      order_index: 1,
      kind: "warm_up",
      title: "Warm-up: what you already know",
      body_md: `Before we start, answer these from what you know right now. There are no wrong answers. You'll check yourself against the study guide at the end.

1. A colleague asks a chatbot, "${RUNNING_QUESTION}" The chatbot has never seen your NDA. So where does its answer come from?
2. If you had to answer that question yourself, what's the first thing you'd do?
3. What would make you trust someone else's answer?`,
    },
    {
      id: "m01-s02",
      order_index: 2,
      kind: "concept",
      title: "The problem RAG solves",
      body_md: `Let's start with a story.

Acme Corp and Beta Ltd are about to work together, so they've signed a non-disclosure agreement: a contract where each side promises to keep the other's secrets. Now someone at Beta wants to bring in a subcontractor, an outside company, to help with the work. So they ask: **"${RUNNING_QUESTION}"**

Ask an ordinary chatbot and you'll get an answer, and it will sound sure of itself. But the chatbot runs on a language model that has never seen this NDA. It's guessing from contracts in general, and you have no way to check it.

**Retrieval-augmented generation**, or **RAG** for short, fixes that in three moves:

1. **Retrieve:** find the clauses in your NDA that relate to the question.
2. **Augment:** add those clauses to the prompt, the message you send to the model.
3. **Generate:** have the model write its answer from those clauses, pointing to each one it used.

:::key Two jobs
Picture two people. **The librarian retrieves the right pages. The writer answers only from them.** The model stops trying to remember and starts reading, which it's much better at.
:::`,
    },
    {
      id: "m01-s03",
      order_index: 3,
      kind: "concept",
      title: "The pipeline, on our NDA",
      body_md: `A RAG system works in two phases. Here's what each one does to our NDA.

**Getting ready: once, before anyone asks**
- **Load** the NDA, which arrives as a PDF (Portable Document Format) file.
- **Chunk** it: cut it into pieces, one clause per piece. ${C.definitions.section} Definitions, ${C.permittedRecipient.section} Permitted Recipient, ${C.permittedDisclosure.section} Permitted Disclosure, and so on.
- **Embed** each chunk: turn it into a list of numbers that stands for its meaning.
- **Store** those numbers in an index, along with each clause's section, title and page.

**Answering: every time someone asks**
- **Embed** the question, "${RUNNING_QUESTION}", the same way.
- **Retrieve** the few clauses whose numbers are closest to the question's.
- **Generate** an answer from just those clauses, citing each one.

:::key What Module 1 builds, and why it gets the answer wrong
A finished contract assistant has seven stages. You'll find them all on the pipeline map in the Go deeper tab. Module 1 builds only two of them, in their simplest form: **[2] hybrid retrieval**, which finds the clauses (for now, just its search-by-meaning half), and **[5] generation**, which writes the answer. That's why the map's 📍 You are here markers sit on just those two stages.

With only those two stages, the system gets the subcontractor question **wrong**. That's on purpose: you'll see exactly how it fails. Each later module then adds one missing stage to fix a mistake like this one. Module 2 adds **[1] pre-retrieval**, which translates the question into the contract's own words before searching. Module 3 adds keyword search to retrieval. Module 4 tidies the results, Module 5 puts the best clause first, and so on until all seven stages are in place.
:::`,
    },
    {
      id: "m01-s04",
      order_index: 4,
      kind: "concept",
      title: "How the search finds clauses",
      body_md: `Here's the trick that lets a computer search by meaning.

An **embedding** turns a piece of text into a long list of numbers. Texts that mean similar things get similar numbers. Picture each list as an arrow pointing somewhere in space: "subcontractor" points almost the same way as "third party" and "Permitted Recipient", even though the words look nothing alike.

To compare two arrows we use **cosine similarity**. It measures the angle between them and gives a score from -1 to 1. Arrows pointing the same way score close to 1; unrelated ones score near 0.

So the question can find clauses that don't share any of its words. That's the good news.

Now the catch. Our NDA never uses the word "subcontractor". When the simple system searches, the clause that scores highest is **${C.definitions.section} Definitions**, a general clause about what counts as a secret. ${C.permittedDisclosure.section}, the clause that actually answers the question, comes **fifth**. Close in meaning isn't the same as closest.

:::key Two rules to remember
- **Embed the question and the clauses with the same embedding model.** Numbers from different models can't be compared, like measuring one thing in inches and another in centimetres.
- **Meaning isn't spelling.** An exact reference like "Section 4.2(b)" embeds poorly. Module 3 adds keyword search for those.
:::`,
      code_snippet: `function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}`,
      code_language: "typescript",
    },
    {
      id: "m01-s05",
      order_index: 5,
      kind: "concept",
      title: "Keeping the writer honest",
      body_md: `Finding the right clauses only helps if the writer sticks to them. So we give the model a set of instructions, a prompt, and keep it in a file called \`prompts/generate.md\`. That's just a plain text file; the .md ending means simple text with light formatting. Your code reads the file, fills in the clauses and the question, and sends the whole thing to the model.

The prompt has three rules:

1. **Answer only from the numbered clauses.** No outside knowledge.
2. **Cite every claim** by section and clause title, like (${C.permittedDisclosure.section} ${C.permittedDisclosure.title}).
3. **If the clauses don't answer the question, say "The contract does not address this."**

Answering only from the text you were given is called **grounding**. Pointing to the clause you used is a **citation**.

Rule 3 matters most for our story. In the worked example, the simple system honestly says the NDA doesn't cover subcontractors. That's wrong, but it's usefully wrong: the citations show exactly which clauses it read. So you can see the mistake happened while finding the clauses, not while writing the answer.`,
      code_snippet: `# prompts/generate.md
Answer the question using only the numbered contract chunks below.
- Cite every claim by section and clause title, e.g. (§4.2(b) Permitted Disclosure).
- If the chunks don't answer the question, reply exactly:
  "The contract does not address this."

Chunks:
{chunks}

Question: {question}`,
      code_language: "markdown",
    },
    {
      id: "m01-s06",
      order_index: 6,
      kind: "exercise",
      title: "Hands-on: try it yourself",
      body_md: `**Predict first:** which clause do you think the simple system will rank first for "${RUNNING_QUESTION}"? Write your guess down before you start.

- **Guided:** Build an index of the NDA with one clause per chunk. Ask the subcontractor question and write down the top 5 clauses it returns, with their scores.
- **Partial:** Now cut the NDA into chunks by size instead of by clause: about 150, 500 and 1,500 tokens (a token is roughly three-quarters of a word). Each time, note where ${C.permittedDisclosure.section} ranks, and whether any chunk cuts it in half.
- **Solo:** Write \`prompts/generate.md\` with the three rules. Run it on the top 3 chunks, then check every citation against the NDA yourself.

**Files you create:** \`index/\`, the folder that holds your searchable index, and \`prompts/generate.md\`, your prompt file.

**Capstone branch:** save this work on a branch called \`naive-rag\` in your course project. A branch is a named copy of your code, so each module's version stays separate. It needs two functions: \`retrieve()\`, which finds clauses, and \`generate()\`, which writes the answer.

**Check it with your assistant:** ask your coding assistant, "Does my naive-rag branch chunk the NDA by clause, use one embedding model for both the index and the question, and answer only from numbered, cited chunks?"`,
    },
    {
      id: "m01-s07",
      order_index: 7,
      kind: "concept",
      title: "When RAG isn't the answer",
      body_md: `One last thing before you practise. RAG is a great tool, but not every question about contracts needs it.

- "${RUNNING_QUESTION}" → **RAG.** The answer is written somewhere in the NDA's text. You just need to find it.
- "How many NDAs did we sign with subcontractors this year?" → **a database.** Counting needs exact records, not text that sounds similar.
- "Rewrite ${C.permittedDisclosure.section} in plain English" → **no search needed.** You already know which clause it is, so paste it straight into the prompt.

Before reaching for RAG, ask two questions. Is the answer in the documents' text? And is there too much text to simply paste in?`,
    },
  ],

  worked_example: [
    {
      id: "m01-w01",
      order_index: 1,
      title: "The question arrives",
      body_md: `Someone at Beta types the question just as they'd say it out loud. The simple system searches with these exact words. (In Module 2 you'll add a stage that first translates them into the contract's language.)`,
      stage: null,
      query_state: `"${RUNNING_QUESTION}"`,
    },
    {
      id: "m01-w02",
      order_index: 2,
      title: "Embed the question",
      body_md: `The question is turned into an embedding: a long list of numbers that stands for its meaning. It has to be the same embedding model that was used on the NDA's clauses, or the numbers can't be compared.`,
      code_snippet: `const q = await embed("${RUNNING_QUESTION}");`,
      code_language: "typescript",
      stage: "hybrid-retrieval",
      query_state: "A list of about 384 numbers that captures what the question means.",
    },
    {
      id: "m01-w03",
      order_index: 3,
      title: "Search the index",
      body_md: `The system scores every clause in the index by how close it is to the question (cosine similarity), highest first:

1. ${C.definitions.section} ${C.definitions.title}: 0.81
2. ${C.compelledDisclosure.section} ${C.compelledDisclosure.title}: 0.78
3. ${C.term.section} ${C.term.title}: 0.74
4. Signature block: 0.72
5. ${C.permittedDisclosure.section} ${C.permittedDisclosure.title}: 0.71

It keeps only the **top 3**. The clause that actually answers the question came fifth, so it's left out.`,
      code_snippet: `const top = index
  .map((c) => ({ c, score: cosine(q, c.vector) }))
  .sort((a, b) => b.score - a.score)
  .slice(0, 3);`,
      code_language: "typescript",
      stage: "hybrid-retrieval",
      query_state: `Top 3: ${C.definitions.section}, ${C.compelledDisclosure.section}, ${C.term.section}. ${C.permittedDisclosure.section} is 5th and left out.`,
    },
    {
      id: "m01-w04",
      order_index: 4,
      title: "Build the grounded prompt",
      body_md: `The three clauses are numbered and slotted into \`prompts/generate.md\`, under its three rules: answer only from these, cite every claim, and say so if they don't answer.`,
      code_snippet: `[1] (${cite(C.definitions)}) ${C.definitions.text}
[2] (${cite(C.compelledDisclosure)}) ${C.compelledDisclosure.text}
[3] (${cite(C.term)}) ${C.term.text}

Question: ${RUNNING_QUESTION}`,
      code_language: "text",
      stage: "generation",
      query_state: "The question plus three numbered clauses. None of them mention sharing with anyone.",
    },
    {
      id: "m01-w05",
      order_index: 5,
      title: "The answer",
      body_md: `The writer follows every rule. It reads the three clauses, finds nothing about sharing with subcontractors, and says so:

> "The contract does not address this. (${C.definitions.section} Definitions, ${C.compelledDisclosure.section} Compelled Disclosure, ${C.term.section} Term)"

It's grounded, it's cited, and it's wrong: ${C.permittedDisclosure.section} does cover this.`,
      stage: "generation",
      query_state: "Answered \"The contract does not address this.\", which is incorrect for this NDA.",
    },
    {
      id: "m01-w06",
      order_index: 6,
      title: "Diagnose: retrieval or generation?",
      body_md: `Before blaming the writer, check what it was given. Look up ${C.permittedDisclosure.section} in the NDA: it's there, on page ${C.permittedDisclosure.page}, and it answers the question. It just never reached the writer.

So this is a **retrieval miss**: the right clause existed, but the search didn't find it. The writer did its job with what it had. The fix belongs earlier in the pipeline, and that's where Module 2 starts: translating the question into the NDA's own words, "third party" and "Permitted Recipient", before searching.`,
      stage: "hybrid-retrieval",
      query_state: `Diagnosis: retrieval miss. ${C.permittedDisclosure.section} existed but ranked 5th.`,
    },
  ],

  // Every term a learner meets in this module (tests/unit/glossary-coverage.test.ts
  // checks none is missing): contract words first, then RAG words.
  glossary: [
    "nda", "clause", "section-sign", "subcontractor", "third-party", "permitted-recipient", "confidential-information",
    "disclosing-party", "receiving-party", "affiliate", "amendment", "notwithstanding", "written-consent",
    "rag", "language-model", "prompt", "prompt-file", "pdf", "chunk", "embedding", "vector", "cosine-similarity", "index",
    "keyword-search", "grounding", "citation", "retrieval-miss", "re-rank", "token", "function", "branch", "database",
  ],

  study_guide: [
    {
      id: "m01-p01",
      order_index: 1,
      point: "A language model has never seen your NDA. RAG retrieves the relevant clauses and has the model answer from them.",
      narration: `Watch the subcontractor question go to a model on its own. The answer comes from contracts in general, not from your NDA. Now add one step: the system first pulls out the NDA's own clauses, and then the model reads them and answers. That one change is RAG.`,
    },
    {
      id: "m01-p02",
      order_index: 2,
      point: "Two jobs: the librarian retrieves the right clauses; the writer answers only from them.",
      narration: `Picture the pipeline as two people. The librarian takes the question and fetches pages from the NDA. The writer reads only those pages and writes the answer. If the librarian brings the wrong pages, even a perfect writer gets it wrong.`,
    },
    {
      id: "m01-p03",
      order_index: 3,
      point: "Getting ready happens once (chunk, embed, store). Answering happens for every question (embed, retrieve, generate).",
      narration: `First, the NDA is cut into clauses, each clause becomes a list of numbers, and those go into the index. That happens once. Then every question takes the same path: it becomes a list of numbers too, the closest clauses come back, and the writer answers from them.`,
    },
    {
      id: "m01-p04",
      order_index: 4,
      point: "Embeddings match meaning, not spelling, and the question and the clauses must use the same embedding model.",
      narration: `See "subcontractor" land near "third party" and "Permitted Recipient", close in meaning even though the words differ. But it lands nearest the definitions clause, so meaning alone isn't enough. And if the question and the clauses use different models, the distances mean nothing.`,
    },
    {
      id: "m01-p05",
      order_index: 5,
      point: "A grounded prompt has three rules: answer only from the chunks, cite every claim by section and clause title, and say \"The contract does not address this\" when they don't answer.",
      narration: `Follow the three numbered clauses into the prompt. The writer may use only these, must cite a section for every claim, and has an honest way out when the clauses don't answer. That way out is what makes a retrieval miss visible instead of hidden behind a confident guess.`,
    },
    {
      id: "m01-p06",
      order_index: 6,
      point: "When an answer is wrong, check the retrieved chunks first. If the right clause never arrived, it's a retrieval miss, not a writing mistake.",
      narration: `The answer says the NDA is silent. Trace back: the top three clauses never mention sharing, and §4.2(b), the clause that answers it, sits fifth, just outside the cut. The writer was right about what it saw. The miss happened in retrieval, which is where Module 2 picks up.`,
    },
  ],

  quiz_items: [
    {
      id: "m01-q01",
      lesson_step_id: "m01-s02",
      order_index: 1,
      kind: "single_choice",
      prompt: `Why can't a plain chatbot reliably answer "${RUNNING_QUESTION}" about your NDA?`,
      choices: [
        { id: "a", text: "It generates text too slowly" },
        { id: "b", text: "It never saw your NDA, so it can only guess from contracts in general" },
        { id: "c", text: "It can't follow multi-step instructions" },
        { id: "d", text: "Legal questions are blocked by the model" },
      ],
      answer: { choice: "b" },
      explanation: "RAG retrieves your NDA's own clauses at question time, so the model answers from evidence it never saw in training.",
      difficulty: 1,
    },
    {
      id: "m01-q02",
      lesson_step_id: "m01-s03",
      order_index: 2,
      kind: "multi_choice",
      prompt: "Which of these happen once, when the NDA is indexed, rather than for every question?",
      choices: [
        { id: "a", text: "Splitting the NDA into clause chunks" },
        { id: "b", text: "Embedding the subcontractor question" },
        { id: "c", text: "Embedding each clause chunk" },
        { id: "d", text: "Writing the answer with citations" },
      ],
      answer: { choices: ["a", "c"] },
      explanation: "Chunking and embedding the NDA happen ahead of time. Embedding the question and writing the answer happen for each question.",
      difficulty: 1,
    },
    {
      id: "m01-q03",
      lesson_step_id: "m01-s04",
      order_index: 3,
      kind: "short_answer",
      prompt: "What measure compares the angle between the question's embedding and a clause's embedding, ignoring their length?",
      answer: { accepted: ["cosine similarity", "cosine", "cosine distance"] },
      explanation: "Cosine similarity is the cosine of the angle between two vectors, from -1 to 1.",
      difficulty: 1,
    },
    {
      id: "m01-q04",
      lesson_step_id: "m01-s04",
      order_index: 4,
      kind: "single_choice",
      prompt: "You re-embed the NDA's clauses with a new embedding model but keep embedding questions with the old one. What happens?",
      choices: [
        { id: "a", text: "Retrieval improves because the new model is better" },
        { id: "b", text: "Nothing changes, since embeddings are interchangeable" },
        { id: "c", text: "Retrieval becomes close to random, because the vectors live in different spaces" },
        { id: "d", text: "The index rejects the questions" },
      ],
      answer: { choice: "c" },
      explanation: "Similarity only means something between vectors from the same model. Mixing models quietly breaks search, often with no error.",
      difficulty: 2,
    },
    {
      id: "m01-q05",
      lesson_step_id: "m01-s06",
      order_index: 5,
      kind: "single_choice",
      prompt: "With very small chunks, why might no single chunk fully answer the subcontractor question?",
      choices: [
        { id: "a", text: "The index uses too little storage" },
        { id: "b", text: "§4.2(b) gets split, so its condition lands in a different chunk" },
        { id: "c", text: "Small chunks can't be embedded" },
        { id: "d", text: "The model refuses short chunks" },
      ],
      answer: { choice: "b" },
      explanation: "Small chunks can cut a clause off from its condition. Cut chunks at clause boundaries, or let neighbouring chunks overlap a little.",
      difficulty: 2,
    },
    {
      id: "m01-q06",
      lesson_step_id: "m01-s05",
      order_index: 6,
      kind: "multi_choice",
      prompt: "Which rules belong in prompts/generate.md?",
      choices: [
        { id: "a", text: "Answer only from the numbered chunks" },
        { id: "b", text: "Cite every claim by section and clause title" },
        { id: "c", text: "Sound as confident as possible" },
        { id: "d", text: "Say \"The contract does not address this\" when the chunks don't answer" },
      ],
      answer: { choices: ["a", "b", "d"] },
      explanation: "Restricting the sources, citing every claim and offering an honest exit keep answers grounded. Asking for confidence does the opposite.",
      difficulty: 2,
    },
    {
      id: "m01-q07",
      lesson_step_id: "m01-s07",
      order_index: 7,
      kind: "single_choice",
      prompt: "Your manager asks, \"How many NDAs did we sign with subcontractors this year?\" The contracts are listed in a database table. What's the best approach?",
      choices: [
        { id: "a", text: "Embed every contract and retrieve the top 5" },
        { id: "b", text: "Train the model on the contracts table" },
        { id: "c", text: "Query the database directly, since it holds the exact records" },
        { id: "d", text: "Paste every contract into the prompt" },
      ],
      answer: { choice: "c" },
      explanation: "Counting records needs exact data. Retrieval returns similar text, not a count.",
      difficulty: 3,
    },
  ],

  failure_cases: [
    {
      id: "m01-f01",
      order_index: 1,
      title: "The definitions clause wins",
      category: "retrieval_miss",
      user_query: RUNNING_QUESTION,
      retrieved_context: [
        { source: cite(C.definitions), text: C.definitions.text, score: 0.81 },
        { source: cite(C.compelledDisclosure), text: C.compelledDisclosure.text, score: 0.78 },
        { source: cite(C.term), text: C.term.text, score: 0.74 },
      ],
      bad_output: `"The contract does not address this." (${C.definitions.section} Definitions, ${C.compelledDisclosure.section} Compelled Disclosure, ${C.term.section} Term)`,
      symptom: `A grounded, cited answer that's wrong: ${C.permittedDisclosure.section} does address it.`,
      root_cause: `The question's words never matched ${C.permittedDisclosure.section}, so it ranked 5th and never reached the writer.`,
      fix: "Check the retrieved chunks before blaming the writer. In Module 2, translate the question into the NDA's own words (third party, Permitted Recipient) before searching.",
      cause_options: [
        { id: "a", text: "The question's words never matched §4.2(b)" },
        { id: "b", text: "The writer ignored the clauses it was given" },
        { id: "c", text: "The NDA PDF only loaded its first few pages" },
      ],
      correct_cause: "a",
    },
    {
      id: "m01-f02",
      order_index: 2,
      title: "Half a permitted-disclosure clause",
      category: "chunking",
      user_query: RUNNING_QUESTION,
      retrieved_context: [
        {
          source: `${cite(C.permittedDisclosure)} (chunk 1 of 2)`,
          text: "The Receiving Party may disclose Confidential Information only: (a) with the Disclosing Party's prior written consent; or (b) to its Affiliates and Permitted Recipients,",
          score: 0.84,
        },
      ],
      bad_output: `"Yes. You may disclose to Affiliates and Permitted Recipients." (${C.permittedDisclosure.section} ${C.permittedDisclosure.title})`,
      symptom: "Cited and plausible, but the condition is missing: each recipient must be bound by written confidentiality obligations.",
      root_cause: `Cutting the NDA into equal-sized chunks split ${C.permittedDisclosure.section} mid-sentence. Its condition landed in the next chunk, which ranked too low to be retrieved.`,
      fix: "Cut chunks at clause boundaries, or let neighbouring chunks overlap a little, so a clause and its condition stay together.",
      cause_options: [
        { id: "a", text: "Fixed-size chunks cut §4.2(b) in half" },
        { id: "b", text: "The embedding model ignored the word \"provided\"" },
        { id: "c", text: "The question asked about the wrong section" },
      ],
      correct_cause: "a",
    },
    {
      id: "m01-f03",
      order_index: 3,
      title: "The amendment nobody indexed",
      category: "stale_index",
      user_query: RUNNING_QUESTION,
      retrieved_context: [{ source: `${cite(C.permittedDisclosure)} (indexed 2 March)`, text: C.permittedDisclosure.text, score: 0.88 }],
      bad_output: `"Yes, if the subcontractor is a Permitted Recipient bound by written confidentiality obligations." (${C.permittedDisclosure.section} ${C.permittedDisclosure.title})`,
      symptom: `Correctly grounded in the NDA as it was indexed, but out of date: Amendment No. 1 added ${C.contractors.section}.`,
      root_cause: `The index was built before Amendment No. 1, so ${C.contractors.section} ("${C.contractors.text}") was never retrieved.`,
      fix: "Rebuild the index whenever a contract or amendment is added, store the date each clause was indexed, and show that date in citations.",
      cause_options: [
        { id: "a", text: "The index predates Amendment No. 1" },
        { id: "b", text: "The writer misread the word \"contractor\"" },
        { id: "c", text: "Re-ranking pushed §4.5 out of the top 3" },
      ],
      correct_cause: "a",
    },
  ],
};

export default m01;
