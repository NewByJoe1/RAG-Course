import type { ModuleContent } from "../types";
import { cite, NDA_CLAUSES as C, RUNNING_QUESTION } from "../nda";

// Module 11, rewritten on the running example. Beta's legal team asks the
// subcontractor question across their other NDAs, which word the rule as
// "service providers" or "agents"; the general embedding model misses them and
// recall@3 on the golden set falls. The rescue: public legal datasets (CUAD,
// ContractNLI, ACORD), training pairs with hard negatives, a fine-tuned
// embedding model, a re-index, and the NDA subcontractor row of
// eval/golden.jsonl as the check. Every dataset example comes back to the
// subcontractor question; Beta's other NDAs are only described in passing.
//
// Quiz, step and failure ids are unchanged from the original Module 11, so
// existing attempts and review cards keep pointing at the same slots.

const FINAL_ANSWER = `Not without the Disclosing Party's prior written consent (${C.contractors.section}, Amendment No. 1). A subcontractor isn't a Permitted Recipient under ${C.permittedRecipient.section}, so ${C.permittedDisclosure.section} doesn't cover it.`;

// The NDA's row of the golden set (Module 7), used here to check the new model.
const GOLDEN_ROW = JSON.stringify({
  id: "nda-acme-beta-001",
  question: RUNNING_QUESTION,
  gold_clauses: [C.contractors.section, C.permittedDisclosure.section, C.permittedRecipient.section],
  answer: FINAL_ANSWER,
  tag: "conflicting",
});

