import type { PipelineStageId } from "./pipeline";

// One shared glossary: the single source for lesson tooltips, each module's
// glossary list and /glossary. Written for someone completely new: plain
// words, one or two short sentences.
//
// aliases: the forms the term takes in lesson text. All-caps acronyms match
// case-sensitively ("NDA"); everything else ignores case. pattern: a regular
// expression used instead of the aliases (the § in "§4.2(b)").
//
// Course-wide rule: no term or acronym is left unexplained. Spell an acronym
// out on first use, and give every term a beginner meets an entry here
// (tests/unit/glossary-coverage.test.ts enforces both for lesson-format modules).
export type GlossaryTerm = {
  id: string;
  term: string;
  aliases: string[];
  pattern?: string;
  definition: string;
  stage: PipelineStageId | null;
};

export const GLOSSARY: GlossaryTerm[] = [
  // --- Contract words -------------------------------------------------------
  {
    id: "nda",
    term: "NDA (non-disclosure agreement)",
    aliases: ["NDA", "NDAs", "non-disclosure agreement"],
    definition: "A contract where two companies promise to keep each other's secrets. Ours is between Acme Corp and Beta Ltd.",
    stage: null,
  },
  {
    id: "clause",
    term: "Clause",
    aliases: ["clause", "clauses"],
    definition: "One numbered rule inside a contract, like §4.2(b).",
    stage: null,
  },
  {
    id: "section-sign",
    term: "§ (section sign)",
    aliases: ["§"],
    pattern: "§\\d+(?:\\.\\d+)*(?:\\([a-z]\\))?",
    definition: "The symbol lawyers use for \"section\". §4.2(b) means section 4.2, part (b).",
    stage: null,
  },
  {
    id: "confidential-information",
    term: "Confidential Information",
    aliases: ["Confidential Information"],
    definition: "The secrets an NDA protects: anything private that one company shares with the other.",
    stage: null,
  },
  {
    id: "third-party",
    term: "Third party",
    aliases: ["third party", "third parties"],
    definition: "Anyone who isn't one of the two companies that signed the contract.",
    stage: null,
  },
  {
    id: "permitted-recipient",
    term: "Permitted Recipient",
    aliases: ["Permitted Recipient", "Permitted Recipients"],
    definition: "In our NDA (§1.4): an employee, officer or adviser who needs to know the secret and has promised in writing to keep it.",
    stage: null,
  },
  {
    id: "subcontractor",
    term: "Subcontractor",
    aliases: ["subcontractor", "subcontractors"],
    definition: "An outside company hired to do part of the work. Our NDA never uses this word, which is the whole puzzle.",
    stage: null,
  },
  {
    id: "disclosing-party",
    term: "Disclosing Party",
    aliases: ["Disclosing Party"],
    definition: "The company sharing its secret.",
    stage: null,
  },
  {
    id: "receiving-party",
    term: "Receiving Party",
    aliases: ["Receiving Party"],
    definition: "The company being trusted with the other's secret.",
    stage: null,
  },
  {
    id: "affiliate",
    term: "Affiliate",
    aliases: ["Affiliates", "Affiliate"],
    definition: "A company in the same corporate family, like a parent company or a sister company.",
    stage: null,
  },
  {
    id: "amendment",
    term: "Amendment",
    aliases: ["amendment"],
    definition: "A later, signed change to a contract that adds or replaces some of its rules.",
    stage: null,
  },
  {
    id: "notwithstanding",
    term: "Notwithstanding",
    aliases: ["Notwithstanding"],
    definition: "Lawyer-speak for \"despite\". \"Notwithstanding Section 4.2\" means \"whatever Section 4.2 says\".",
    stage: null,
  },
  // --- RAG words ------------------------------------------------------------
  {
    id: "rag",
    term: "RAG (retrieval-augmented generation)",
    aliases: ["RAG", "retrieval-augmented generation"],
    definition: "First find the relevant parts of your own documents, then have a language model answer from them.",
    stage: null,
  },
  {
    id: "language-model",
    term: "Language model",
    aliases: ["language model", "language models"],
    definition: "A computer program trained on huge amounts of text that writes text in reply to what you give it. Chatbots run on one.",
    stage: "generation",
  },
  {
    id: "prompt",
    term: "Prompt",
    aliases: ["prompt", "prompts"],
    definition: "Everything you send to a language model: your instructions plus any text you want it to read.",
    stage: "generation",
  },
  {
    id: "prompt-file",
    term: "Prompt file",
    aliases: ["prompts/generate.md", "prompts/rewrite.md"],
    definition: "A plain text file that holds a prompt, so you can reuse and improve it. The .md ending just means simple text with light formatting.",
    stage: "generation",
  },
  {
    id: "pdf",
    term: "PDF (Portable Document Format)",
    aliases: ["PDF"],
    definition: "The usual file type for documents like contracts. It looks the same on every screen.",
    stage: null,
  },
  {
    id: "database",
    term: "Database",
    aliases: ["database"],
    definition: "A program that stores records in neat tables, so you can count and look them up exactly.",
    stage: null,
  },
  {
    id: "token",
    term: "Token",
    aliases: ["token", "tokens"],
    definition: "The small pieces a language model splits text into. A token is roughly three-quarters of a word.",
    stage: null,
  },
  {
    id: "function",
    term: "Function",
    aliases: ["function", "functions"],
    definition: "A named piece of code that does one job, like retrieve(). You call it and it hands back a result.",
    stage: null,
  },
  {
    id: "branch",
    term: "Branch",
    aliases: ["branch"],
    definition: "A named copy of your project's code. Each module saves its version on its own branch, so earlier work stays safe.",
    stage: null,
  },
  {
    id: "index",
    term: "Index",
    aliases: ["index", "indexed"],
    definition: "The searchable store of your document's pieces, built once before anyone asks a question.",
    stage: "hybrid-retrieval",
  },
  {
    id: "chunk",
    term: "Chunk",
    aliases: ["chunk", "chunks"],
    definition: "One piece of a document kept in the index. For a contract, ideally one clause.",
    stage: "hybrid-retrieval",
  },
  {
    id: "embedding",
    term: "Embedding",
    aliases: ["embedding", "embeddings", "embedding model", "embed"],
    definition: "A list of numbers that stands for a piece of text's meaning. Texts that mean similar things get similar numbers.",
    stage: "hybrid-retrieval",
  },
  {
    id: "vector",
    term: "Vector",
    aliases: ["vector", "vectors"],
    definition: "Another name for a list of numbers, like an embedding.",
    stage: "hybrid-retrieval",
  },
  {
    id: "cosine-similarity",
    term: "Cosine similarity",
    aliases: ["cosine similarity"],
    definition: "A score from -1 to 1 for how close two embeddings are. Higher means closer in meaning.",
    stage: "hybrid-retrieval",
  },
  {
    id: "top-k",
    term: "Top-k",
    aliases: ["top-k"],
    definition: "The k best-scoring results a search keeps, for example the top 3.",
    stage: "hybrid-retrieval",
  },
  {
    id: "grounding",
    term: "Grounding",
    aliases: ["grounding", "grounded"],
    definition: "Making the model answer only from the clauses it was given, so every claim can be checked.",
    stage: "generation",
  },
  {
    id: "citation",
    term: "Citation",
    aliases: ["citation", "citations"],
    definition: "A pointer from a claim in the answer to the clause it came from, like (§4.2(b) Permitted Disclosure).",
    stage: "generation",
  },
  {
    id: "retrieval-miss",
    term: "Retrieval miss",
    aliases: ["retrieval miss"],
    definition: "The clause that answers the question exists, but it never reached the model, so even a perfect writer gets it wrong.",
    stage: "hybrid-retrieval",
  },
  // --- Words from the pipeline overview -------------------------------------
  {
    id: "synonym-table",
    term: "Synonym table",
    aliases: ["synonym table"],
    definition: "A short list pairing everyday words with the contract's words, like subcontractor → third party.",
    stage: "pre-retrieval",
  },
  {
    id: "settings-file",
    term: "Settings file",
    aliases: ["config/models.yaml"],
    definition: "A plain text file of settings, here saying which model answers which kind of question. The .yaml ending is just a simple list format.",
    stage: "routing",
  },
  {
    id: "keyword-search",
    term: "Keyword search",
    aliases: ["keyword search"],
    definition: "Searching for exact words, like the index at the back of a book. It's good at exact references such as \"Section 4.2(b)\".",
    stage: "hybrid-retrieval",
  },
  {
    id: "bm25",
    term: "BM25 (Best Matching 25)",
    aliases: ["BM25"],
    definition: "The standard way to score keyword search. It favours clauses that contain the question's rarer words.",
    stage: "hybrid-retrieval",
  },
  {
    id: "reciprocal-rank-fusion",
    term: "Reciprocal rank fusion",
    aliases: ["reciprocal rank fusion"],
    definition: "A simple way to merge two ranked lists: clauses that rank well in both end up on top.",
    stage: "hybrid-retrieval",
  },
  {
    id: "re-rank",
    term: "Re-ranking",
    aliases: ["re-ranking", "re-rank", "re-ranker"],
    definition: "A second, more careful check of the clauses search found, to put the single best one first.",
    stage: "re-rank",
  },
  {
    id: "cross-encoder",
    term: "Cross-encoder",
    aliases: ["cross-encoder"],
    definition: "A slower, more careful model that reads the question and a clause together and scores how well they match.",
    stage: "re-rank",
  },
  {
    id: "eval",
    term: "Eval (evaluation)",
    aliases: ["eval", "evaluation"],
    definition: "Testing the system on questions with known answers, to measure how good it really is.",
    stage: "eval-guardrails",
  },
  {
    id: "guardrail",
    term: "Guardrail",
    aliases: ["guardrail", "guardrails"],
    definition: "An automatic check that blocks a bad answer before anyone sees it.",
    stage: "eval-guardrails",
  },
  {
    id: "golden-set",
    term: "Golden set",
    aliases: ["golden set"],
    definition: "A list of test questions with known right answers, used to check the system still works.",
    stage: "eval-guardrails",
  },
  {
    id: "kill-switch",
    term: "Kill switch",
    aliases: ["kill switch"],
    definition: "A setting that turns answering off completely, used when something goes wrong.",
    stage: "eval-guardrails",
  },
];

export const GLOSSARY_BY_ID: Record<string, GlossaryTerm> = Object.fromEntries(GLOSSARY.map((g) => [g.id, g]));

/** What the database stores (aliases live only here). */
export const glossaryRow = ({ id, term, definition, stage }: GlossaryTerm) => ({ id, term, definition, stage });
