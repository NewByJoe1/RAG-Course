import type { ModuleContent } from "../types";

const m01: ModuleContent = {
  id: "m01",
  slug: "rag-foundations",
  order_index: 1,
  title: "RAG Foundations",
  summary:
    "What retrieval-augmented generation is, the moving parts of a basic pipeline, and the ways it quietly goes wrong.",
  learning_objectives: [
    "Explain why a language model needs retrieval for private or changing knowledge",
    "Name each stage of a basic RAG pipeline and what it is responsible for",
    "Describe how embeddings and cosine similarity turn text search into vector search",
    "Write a grounded prompt that asks the model to cite its sources",
    "Diagnose a failure as a retrieval problem or a generation problem",
  ],
  estimated_minutes: 45,
  is_published: true,

  lesson_steps: [
    {
      id: "m01-s01",
      order_index: 1,
      kind: "concept",
      title: "The problem RAG solves",
      body_md: `A language model only knows what was in its training data. That knowledge is **frozen** at a cutoff date, **public** (it never saw your company wiki), and **unattributed** (it can't tell you where a fact came from).

Retrieval-augmented generation (RAG) works around all three. Instead of asking the model to remember, you:

1. **Retrieve** the passages most relevant to the question from a corpus you control.
2. **Augment** the prompt with those passages.
3. **Generate** an answer that is grounded in, and can cite, the retrieved text.

The model's job shifts from *recalling facts* to *reading and synthesising* the evidence you hand it. That is a task models are much better at.`,
    },
    {
      id: "m01-s02",
      order_index: 2,
      kind: "concept",
      title: "Anatomy of a pipeline",
      body_md: `Every RAG system, however elaborate, has two phases.

**Indexing (offline)**
- **Load** source documents (PDFs, HTML, tickets, code).
- **Chunk** them into passages small enough to retrieve precisely.
- **Embed** each chunk into a vector.
- **Store** vectors plus metadata (source, section, timestamp) in an index.

**Querying (online)**
- **Embed** the user's question with the same model.
- **Retrieve** the top-*k* nearest chunks.
- Optionally **rerank** them with a slower, more accurate model.
- **Generate** an answer from a prompt containing the question and chunks.

Most quality problems trace back to a specific stage. Keeping this map in your head is what lets you debug them later.`,
    },
    {
      id: "m01-s03",
      order_index: 3,
      kind: "concept",
      title: "Embeddings and similarity",
      body_md: `An **embedding model** maps text to a fixed-length vector so that texts with similar meaning land near each other.

To compare two vectors we usually use **cosine similarity**: the cosine of the angle between them, from -1 (opposite) to 1 (same direction). It ignores vector length, so a long passage and a short question can still score as similar.

Two consequences matter in practice:

- **Query and documents must use the same embedding model.** Vectors from different models live in different spaces and can't be compared.
- **Semantic ≠ lexical.** Embeddings catch paraphrases ("cancel my plan" ≈ "terminate subscription") but can miss exact identifiers such as error codes or SKUs. That is why many systems combine vector search with keyword search (hybrid retrieval).`,
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
      id: "m01-s04",
      order_index: 4,
      kind: "example",
      title: "A minimal RAG loop",
      body_md: `Here is the whole query path in a few lines. \`embed\` and \`generate\` stand in for whichever embedding and chat models you use; the shape is what matters.

Notice that the prompt **numbers each chunk** and asks for citations by number. That small choice makes answers checkable.`,
      code_snippet: `type Chunk = { id: string; source: string; text: string; vector: number[] };

async function answer(question: string, index: Chunk[], k = 4) {
  const q = await embed(question);

  const top = index
    .map((c) => ({ c, score: cosine(q, c.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  const context = top
    .map(({ c }, i) => \`[\${i + 1}] (\${c.source})\\n\${c.text}\`)
    .join("\\n\\n");

  return generate(\`Answer using only the sources below.
Cite sources like [1]. If the sources don't contain the answer, say so.

Sources:
\${context}

Question: \${question}\`);
}`,
      code_language: "typescript",
    },
    {
      id: "m01-s05",
      order_index: 5,
      kind: "exercise",
      title: "Choose a chunk size",
      body_md: `Take any long document you know well (an employee handbook, an API reference). Split it three ways:

- **Small:** ~150 tokens per chunk
- **Medium:** ~500 tokens per chunk
- **Large:** ~1,500 tokens per chunk

For each, write down five questions you'd expect users to ask and predict which chunk would be retrieved.

You should find that small chunks retrieve precisely but often cut an answer in half, and large chunks keep answers whole but dilute the embedding with unrelated text. Note where each one breaks; you'll measure this properly in the evaluation module.`,
    },
    {
      id: "m01-s06",
      order_index: 6,
      kind: "concept",
      title: "Grounding and citations",
      body_md: `Retrieval only helps if the model actually uses what you retrieved. A grounded prompt does three things:

1. **Restricts the source of truth.** "Answer using only the sources below."
2. **Makes claims traceable.** Number the sources and require inline citations.
3. **Gives the model an exit.** "If the sources don't contain the answer, say you don't know."

Without the third instruction, a model handed irrelevant chunks will often answer from memory anyway, and it will sound just as confident.`,
    },
    {
      id: "m01-s07",
      order_index: 7,
      kind: "reflection",
      title: "When not to use RAG",
      body_md: `RAG adds latency, infrastructure and new failure modes. Before reaching for it, ask:

- Does the knowledge fit in the context window outright? If so, just include it.
- Is the task about **behaviour or style** rather than facts? Prompting or fine-tuning may fit better.
- Is the data **structured**? A SQL query or API call often beats embedding table rows.

Write down one project where RAG is the right call and one where it isn't, and say why.`,
    },
  ],

  quiz_items: [
    {
      id: "m01-q01",
      lesson_step_id: "m01-s01",
      order_index: 1,
      kind: "single_choice",
      prompt: "Which limitation of a plain language model does RAG address most directly?",
      choices: [
        { id: "a", text: "It generates text too slowly" },
        { id: "b", text: "It can't access knowledge that wasn't in its training data" },
        { id: "c", text: "It can't follow multi-step instructions" },
        { id: "d", text: "It uses too many tokens per answer" },
      ],
      answer: { choice: "b" },
      explanation:
        "RAG supplies relevant, current or private text at query time, so the model can answer from evidence it never saw during training.",
      difficulty: 1,
    },
    {
      id: "m01-q02",
      lesson_step_id: "m01-s02",
      order_index: 2,
      kind: "multi_choice",
      prompt: "Which of these steps happen during indexing (offline), not at query time?",
      choices: [
        { id: "a", text: "Chunking documents" },
        { id: "b", text: "Embedding the user's question" },
        { id: "c", text: "Embedding document chunks" },
        { id: "d", text: "Reranking retrieved chunks" },
      ],
      answer: { choices: ["a", "c"] },
      explanation:
        "Chunking and embedding the corpus happen ahead of time. Embedding the question and reranking depend on the query, so they happen online.",
      difficulty: 1,
    },
    {
      id: "m01-q03",
      lesson_step_id: "m01-s03",
      order_index: 3,
      kind: "short_answer",
      prompt:
        "What similarity measure compares the angle between two embedding vectors and ignores their length?",
      answer: { accepted: ["cosine similarity", "cosine", "cosine distance"] },
      explanation: "Cosine similarity is the cosine of the angle between two vectors, ranging from -1 to 1.",
      difficulty: 1,
    },
    {
      id: "m01-q04",
      lesson_step_id: "m01-s03",
      order_index: 4,
      kind: "single_choice",
      prompt:
        "You re-embed your documents with a new embedding model but keep embedding queries with the old one. What happens?",
      choices: [
        { id: "a", text: "Retrieval improves because the new model is better" },
        { id: "b", text: "Nothing changes, since embeddings are interchangeable" },
        { id: "c", text: "Retrieval becomes close to random because the vectors live in different spaces" },
        { id: "d", text: "The vector database rejects the queries" },
      ],
      answer: { choice: "c" },
      explanation:
        "Similarity is only meaningful between vectors from the same model. Mixing models makes nearest-neighbour results meaningless, often with no error raised.",
      difficulty: 2,
    },
    {
      id: "m01-q05",
      lesson_step_id: "m01-s05",
      order_index: 5,
      kind: "single_choice",
      prompt: "What is the main risk of making chunks very small?",
      choices: [
        { id: "a", text: "The index uses too little storage" },
        { id: "b", text: "An answer gets split across chunks, so no single retrieved chunk contains it" },
        { id: "c", text: "Embeddings become less precise" },
        { id: "d", text: "The model refuses to answer" },
      ],
      answer: { choice: "b" },
      explanation:
        "Small chunks embed precisely but fragment context. Overlap between chunks, or retrieving neighbouring chunks, can help.",
      difficulty: 2,
    },
    {
      id: "m01-q06",
      lesson_step_id: "m01-s06",
      order_index: 6,
      kind: "multi_choice",
      prompt: "Which prompt instructions help keep an answer grounded in the retrieved sources?",
      choices: [
        { id: "a", text: "Answer using only the sources provided" },
        { id: "b", text: "Cite sources by number for each claim" },
        { id: "c", text: "Be as confident as possible" },
        { id: "d", text: "Say you don't know if the sources don't contain the answer" },
      ],
      answer: { choices: ["a", "b", "d"] },
      explanation:
        "Restricting sources, requiring citations and offering an explicit 'I don't know' exit all reduce ungrounded answers. Asking for confidence does the opposite.",
      difficulty: 2,
    },
    {
      id: "m01-q07",
      lesson_step_id: "m01-s07",
      order_index: 7,
      kind: "single_choice",
      prompt:
        "A user asks 'How many orders did we ship last week?' and the data lives in a Postgres table. What's the best approach?",
      choices: [
        { id: "a", text: "Embed every order row and retrieve the top 5" },
        { id: "b", text: "Fine-tune the model on the orders table" },
        { id: "c", text: "Have the model generate or call a SQL query against the table" },
        { id: "d", text: "Paste the whole table into the prompt" },
      ],
      answer: { choice: "c" },
      explanation:
        "Aggregations over structured data need exact computation. Vector retrieval returns similar rows, not counts.",
      difficulty: 3,
    },
  ],

  failure_cases: [
    {
      id: "m01-f01",
      order_index: 1,
      title: "The error code nobody could find",
      category: "retrieval_miss",
      user_query: "What does error E4021 mean?",
      retrieved_context: [
        { source: "troubleshooting.md#network", text: "Network errors usually indicate a timeout between the client and the gateway…", score: 0.71 },
        { source: "troubleshooting.md#auth", text: "Authentication failures occur when a token has expired…", score: 0.69 },
      ],
      bad_output: "E4021 is a network timeout error. Try increasing your client timeout. [1]",
      symptom: "Confident, cited, wrong answer. The page that defines E4021 exists but was never retrieved.",
      root_cause:
        "Pure vector search. The embedding of 'E4021' carries little meaning, so it matched generically 'error-ish' chunks rather than the exact code.",
      fix: "Add keyword (BM25) search alongside vector search and merge the results (hybrid retrieval). Exact identifiers then match lexically.",
    },
    {
      id: "m01-f02",
      order_index: 2,
      title: "Half a refund policy",
      category: "chunking",
      user_query: "Can I get a refund after 30 days?",
      retrieved_context: [
        { source: "policy.pdf p.4", text: "Refunds are available within 30 days of purchase for any reason.", score: 0.88 },
      ],
      bad_output: "No. Refunds are only available within 30 days of purchase. [1]",
      symptom: "Answer is supported by the cited chunk but contradicts the full policy.",
      root_cause:
        "Fixed-size chunking split the paragraph. The next sentence ('After 30 days, annual plans are refunded pro rata') landed in a separate chunk that scored lower and fell outside top-k.",
      fix: "Chunk on semantic boundaries (paragraphs or headings) with overlap, or retrieve neighbouring chunks alongside each hit.",
    },
    {
      id: "m01-f03",
      order_index: 3,
      title: "Last quarter's pricing",
      category: "stale_index",
      user_query: "How much is the Pro plan?",
      retrieved_context: [
        { source: "pricing.html (indexed 2026-03-02)", text: "Pro: $29/month, billed annually.", score: 0.93 },
      ],
      bad_output: "The Pro plan costs $29/month, billed annually. [1]",
      symptom: "Correctly grounded, correctly cited, and out of date. Pricing changed in July.",
      root_cause:
        "The index was built once and never refreshed. Retrieval and generation both worked; the corpus was wrong.",
      fix: "Re-index on a schedule or on change events, store an indexed_at timestamp per chunk, and surface it in citations so staleness is visible.",
    },
  ],
};

export default m01;