const m11: ModuleContent = {
  id: "m11",
  slug: "legal-embeddings",
  order_index: 11,
  title: "Datasets and Fine-Tuning for Legal Citations",
  summary:
    "Beta's other NDAs word the subcontractor rule as \"service providers\" or \"agents\", and the general embedding model walks past them. Build training pairs with hard negatives from public legal datasets (CUAD, ContractNLI, ACORD), fine-tune the embedding model, re-index, and prove it on the golden set's subcontractor row.",
  hook: `Beta's legal team likes the new answer to "${RUNNING_QUESTION}" so much that they ask it of all their other non-disclosure agreements (NDAs). Those say "service providers" or "agents", not "contractors", and the general embedding model walks right past them. On the golden set, recall@3 falls.`,
  learning_objectives: [
    "Explain why a general embedding model misses the subcontractor rule when an NDA words it as \"service providers\" or \"agents\"",
    "Name three public legal datasets, CUAD (Contract Understanding Atticus Dataset), ContractNLI and ACORD (Atticus Clause Retrieval Dataset), and say what each is for",
    "Build training pairs with hard negatives, from synthetic questions that don't copy the clause's own words",
    "Fine-tune the embedding model, then re-index every NDA so old and new embeddings never mix",
    "Prove the new model works on the golden set's subcontractor row and on a held-out set, not just on its training examples",
  ],
  estimated_minutes: 90,
  is_published: true,
  pipeline_stages: ["hybrid-retrieval"],
  explain_back_prompt: `In your own words: why did the general embedding model walk past the rule in Beta's other NDAs that says "service providers", and how do training pairs with hard negatives teach it that this is the same kind of rule as ${C.contractors.section}?`,
  video: null,

  lesson_steps: [
    {
      id: "m11-s01",
      order_index: 1,
      kind: "warm_up",
      title: "Warm-up: what you already know",
      body_md: `Before we start, answer these from what you remember of Module 10. There are no wrong answers. You'll check yourself against the study guide at the end.

1. The assistant once answered "yes under §4.2(b)… but contractors need consent under §4.5". Which word at the start of §4.5 settles which clause wins?
2. Why isn't a subcontractor a Permitted Recipient under our NDA?
3. Module 10 kept its legal know-how in a domain pack with four parts. Which part didn't it build yet?`,
    },
    {
      id: "m11-s02",
      order_index: 2,
      kind: "concept",
      title: "Same rule, different words",
      body_md: `Module 10 finally got the subcontractor question right on the Acme NDA. So Beta's legal team tries it on all their other NDAs, the ones they've signed with other partners over the years. Same question: **"${RUNNING_QUESTION}"**

Most of those NDAs have a rule just like ${C.contractors.section}. But they word it differently. One says no disclosure to **"service providers"** without consent. Another says **"agents"**. Same rule, different words. And the system walks right past them.

Why? Think back to the two halves of hybrid search from Module 3.

- **Keyword search** looks for exact words. None of those NDAs says "subcontractor" or "contractor", so it finds nothing.
- **The synonym table** from Module 2 could add "service provider" and "agent". But the next NDA says "vendor", and the one after that "outside consultant". You can't list every wording in every contract.
- **Meaning search** is left to do the job, and its embedding model learned what words mean from general web text. On the web, "service provider" is mostly about phone and internet companies, not about who may see a secret.

Even on the Acme NDA, meaning search on its own still ranks ${C.contractors.section} only 9th. Keyword search rescues it there, but not in NDAs that never say "contractor".

The golden set notices. Add rows from Beta's other NDAs, and **recall@3**, how often the right clause lands in the top 3, falls from 0.92 to 0.71.

:::key What Module 11 adds, and where
Module 11 works on one stage: **[2] hybrid retrieval**, and only its meaning-search half. It teaches the embedding model legal language by **fine-tuning** it: training it a little more on thousands of legal examples. That's why the map's 📍 You are here marker sits on hybrid retrieval alone.

The answer to the subcontractor question stays Module 10's correct one. What changes is how the right clauses are found: by meaning alone, in the Acme NDA and in Beta's other NDAs that word the rule differently. One thing no embedding model fixes: whether a "service provider" in another NDA really counts as a contractor is still for the legal reading rules from Module 10 and, in the end, a lawyer. Module 12, the capstone, then checks all seven stages working together.
:::`,
    },
    {
      id: "m11-s03",
      order_index: 3,
      kind: "concept",
      title: "Where the examples come from",
      body_md: `To teach the model, you need examples: thousands of questions, each paired with the passage that answers it. In Module 6 you fine-tuned the re-ranker on about 230 pairs. The embedding model shapes every single search, so it needs far more. Writing them yourself would take a lawyer months.

Luckily, lawyers have already done that work and published it as **datasets**, free collections of labelled examples. Three matter here, and each one answers a question about our subcontractor problem.

- **CUAD (Contract Understanding Atticus Dataset)**: 510 real contracts in which lawyers highlighted about 13,000 passages and labelled each with one of 41 kinds of clause. It's the backbone of your training examples. Many of its passages limit who may receive what, worded in all sorts of ways. **Its question for us:** can the model learn that "service providers", "agents" and "contractors" can play the same role as in ${C.contractors.section}?
- **ContractNLI (Contract Natural Language Inference)**: 607 NDAs, each checked against 17 statements and labelled: the NDA says so, says the opposite, or doesn't say. One statement is, roughly, "the Receiving Party may share some Confidential Information with third parties, such as consultants or agents". That's our question in another form. **Its question for us:** does the model still notice the words that flip a meaning, like the "no" and "without consent" in ${C.contractors.section}?
- **ACORD (Atticus Clause Retrieval Dataset)**: lawyers' search questions, each with clauses that experts rated for how well they answer. You never train on it. It's a **benchmark**, a public test everyone scores themselves on. **Its question for us:** will the model work on contracts it has never seen, like Beta's other NDAs?

:::more Getting the data
- Each dataset is a free download. The data-prep notebook (a file of code you run one block at a time, with notes in between) saves them into two folders, \`data/cuad/\` and \`data/contractnli/\`.
- Read each dataset's licence before you use it. It says what you may and may not do with the data.
- Keep ACORD in its own folder and never let it near the training code. A test you've trained on proves nothing.
:::`,
    },
    {
      id: "m11-s04",
      order_index: 4,
      kind: "concept",
      title: "Teaching the model with hard negatives",
      body_md: `Here's how the training works. You show the model a question, the passage that answers it, and a passage that doesn't. Then you nudge its numbers so the question's embedding moves closer to the right passage and further from the wrong one. Repeat that thousands of times. This is called **contrastive fine-tuning**: the model learns by contrast.

The trick is in picking the wrong passage. Picture it on our NDA:

- **An easy negative:** ${C.governingLaw.section} ${C.governingLaw.title}, "${C.governingLaw.text}" The model already knows that has nothing to do with subcontractors. It teaches nothing.
- **A hard negative:** ${C.compelledDisclosure.section} ${C.compelledDisclosure.title}. It says "disclose" and "Confidential Information", just like the right clause, but it's about courts and the law, not subcontractors. That's exactly where the model gets confused, so that's where it learns.

**Hard negatives are the whole trick.** In training, the examples come from CUAD, not from our NDA. The subcontractor question is in your golden set, and you never train on your own test.

**Building the training pairs, in three steps**

1. **Write questions.** A large language model (LLM) reads CUAD passages and writes about 2,000 questions, the way a non-lawyer would ask them, like "Can we hand these files to an outside firm?" These are **synthetic questions**: made up by a model, not asked by real people. Throw out any question that copies a long phrase from its passage.
2. **Find hard negatives.** For each question, search with the current model and take the top 5 passages that aren't the answer. Check none of them actually answers the question too, and have a lawyer spot-check a sample.
3. **Train.** Start from a small, free embedding model such as bge-small, and train it for three passes over the pairs. Save the result in \`models/embedder-v2/\`.

The pairs live in \`train/pairs.jsonl\`, a plain text file with one training example per line: the question, the right passage and a hard negative.`,
      code_snippet: `import json
from sentence_transformers import SentenceTransformer, InputExample, losses
from torch.utils.data import DataLoader

# Start from a small, general embedding model.
model = SentenceTransformer("BAAI/bge-small-en-v1.5")

# One line per example: question, right passage, hard negative.
rows = [json.loads(line) for line in open("train/pairs.jsonl")]
examples = [InputExample(texts=[r["question"], r["positive"], r["hard_negative"]]) for r in rows]

loader = DataLoader(examples, shuffle=True, batch_size=32)
# Pull each question towards its passage, push it away from the others.
loss = losses.MultipleNegativesRankingLoss(model)
model.fit(train_objectives=[(loader, loss)], epochs=3, warmup_steps=100)

model.save("models/embedder-v2")`,
      code_language: "python",
    },
    {
      id: "m11-s05",
      order_index: 5,
      kind: "concept",
      title: "Re-index, then check the subcontractor row",
      body_md: `Training changed the numbers the model gives to every piece of text. Every vector in your index still comes from the old model, and numbers from two different models can't be compared. That's the first rule from Module 1. So before anything else, you **re-index**: embed every clause of every NDA again with the new model, and build a fresh index.

Then you switch over in \`config/models.yaml\`, your settings file, which says which embedding model the system uses. The question and the index must always use the same one.

**Now test it, three ways**

- **The golden set.** \`eval/golden.jsonl\` is the plain text file of test questions from Module 7, one per line, each with the clauses that answer it and the right answer. The subcontractor question is one of its rows. You run \`evaluate.py\`, the program from Module 7 that scores every row, with meaning search alone, so you see what the new model does by itself.
- **ACORD**, the held-out test. If the score rises here too, the model learned legal language, not just CUAD.
- **ContractNLI**, to make sure the model still notices "no" and "without consent".

Here's what comes back. On the Acme NDA, by meaning alone, ${C.contractors.section} climbs from 9th to 3rd, with ${C.permittedDisclosure.section} 1st. In Beta's other NDAs, the rule that says "service providers" now lands in the top 3. Recall@3 on the golden set climbs back from 0.71 to 0.90. ACORD rises too, and ContractNLI is no worse.

Only when your golden set and ACORD **both** improve do you switch the setting for good. The full answer, after every stage, stays Module 10's correct one:

> "${FINAL_ANSWER}"`,
      code_snippet: `# eval/golden.jsonl: one test question per line. This is the NDA's row.
${GOLDEN_ROW}

# Re-index every NDA with the new model, then score meaning search alone.
$ python reindex.py --model models/embedder-v2
$ python evaluate.py --golden eval/golden.jsonl --retrieval meaning-only

nda-acme-beta-001  ${C.contractors.section} rank 3 (was 9)  ${C.permittedDisclosure.section} rank 1  recall@3: pass`,
      code_language: "text",
    },
    {
      id: "m11-s06",
      order_index: 6,
      kind: "exercise",
      title: "Hands-on: try it yourself",
      body_md: `**Predict first:** by meaning alone, ${C.contractors.section} ranks 9th for "${RUNNING_QUESTION}". After fine-tuning on legal text, where do you think it will land? Write your guess down before you start.

- **Guided:** Run the data-prep notebook. It downloads CUAD and ContractNLI and builds the training pairs. Open 10 hard negatives and say, for each one, why it's hard, the way ${C.compelledDisclosure.section} ${C.compelledDisclosure.title} is hard for the subcontractor question.
- **Partial:** Change how hard negatives are picked: at random, the top 5 from search, or passages of the same kind of clause. Train once with each, and compare where ${C.contractors.section} lands for the subcontractor row and what recall@3 the golden set gets.
- **Solo:** Fine-tune on CUAD only, then test on ACORD and on your golden set. Write 200 words on what carried over to Beta's NDAs and what didn't.

**Files you create:** \`data/cuad/\` and \`data/contractnli/\`, the folders holding the downloaded datasets; an updated \`train/pairs.jsonl\`, your training examples, one per line; and \`models/embedder-v2/\`, the folder holding your new legal embedding model.

**Capstone branch:** save this work on a branch called \`legal-embeddings\` in your course project. Put the new model behind a setting in \`config/models.yaml\` that picks the old or the new one, and save the results of both tests.

**Check it with your assistant:** ask your coding assistant, "Does my legal-embeddings branch build train/pairs.jsonl from CUAD and ContractNLI with hard negatives, keep the golden set and ACORD out of training, re-index after training, and check the subcontractor row of eval/golden.jsonl with the new model?"`,
    },
    {
      id: "m11-s07",
      order_index: 7,
      kind: "concept",
      title: "When it isn't worth it",
      body_md: `Fine-tuning the embedding model is the biggest fix in the course. So it's worth knowing when not to reach for it.

- **For one NDA, it wasn't needed.** On the Acme NDA, the synonym table and keyword search from Modules 2 and 3 already found ${C.contractors.section}, at almost no cost. Fine-tune when many contracts word the same rule in many ways, and your golden set shows the misses keep happening, not just once.
- **It isn't a one-off cost.** Every new model means re-indexing every NDA and re-running the whole golden set. And contracts change. Retrain when the golden set says the model has fallen behind, not on a whim.
- **It finds, it doesn't judge.** The new model can bring back a rule about "service providers". Whether that rule covers a subcontractor in that NDA is still for the legal reading rules from Module 10, and in the end, a lawyer.`,
    },
  ],

  worked_example: [
    {
      id: "m11-w01",
      order_index: 1,
      title: "The question, across Beta's NDAs",
      body_md: `Beta's legal team asks the same question of every NDA they've signed, not just the Acme one. The rule they're after is the one in ${C.contractors.section}, but each NDA words it its own way.`,
      stage: null,
      query_state: `"${RUNNING_QUESTION}", asked of the Acme NDA and Beta's other NDAs.`,
    },
    {
      id: "m11-w02",
      order_index: 2,
      title: "The general model's ranking",
      body_md: `Meaning search alone, with the general embedding model, on the Acme NDA:

1. ${C.definitions.section} ${C.definitions.title}: 0.81
2. ${C.compelledDisclosure.section} ${C.compelledDisclosure.title}: 0.78
3. ${C.permittedDisclosure.section} ${C.permittedDisclosure.title}: 0.76

…and ${C.contractors.section} comes 9th. In Beta's other NDAs, the rule that says "service providers" isn't even in the top 10, and keyword search can't help because the word "contractor" isn't there.`,
      stage: "hybrid-retrieval",
      query_state: `By meaning alone, ${C.contractors.section} is 9th; the "service providers" rule elsewhere is missed. Recall@3 on the golden set: 0.71.`,
    },
    {
      id: "m11-w03",
      order_index: 3,
      title: "Build training pairs",
      body_md: `From CUAD, a large language model writes about 2,000 questions like the subcontractor one, in plain words. For each, the right passage is the one lawyers highlighted, and the hard negative is a near-miss that search confused it with. The subcontractor question itself stays out: it's a golden-set row, and you never train on your test.`,
      code_snippet: `# train/pairs.jsonl (one example per line; the passages come from CUAD)
{"question": "Can we hand these files to an outside firm?",
 "positive": "<CUAD passage limiting disclosure to outside parties>",
 "hard_negative": "<CUAD passage about disclosure ordered by a court>"}`,
      code_language: "text",
      stage: null,
      query_state: "About 2,000 training pairs, each with a hard negative. The subcontractor row is kept out.",
    },
    {
      id: "m11-w04",
      order_index: 4,
      title: "Fine-tune and re-index",
      body_md: `The small embedding model trains for three passes over the pairs and is saved as \`models/embedder-v2/\`. Then every clause of every NDA, including ${C.contractors.section}, is embedded again with the new model, and \`config/models.yaml\` is switched to it, so the question and the index use the same model.`,
      code_snippet: `# config/models.yaml
embedding: models/embedder-v2   # was: bge-small (general)`,
      code_language: "yaml",
      stage: "hybrid-retrieval",
      query_state: "A fresh index, built entirely with the legal embedding model.",
    },
    {
      id: "m11-w05",
      order_index: 5,
      title: "Check the golden-set row",
      body_md: `The scoring program runs the NDA's row of the golden set with meaning search alone. The row lists the clauses that answer the subcontractor question, ${C.contractors.section}, ${C.permittedDisclosure.section} and ${C.permittedRecipient.section}, so it can tell exactly where each one landed.`,
      code_snippet: `# eval/golden.jsonl (the NDA's row)
${GOLDEN_ROW}`,
      code_language: "json",
      stage: "eval-guardrails",
      query_state: `Row passes: ${C.permittedDisclosure.section} 1st and ${C.contractors.section} 3rd by meaning alone.`,
    },
    {
      id: "m11-w06",
      order_index: 6,
      title: "The new ranking",
      body_md: `Meaning search alone, with the legal embedding model, on the Acme NDA:

1. ${C.permittedDisclosure.section} ${C.permittedDisclosure.title}: 0.84
2. ${C.permittedRecipient.section} ${C.permittedRecipient.title}: 0.80
3. ${C.contractors.section} ${C.contractors.title}: 0.79
4. ${C.definitions.section} ${C.definitions.title}: 0.71
5. ${C.compelledDisclosure.section} ${C.compelledDisclosure.title}: 0.69

In Beta's other NDAs, the "service providers" rule now comes back in the top 3. Recall@3 on the golden set is back to 0.90. After every later stage, the answer is still Module 10's: not without the Disclosing Party's prior written consent.`,
      stage: "hybrid-retrieval",
      query_state: `${C.permittedDisclosure.section} 1st and ${C.contractors.section} 3rd by meaning alone; the same rule found in NDAs that say "service providers".`,
    },
  ],

  // Every term a learner meets in this module (tests/unit/glossary-coverage.test.ts
  // checks none is missing): contract words first, then the rest.
  glossary: [
    "nda", "clause", "section-sign", "subcontractor", "third-party", "permitted-recipient", "confidential-information",
    "disclosing-party", "receiving-party", "affiliate", "amendment", "written-consent",
    "embedding", "vector", "index", "re-index", "hybrid-search", "keyword-search", "synonym-table", "re-rank",
    "fine-tuning", "contrastive-fine-tuning", "base-model", "dataset", "cuad", "contractnli", "acord", "benchmark",
    "training-pair", "hard-negative", "synthetic-question", "held-out-set", "language-model", "llm", "prompt",
    "golden-set", "recall-at-3", "eval-script", "settings-file", "domain-pack", "notebook", "branch",
  ],

  study_guide: [
    {
      id: "m11-p01",
      order_index: 1,
      point: "A general embedding model learned meaning from web text, so it misses the subcontractor rule when an NDA words it as \"service providers\" or \"agents\".",
      narration: `Watch the subcontractor question go out to Beta's other NDAs. Keyword search finds no "contractor". The synonym table can't list every wording. And meaning search, trained on the web, thinks a service provider is a phone company. See recall@3 on the golden set fall from 0.92 to 0.71.`,
    },
    {
      id: "m11-p02",
      order_index: 2,
      point: "Three public datasets: CUAD to train on, ContractNLI to check the model still notices words like \"no\" and \"without consent\", and ACORD as the held-out test.",
      narration: `See three datasets lawyers built. CUAD's highlighted passages become the training examples. ContractNLI's NDAs check that "no disclosure without consent", the heart of §4.5, still reads as a no. And ACORD stays locked away until the end, to test the model on contracts it never saw.`,
    },
    {
      id: "m11-p03",
      order_index: 3,
      point: "Contrastive fine-tuning pulls a question towards its right passage and away from a wrong one. Hard negatives, wrong passages that look right, are the whole trick.",
      narration: `Watch the question's arrow move towards the right passage and away from the wrong one. With an easy negative like §9 Governing Law, it barely has to move. With a hard negative like §5 Compelled Disclosure, which also says "disclose", it has to learn the real difference.`,
    },
    {
      id: "m11-p04",
      order_index: 4,
      point: "Synthetic questions must be written in plain words, not copied from the passage, and every hard negative must be checked so a right answer is never marked wrong.",
      narration: `See a model write questions from CUAD passages, the way someone at Beta would ask them. Watch one that copies the passage's own words get thrown out. Then see a mined negative that actually answers the question get caught, before training could push a right answer away.`,
    },
    {
      id: "m11-p05",
      order_index: 5,
      point: "After training, re-index every NDA with the new model and switch config/models.yaml. Old and new embeddings must never mix.",
      narration: `Watch every clause of every NDA, §4.5 included, get embedded again with the new model. See the settings file switch over, so the question and the index speak the same language of numbers. Mix the two, and search quietly turns into guessing.`,
    },
    {
      id: "m11-p06",
      order_index: 6,
      point: "The golden set's subcontractor row and ACORD must both improve before you switch. By meaning alone, §4.5 climbs from 9th to 3rd, and the \"service providers\" rule is found too.",
      narration: `See the subcontractor row of the golden set run against the new model: §4.2(b) first, §4.5 third, where it used to be ninth. Watch ACORD rise as well, and the "service providers" rule in Beta's other NDAs come back in the top 3. Only then does the switch flip for good.`,
    },
  ],

  quiz_items: [
    {
      id: "m11-q01",
      lesson_step_id: "m11-s02",
      order_index: 1,
      kind: "single_choice",
      prompt: "Why does the general embedding model miss the rule in Beta's other NDAs that says \"service providers\" instead of \"contractors\"?",
      choices: [
        { id: "a", text: "Those NDAs were never indexed" },
        { id: "b", text: "It learned meaning from general web text, where \"service provider\" isn't about who may see a secret" },
        { id: "c", text: "Embedding models can't handle words with two parts" },
        { id: "d", text: "The re-ranker removed those clauses" },
      ],
      answer: { choice: "b" },
      explanation: "The model only knows the meanings it saw in training. Legal examples teach it that a service provider can play the same role as a contractor.",
      difficulty: 1,
    },
    {
      id: "m11-q02",
      lesson_step_id: "m11-s03",
      order_index: 2,
      kind: "single_choice",
      prompt: "Which dataset is the held-out test that shows the model learned legal language, not just its training examples?",
      choices: [
        { id: "a", text: "CUAD" },
        { id: "b", text: "ACORD" },
        { id: "c", text: "ContractNLI" },
        { id: "d", text: "The Acme NDA" },
      ],
      answer: { choice: "b" },
      explanation: "Training on CUAD and testing on ACORD shows the gain carries over to contracts the model never saw, like Beta's other NDAs.",
      difficulty: 2,
    },
    {
      id: "m11-q03",
      lesson_step_id: "m11-s03",
      order_index: 3,
      kind: "single_choice",
      prompt: "What do you use ContractNLI for in this module?",
      choices: [
        { id: "a", text: "Checking the model still notices words that flip meaning, like the \"no\" and \"without consent\" in §4.5" },
        { id: "b", text: "Writing the synthetic questions" },
        { id: "c", text: "Storing the new index" },
        { id: "d", text: "Training the re-ranker" },
      ],
      answer: { choice: "a" },
      explanation: "Its NDAs are labelled for whether they say something, say the opposite, or don't say it, which catches a model that stops noticing \"no\".",
      difficulty: 2,
    },
    {
      id: "m11-q04",
      lesson_step_id: "m11-s04",
      order_index: 4,
      kind: "short_answer",
      prompt: "For the subcontractor question, §5 Compelled Disclosure says \"disclose\" but is about courts. What do you call a wrong passage that looks this much like the right one, used in training?",
      answer: { accepted: ["hard negative", "hard negatives", "a hard negative"] },
      explanation: "Hard negatives are the near-misses the model confuses, so they're where it learns the most.",
      difficulty: 1,
    },
    {
      id: "m11-q05",
      lesson_step_id: "m11-s04",
      order_index: 5,
      kind: "single_choice",
      prompt: "Why must the subcontractor question never be used as a training pair?",
      choices: [
        { id: "a", text: "It's too short to train on" },
        { id: "b", text: "It doesn't come from CUAD's format" },
        { id: "c", text: "It's a golden-set row, and training on your own test makes the score meaningless" },
        { id: "d", text: "Training pairs can't contain the § sign" },
      ],
      answer: { choice: "c" },
      explanation: "If the model has seen the test question, a good score only shows it remembered, not that it learned.",
      difficulty: 2,
    },
    {
      id: "m11-q06",
      lesson_step_id: "m11-s05",
      order_index: 6,
      kind: "single_choice",
      prompt: "Why must you re-index every NDA after fine-tuning the embedding model?",
      choices: [
        { id: "a", text: "To free up disk space" },
        { id: "b", text: "Because training deletes the old index" },
        { id: "c", text: "It isn't needed: old vectors still work" },
        { id: "d", text: "So every stored vector comes from the new model, since vectors from two models can't be compared" },
      ],
      answer: { choice: "d" },
      explanation: "Mixing old and new vectors quietly breaks search, often with no error at all.",
      difficulty: 2,
    },
    {
      id: "m11-q07",
      lesson_step_id: "m11-s07",
      order_index: 7,
      kind: "single_choice",
      prompt: "You only ever work with the one Acme NDA, and §4.5 ranks low for the subcontractor question. What's the better fix?",
      choices: [
        { id: "a", text: "Add \"contractor\" to the synonym table and rely on keyword search, as in Modules 2 and 3" },
        { id: "b", text: "Fine-tune the embedding model on CUAD" },
        { id: "c", text: "Train on the golden set" },
        { id: "d", text: "Switch to a bigger language model" },
      ],
      answer: { choice: "a" },
      explanation: "For one contract, cheap fixes work. Fine-tuning pays off when many contracts word the same rule in many ways.",
      difficulty: 3,
    },
  ],

  failure_cases: [
    {
      id: "m11-f01",
      order_index: 1,
      title: "The negative that was actually right",
      category: "ranking",
      user_query: RUNNING_QUESTION,
      retrieved_context: [
        { source: cite(C.definitions), text: C.definitions.text, score: 0.8 },
        { source: cite(C.compelledDisclosure), text: C.compelledDisclosure.text, score: 0.77 },
        { source: cite(C.term), text: C.term.text, score: 0.7 },
      ],
      bad_output: `After training, meaning search ranks ${C.permittedDisclosure.section} 8th for the subcontractor question. The general model had it 3rd.`,
      symptom: "Training made a right clause rank worse.",
      root_cause: `For a CUAD question much like ours, a passage that also answered it sat in the top 5 and wasn't marked as an answer. It was used as a hard negative, so training pushed passages like ${C.permittedDisclosure.section} away from questions like this one.`,
      fix: "Check every mined hard negative against the labels, drop any that also answer the question, and have a lawyer spot-check a sample.",
      cause_options: [
        { id: "a", text: "Training pulled every question too close to §1.1 Definitions" },
        { id: "b", text: "A right answer was used as a hard negative" },
        { id: "c", text: "Too few passes over the training pairs" },
      ],
      correct_cause: "b",
    },
    {
      id: "m11-f02",
      order_index: 2,
      title: "The leaky synthetic questions",
      category: "evaluation",
      user_query: `${RUNNING_QUESTION} (one golden-set row, next to 2,000 synthetic test questions)`,
      retrieved_context: [
        { source: cite(C.definitions), text: C.definitions.text, score: 0.79 },
        { source: cite(C.compelledDisclosure), text: C.compelledDisclosure.text, score: 0.76 },
        { source: cite(C.permittedDisclosure), text: C.permittedDisclosure.text, score: 0.75 },
      ],
      bad_output: `Recall@3 on the synthetic questions: 99%. On the golden set it doesn't move, and the subcontractor row still misses ${C.contractors.section}.`,
      symptom: "A near-perfect score on made-up questions, and no gain on real ones.",
      root_cause: "The question-writing model copied each passage's own words into its question, so the embedding model learned to match words, which keyword search already does.",
      fix: "Tell the question writer to ask as a non-lawyer would, reject any question that shares a long phrase with its passage, and judge the model on the golden set, not on synthetic questions.",
      cause_options: [
        { id: "a", text: "The base model was too small to learn legal words" },
        { id: "b", text: "ACORD was far too hard a test for a small model" },
        { id: "c", text: "Questions copied the passages' wording" },
      ],
      correct_cause: "c",
    },
    {
      id: "m11-f03",
      order_index: 3,
      title: "Wins the benchmark, loses at home",
      category: "evaluation",
      user_query: RUNNING_QUESTION,
      retrieved_context: [
        { source: cite(C.definitions), text: C.definitions.text, score: 0.79 },
        { source: cite(C.permittedDisclosure), text: C.permittedDisclosure.text, score: 0.77 },
        { source: cite(C.compelledDisclosure), text: C.compelledDisclosure.text, score: 0.74 },
      ],
      bad_output: `Recall@3 on ACORD rises 12 points, but on the golden set it drops 4 points, and the subcontractor row loses ${C.contractors.section} from the top 3.`,
      symptom: "The public test improves while your own golden set gets worse.",
      root_cause: "The model fit the public contracts it trained on, not the way Beta's NDAs are written.",
      fix: "Add training pairs made from Beta's own NDAs (never golden-set rows), and switch config/models.yaml only when both ACORD and the golden set improve.",
      cause_options: [
        { id: "a", text: "It fit public contracts, not Beta's NDAs" },
        { id: "b", text: "ACORD's test questions leaked into the training pairs" },
        { id: "c", text: "The judge prompt changed at the same time" },
      ],
      correct_cause: "a",
    },
  ],
};

export default m11;
