// The course's reference spine: the RAG pipeline every lesson's "you are
// here" diagram shows. Labels are fixed. Each stage has a plain one-liner,
// what it does, why it's there and how it's done (markdown, explaining every
// file and tool for someone who has never seen one), plus what happens to the
// running example ("Can we share this with a subcontractor?") at that stage:
// once the whole pipeline is built (example), and as the course builds it up
// (exampleAt, keyed by the module from which each line holds).

export const PIPELINE_STAGE_IDS = [
  "pre-retrieval",
  "routing",
  "hybrid-retrieval",
  "post-retrieval",
  "re-rank",
  "generation",
  "eval-guardrails",
] as const;
export type PipelineStageId = (typeof PIPELINE_STAGE_IDS)[number];

export type PipelineStage = {
  id: PipelineStageId;
  number: string; // "1", "1b", …
  label: string; // exact label, e.g. "pre-retrieval"
  plain: string; // one plain-language line
  does: string;
  why: string;
  how: string; // markdown
  example: string; // the running example in the finished pipeline
  exampleAt: Record<string, string>; // the running example from module X onwards
  coveredIn: string; // the module that teaches it in depth
  modules: string[]; // every module that works on it, in order
};

export const PIPELINE: PipelineStage[] = [
  {
    id: "pre-retrieval",
    number: "1",
    label: "pre-retrieval",
    plain: "Translate the question into the contract's own words before searching.",
    does: "Rewrites the question in the contract's language, adds words that mean the same thing, and narrows the search to the right kind of document (only NDAs, for example).",
    why: "Our NDA never says \"subcontractor\". It says \"third party\" and \"Permitted Recipient\". Search with the user's words and the right clause can be missed, which is exactly what happens in Module 1.",
    how: `- **A rewrite prompt**, kept in a file called \`prompts/rewrite.md\`. It's a plain text file of instructions for the language model, such as "Rewrite this question using the words a contract would use." Your code reads the file and sends it to the model along with the question. Keeping it in a file means you can improve the wording without touching the code.
- **A synonym table.** A short two-column list you write yourself: an everyday word on the left, the contract's word on the right (subcontractor → third party). Before searching, the system adds the right-hand words to the question.
- **Filters.** Each clause is stored with labels, such as which kind of document it came from, so the search can skip everything that isn't an NDA.`,
    example: "\"Can we share this with a subcontractor?\" is also searched as \"Is disclosure of Confidential Information to a third party, Permitted Recipient or contractor permitted?\", with \"Permitted Recipient\" spelled out as employees, officers and professional advisers.",
    exampleAt: {
      m02: "\"Can we share this with a subcontractor?\" is also searched as \"Is disclosure of Confidential Information to a third party, Permitted Recipient or contractor permitted?\"",
      m10: "The rewrite also spells out the defined term: \"Permitted Recipient\" becomes \"employee, officer or professional adviser\", which shows a subcontractor isn't one.",
    },
    coveredIn: "m02",
    modules: ["m02", "m10"],
  },
  {
    id: "routing",
    number: "1b",
    label: "routing",
    plain: "Label how hard the question is, so the right model answers it.",
    does: "Tags each question as simple, multi-clause (it needs several clauses read together) or conflicting (the clauses seem to disagree). Later, that tag decides which language model writes the answer.",
    why: "Easy questions don't need the biggest, most expensive model. Hard ones do, because a wrong legal answer costs far more than the model. When unsure, it picks the stronger one.",
    how: `- **A tagging prompt**, \`prompts/tag.md\`. Another plain text file of instructions, this one asking the model: "Is this question simple, multi-clause or conflicting? Reply with one word." The same small model that rewrites the question answers it.
- **A settings file**, \`config/models.yaml\`. A plain text list saying which model handles each tag, for example "simple: the small model, multi-clause: the main model". To change the choice you edit this file, not the code.
- The tag is saved with every question, so later you can check whether hard questions score worse.`,
    example: "§4.5 says \"Notwithstanding Section 4.2\", so the subcontractor question is tagged conflicting and goes to the strongest model.",
    exampleAt: {
      m02: "The subcontractor question needs §1.4 and §4.2(b) read together, so it's tagged multi-clause and goes to the main model.",
      m10: "Once §4.5 is in view, \"Notwithstanding Section 4.2\" makes it conflicting, so it goes to the strongest model.",
    },
    coveredIn: "m02",
    modules: ["m02"],
  },
  {
    id: "hybrid-retrieval",
    number: "2",
    label: "hybrid retrieval",
    plain: "Search the contract for the clauses most likely to answer the question.",
    does: "Runs two searches at once, one by meaning and one by exact words, merges the two result lists, and passes about 40 candidate clauses on.",
    why: "Meaning search finds \"Permitted Recipient\" when you ask about a \"subcontractor\". Keyword search finds exact references like \"Section 4.2(b)\". People ask both kinds of question, so you need both.",
    how: `- **Meaning search** compares the question's embedding with every clause's embedding using cosine similarity, and keeps the closest. Module 1 builds only this half.
- **Keyword search** looks for the question's exact words, like the index at the back of a book. The usual scoring method is BM25 (Best Matching 25), which favours clauses containing the question's rarer words.
- **Merging** uses reciprocal rank fusion: each clause gets points for how high it ranks in each list, 1 ÷ (60 + its rank), and the points are added up. Clauses that rank well in both lists come out on top.
- All of this sits behind one function in your code, \`retrieve()\`, so the rest of the pipeline simply asks it for clauses.`,
    example: "§4.5 and §4.2(b) both come back among the candidates, next to look-alikes such as §1.1 Definitions.",
    exampleAt: {
      m01: "Meaning search only. §4.2(b) ranks 5th, and keeping the top 3 cuts it.",
      m02: "With the rewritten question, §4.2(b) climbs to 2nd and §1.4 to 3rd, behind §1.1 Definitions. §4.5 is still 9th.",
      m03: "Keyword search spots \"contractors\" in §4.5. Merged with meaning search, §4.5 comes back 7th of about 40 candidates.",
      m11: "The legal embedding model puts §4.5 and §4.2(b) in the top 5 by meaning alone, and finds the same rule in NDAs that say \"service providers\".",
    },
    coveredIn: "m03",
    modules: ["m01", "m03", "m11"],
  },
  {
    id: "post-retrieval",
    number: "3",
    label: "post-retrieval",
    plain: "Tidy up the clauses search found before the model reads them.",
    does: "Removes near-duplicates, drops weak matches and trims each clause to the sentences that matter, leaving about 10.",
    why: "Duplicates and filler, like the signature block, crowd out the right clause. More text isn't better: the model reads less carefully, and every extra word costs money.",
    how: `One cleaning step in your code, \`clean()\`, does three things in order:
- **Remove duplicates.** If two clauses are almost identical (cosine similarity above 0.95), keep one.
- **Drop weak matches.** Plot the search scores and cut where they suddenly fall.
- **Trim.** Keep only the sentences that relate to the question, cutting at full stops so no sentence is broken.`,
    example: "Three overlapping copies of §4.2(b) become one, and the signature block is dropped.",
    exampleAt: {
      m04: "About 40 candidates become 10: three overlapping copies of §4.2(b) become one, the signature block goes, and §4.5 survives in 6th place.",
    },
    coveredIn: "m04",
    modules: ["m04"],
  },
  {
    id: "re-rank",
    number: "4",
    label: "re-rank",
    plain: "Put the single best clause first.",
    does: "Reads the question and each remaining clause together, scores how well they match, and passes the top 3 to 5 on.",
    why: "The model pays most attention to what it reads first. If the right clause is second, the answer can lean on the wrong one.",
    how: `- **A cross-encoder** does the scoring. It's a second, slower model that reads the question and one clause side by side and gives a match score. It's too slow to run on the whole contract, which is why it only re-checks the short list.
- You can download a ready-made one. Module 6 shows how to train it further on legal question-and-clause pairs.`,
    example: "§4.5 moves to first place and §4.2(b) to second, above §1.1 Definitions.",
    exampleAt: {
      m05: "§4.5 jumps from 6th to 1st, §4.2(b) is 2nd and §1.4 3rd. §1.1 Definitions drops out of the top 3.",
      m06: "Even asked in lawyer's words (\"May the Receiving Party disclose to a subcontractor?\"), the fine-tuned re-ranker keeps §4.5 first, where the ready-made one put §5 Compelled Disclosure.",
    },
    coveredIn: "m05",
    modules: ["m05", "m06"],
  },
  {
    id: "generation",
    number: "5",
    label: "generation",
    plain: "Write the answer, using only the clauses that were found.",
    does: "Answers from the clauses, cites a section for every claim, and says \"The contract does not address this\" when they don't answer.",
    why: "Citations let anyone check the answer against the NDA, and the honest way out stops the model making something up.",
    how: `- **A prompt file**, \`prompts/generate.md\`. A plain text file holding the instructions the model gets every time: answer only from the numbered clauses, cite each claim, and admit when the clauses don't answer. Your code fills in the clauses and the question, then sends it.
- **The model** that answers is picked by the routing tag, from the settings file.
- **The answer** comes back with its citations stored separately, so the next stage can check each one.`,
    example: "\"Not without the Disclosing Party's prior written consent (§4.5, Amendment No. 1). A subcontractor isn't a Permitted Recipient under §1.4, so §4.2(b) doesn't cover it.\"",
    exampleAt: {
      m01: "\"The contract does not address this.\" Grounded, cited, and wrong.",
      m02: "\"Yes, to Permitted Recipients bound by written confidentiality obligations (§4.2(b)).\" Closer, but it never saw §4.5.",
      m05: "\"Disclosure to contractors needs the Disclosing Party's prior written consent (§4.5). Under §4.2(b) you may also share with Permitted Recipients.\" The right clause, but a muddled second route.",
      m10: "\"Not without the Disclosing Party's prior written consent (§4.5, Amendment No. 1). A subcontractor isn't a Permitted Recipient under §1.4, so §4.2(b) doesn't cover it.\"",
    },
    coveredIn: "m01",
    modules: ["m01", "m10"],
  },
  {
    id: "eval-guardrails",
    number: "6",
    label: "eval & guardrails",
    plain: "Check the answers are right, and block bad ones before anyone sees them.",
    does: "Tests the system every night on a fixed set of questions with known answers, and alerts you when scores drop. Before a live answer is shown, it checks every quoted clause really exists, and refuses when a check fails.",
    why: "Systems get worse quietly. A confident wrong legal answer is worse than \"I can't answer that right now\".",
    how: `- **A golden set**, \`eval/golden.jsonl\`: a file of test questions, one per line, each with its correct answer and the clause that proves it.
- **A scoring program**, \`evaluate.py\`, runs every golden-set question through the pipeline and measures three things: did the right clause come back in the top 3, are the citations correct, and is every claim supported by the clauses.
- **A nightly job** runs that program on a schedule and sends an alert when a score falls.
- **Guardrails** check each live answer before it's shown: every quote must appear word for word in the contract, one customer can never see another's contracts, and a kill switch can turn answering off. If a check can't run, the answer is blocked rather than shown.`,
    example: "The subcontractor question is a golden-set row that runs on every change and every night, and its answer is only shown if its §4.5 quote appears word for word in the NDA.",
    exampleAt: {
      m07: "The subcontractor question becomes a golden-set row. It passes recall@3 (§4.5 is in the top 3) but fails the answer check: the answer still offers a second route under §4.2(b).",
      m08: "That row now runs on every change and every night. When an index rebuild knocked §4.5 out of the top 3, an alert went out the same night.",
      m09: "Before an answer is shown, its §4.5 quote is checked word for word against the NDA, and a made-up quote is blocked.",
    },
    coveredIn: "m07",
    modules: ["m07", "m08", "m09"],
  },
];

/**
 * The running example at this stage as of a module: the line from the latest
 * module at or before it, or null if the stage isn't built yet by then.
 */
export function exampleFor(stage: PipelineStage, moduleId: string): { from: string; text: string } | null {
  const at = moduleNumber(moduleId);
  const keys = Object.keys(stage.exampleAt)
    .filter((k) => moduleNumber(k) <= at)
    .sort((a, b) => moduleNumber(b) - moduleNumber(a));
  return keys.length ? { from: keys[0], text: stage.exampleAt[keys[0]] } : null;
}

export const stageById = (id: PipelineStageId) => PIPELINE.find((s) => s.id === id)!;
export const stageLabel = (id: PipelineStageId) => {
  const s = stageById(id);
  return `[${s.number}] ${s.label}`;
};
/** "m03" → 3 */
export const moduleNumber = (id: string) => Number(id.slice(1));
