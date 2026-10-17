import type { ModuleContent } from "../types";
import { cite, NDA_CLAUSES as C, RUNNING_QUESTION } from "../nda";

// Module 10, rewritten on the running example. After Module 9 the system finds
// §4.5, §4.2(b) and §1.4 and every quote is real, yet the answer argues with
// itself ("yes under §4.2(b)… but contractors need consent under §4.5"). This
// module adds legal domain knowledge (precedence, defined terms, clause-aware
// parsing, citation objects, the "conflicting" routing tag) and delivers the
// final, correct answer. Module 11's warm-up recalls it.
//
// Quiz, step and failure ids are unchanged from the original Module 10, so
// existing attempts and review cards keep pointing at the same slots.

const FINAL_ANSWER = `Not without the Disclosing Party's prior written consent (${C.contractors.section}, Amendment No. 1). A subcontractor isn't a Permitted Recipient under ${C.permittedRecipient.section}, so ${C.permittedDisclosure.section} doesn't cover it.`;

const MUDDLED_ANSWER = `Yes. Under ${C.permittedDisclosure.section} you may share with Permitted Recipients bound by written confidentiality obligations. However, contractors need the Disclosing Party's prior written consent (${C.contractors.section}).`;

const m10: ModuleContent = {
  id: "m10",
  slug: "legal-domain",
  order_index: 10,
  title: "Contract Analysis Domain",
  summary:
    "Teach the contract assistant to read the NDA the way a lawyer does: a later amendment that says \"Notwithstanding\" wins, a defined term means only what its definition says, and every claim comes back as a citation a lawyer can check. With that, the subcontractor question gets its final, correct answer.",
  hook: `You ask the contract assistant, "${RUNNING_QUESTION}" It finds the right clauses of your non-disclosure agreement (NDA), and every quote is real. Then it answers: yes under ${C.permittedDisclosure.section}… but contractors need consent under ${C.contractors.section}. So which is it? The answer argues with itself.`,
  learning_objectives: [
    "Explain how an answer can quote only real clauses and still be legally wrong",
    "Spot an override word like \"Notwithstanding\" and let the clause that uses it win over the clause it names",
    "Resolve a defined term like \"Permitted Recipient\" from its definition, and show why a subcontractor isn't one",
    "Parse the NDA into whole clauses and return each claim as a citation object with section, page and an exact, checked quote",
    "Send conflicting questions to the strongest model, and say when the system should hand the question to a lawyer",
  ],
  estimated_minutes: 90,
  is_published: true,
  pipeline_stages: ["pre-retrieval", "generation"],
  explain_back_prompt: `In your own words: the assistant quoted ${C.permittedDisclosure.section} and ${C.contractors.section} correctly, yet a lawyer called its answer wrong. Which two reading rules was it missing, and why does sharing with a subcontractor need the Disclosing Party's prior written consent?`,
  video: null,

  lesson_steps: [
    {
      id: "m10-s01",
      order_index: 1,
      kind: "warm_up",
      title: "Warm-up: what you already know",
      body_md: `Before we start, answer these from what you remember of Module 9. There are no wrong answers. You'll check yourself against the study guide at the end.

1. In Module 9, a live answer quoted "Subcontractors may receive Confidential Information if…". What was wrong with that quote, and which check stopped it reaching anyone?
2. When a safety check fails, or can't run at all, what does the person asking see instead of the answer?
3. Module 9's checks make sure every quote really is in the NDA. Can an answer built only from real quotes still be wrong? How?`,
    },
    {
      id: "m10-s02",
      order_index: 2,
      kind: "concept",
      title: "The answer that argues with itself",
      body_md: `Let's pick up where Module 9 left off.

Someone at Beta asks again: **"${RUNNING_QUESTION}"** This time search does its job. ${C.contractors.section} comes back first, ${C.permittedDisclosure.section} second and ${C.permittedRecipient.section} third. Every quote passes Module 9's checks. And here's the answer:

> "${MUDDLED_ANSWER}"

Read it the way the person at Beta would. Can they send the files to the subcontractor tomorrow, or not? The answer says yes, and then, sort of, no.

A lawyer would say it's wrong twice over:

1. ${C.contractors.section} starts with **"Notwithstanding Section 4.2"**. That means "whatever Section 4.2 says". For contractors, ${C.contractors.section} wins, so there's no second route through ${C.permittedDisclosure.section}.
2. A subcontractor isn't a Permitted Recipient anyway. ${C.permittedRecipient.section} says a Permitted Recipient is an employee, officer or professional adviser. An outside company is none of those.

So what went wrong? Not search: the three right clauses came first. Not a made-up quote: every word really is in the NDA. The writer read the clauses like ordinary text. It didn't know the rules lawyers use to read a contract.

:::key What Module 10 adds, and where
Modules 1 to 9 built a system that finds the right clauses and refuses to make things up. Module 10 teaches it to **read a contract the way a lawyer does**. That's called legal domain knowledge, and it changes two stages:

- **[1] pre-retrieval**: when the question is rewritten, defined terms are spelled out, so "Permitted Recipient" becomes "employee, officer or professional adviser". The question is also tagged conflicting when one clause overrides another, so the strongest model answers it.
- **[5] generation**: the writer gets two lawyer's rules. A clause that says "Notwithstanding" wins over the clause it names. A defined term means only what its definition says. Every claim comes back as a citation object that can be checked.

That's why the map's 📍 You are here markers sit on those two stages. With them, the subcontractor question finally gets the right answer. What's still weak is search itself: the embedding model learned from general web text, so when Beta's other NDAs say "service providers" instead of "contractors", it walks right past them. Module 11 trains it on legal text.
:::

:::more Why contracts suit RAG, and five ways they trip it up
Contracts are a good fit for retrieval-augmented generation (RAG). The right answer is always written in the document, the structure is clear (numbered sections, definitions, references), and a wrong answer has a real cost, so it's worth checking.

But a system built for ordinary text stumbles in five ways, and our NDA shows every one:

1. **Definitions live far from where they're used.** "Permitted Recipient" is used in ${C.permittedDisclosure.section} on page ${C.permittedDisclosure.page} but defined in ${C.permittedRecipient.section} on page ${C.permittedRecipient.page}.
2. **Clauses point at each other.** ${C.contractors.section} names "Section 4.2".
3. **A few words flip the meaning.** "Notwithstanding", "subject to" and "except" change which clause wins.
4. **Chunks cut sentences.** Cut by size, ${C.permittedDisclosure.section} loses its condition (you saw this in Module 1).
5. **Clauses run across pages.** A clause that starts at the bottom of one page and ends on the next gets split unless you join it back up.
:::`,
    },
    {
      id: "m10-s03",
      order_index: 3,
      kind: "concept",
      title: "Rule one: the amendment wins",
      body_md: `Amendment No. 1 was signed after the NDA. It added one short clause, ${C.contractors.section}:

> "${C.contractors.text}"

"Notwithstanding" is lawyer-speak for "despite". So ${C.contractors.section} says: whatever Section 4.2 allows, contractors need the Disclosing Party's prior written consent. When two clauses seem to disagree, the question of which one wins is called **precedence**. Here the answer is written right into the clause.

There are three override words worth knowing:

- **"Notwithstanding Section X"**: this clause wins over Section X.
- **"Subject to Section X"**: this clause gives way to Section X.
- **"Except as provided in Section X"**: Section X carves out an exception.

**How the system uses them**

1. **When building the index**, a small piece of code scans every clause for these words and stores a label with it: ${C.contractors.section} overrides §4.2. Labels like this are called metadata.
2. **When ${C.permittedDisclosure.section} is found**, the clause that overrides it is pulled in too, even if search missed it. A clause that points at another is called a **cross-reference**, and the two must always be read together.
3. **The overriding clause goes first** in the prompt, marked "overrides §4.2", so the writer reads it first.
4. **The question is tagged conflicting.** That's the routing tag from Module 2. Your settings file, \`config/models.yaml\`, sends conflicting questions to the strongest model you have. It costs more, but a wrong legal answer costs far more.

The override words aren't buried in the code. They live in \`config/taxonomy.yaml\`, a plain text list of the contract words the system knows: override words, defined terms and kinds of clause. A taxonomy is just a tidy list like that. To teach the system a new override word, you add a line to the file, not a line of code.`,
      code_snippet: `import re

# Override words come from config/taxonomy.yaml.
OVERRIDES = re.compile(r"Notwithstanding Section ([\\d.]+)", re.I)

def link_overrides(clauses):
    """While indexing: label each clause with the section it overrides."""
    for c in clauses:
        m = OVERRIDES.search(c.text)
        c.metadata["overrides"] = f"§{m.group(1)}" if m else None

def pull_overriders(found, all_clauses):
    """While answering: bring in any clause that overrides a found one."""
    extra = [
        c for c in all_clauses
        if c.metadata["overrides"]
        and c not in found
        and any(f.section.startswith(c.metadata["overrides"]) for f in found)
    ]
    found = extra + found
    # The overriding clause goes first, so the writer reads it first.
    found.sort(key=lambda c: c.metadata["overrides"] is None)
    return found`,
      code_language: "python",
    },
    {
      id: "m10-s04",
      order_index: 4,
      kind: "concept",
      title: "Rule two: a defined term means its definition",
      body_md: `Now the second mistake. The writer saw "Permitted Recipients" in ${C.permittedDisclosure.section} and read it like everyday English: anyone you permit to receive things. So, it reasoned, a subcontractor you approve must count.

But look at the capital letters. "Permitted Recipient" is a **defined term**: a word the contract gives its own exact meaning. ${C.permittedRecipient.section} spells it out:

> "${C.permittedRecipient.text}"

Employees, officers, professional advisers. A subcontractor is an outside company, so it isn't one, and ${C.permittedDisclosure.section} can't cover it.

Here's a way to picture it. A contract is a bit like a computer program. The definitions near the top are like named boxes, declared once. Every later clause that uses the name means "whatever is in that box". To read ${C.permittedDisclosure.section} properly, you have to open the box in ${C.permittedRecipient.section}, two pages earlier.

**The fix, in two places**

- **When building the index: clause-aware parsing.** Instead of cutting the NDA by size, a parser reads it into a tree: section, then subsection, then clause. Each chunk is one whole clause, even one that runs across a page break, stored with its section number and page. Then every chunk that uses a defined term gets that term's definition attached to it.
- **At [1] pre-retrieval: spell the term out.** When the question is rewritten, "Permitted Recipient" becomes "employee, officer or professional adviser". Now the writer can see for itself that a subcontractor isn't on the list.

:::more How the parser finds clauses and definitions
- **Clause edges.** Each clause in our NDA starts with its number, like "4.2" or "(b)". The parser splits on those numbers rather than on a size, and nests each part under its section.
- **Page breaks.** A PDF (Portable Document Format) file stores each page separately. The parser joins a clause that ends on the next page back into one piece, and keeps the page where it starts for the citation.
- **Definitions.** Any sentence shaped like **"Some Term" means …** is a definition. The parser stores each one with its section, then attaches it to every other clause that uses the same capitalised words.
:::`,
      code_snippet: `import re

# A definition looks like: "Permitted Recipient" means ...
DEFINITION = re.compile(r'"([^"]+)" means ([^.]+)')

def attach_definitions(clauses):
    """Give every clause the definitions of the defined terms it uses."""
    defined = {}
    for c in clauses:
        for term, meaning in DEFINITION.findall(c.text):
            defined[term] = (c.section, meaning)

    for c in clauses:
        c.metadata["definitions"] = {
            term: f"{section}: {meaning}"
            for term, (section, meaning) in defined.items()
            if term in c.text and section != c.section
        }

# §4.2(b) now carries:
# {"Permitted Recipient": "§1.4: any employee, officer or professional adviser ..."}`,
      code_language: "python",
    },
    {
      id: "m10-s05",
      order_index: 5,
      kind: "concept",
      title: "An answer a lawyer can check",
      body_md: `With both rules in place, the writer gets the three clauses in the right order, ${C.contractors.section} marked "overrides §4.2" and ${C.permittedDisclosure.section} carrying the definition from ${C.permittedRecipient.section}. Two new lines in \`prompts/generate.md\`, the prompt file from Module 1, tell it what to do with them. And now it answers:

> "${FINAL_ANSWER}"

One answer, no second route, and it's right.

A lawyer won't just take it on trust, though. They want to see the exact words. So every claim comes back as a **citation object**: a small record holding the clause id, the section, its title, the page, the exact quote, and whether that quote was found word for word in the NDA. The page can turn each citation into a link that opens the NDA at that clause.

Module 9's checks get one more job too. Before the answer is shown, the system now also asks: does the answer rely on a clause that another retrieved clause overrides? An answer that says "yes under ${C.permittedDisclosure.section}" while ${C.contractors.section} is in view gets blocked, just like a made-up quote would. The same legal rules also go into the judge prompts from Module 7. Those are the instructions for LLM-as-judge, where a second large language model (LLM) grades each answer the way a person would. Now the nightly test fails if the old muddled answer ever comes back.`,
      code_snippet: `# prompts/generate.md
Answer the question using only the numbered contract chunks below.
- Cite every claim by section and clause title, e.g. (§4.5 Contractors).
- If the chunks don't answer the question, reply exactly:
  "The contract does not address this."
- If a chunk is marked "overrides §X", it wins over §X for the case it
  covers. Never offer §X as a second route for that case.
- A capitalised defined term means only what its attached definition
  says. Check the definition before saying someone qualifies.

Chunks:
{chunks}

Question: {question}`,
      code_language: "markdown",
    },
    {
      id: "m10-s06",
      order_index: 6,
      kind: "exercise",
      title: "Hands-on: try it yourself",
      body_md: `**Predict first:** before you add any legal rules, ask your system "${RUNNING_QUESTION}" again. Will it offer one route or two? Write your guess down, then check.

- **Guided:** Run the parser on the NDA and look at the tree it builds. Find ${C.permittedDisclosure.section} and check it's one whole clause, with its section number and page ${C.permittedDisclosure.page}.
- **Partial:** Add definition resolution: when a clause uses a defined term, attach the definition. Check that ${C.permittedDisclosure.section} now carries the definition of "Permitted Recipient" from ${C.permittedRecipient.section}.
- **Solo:** Add the override rule. Label ${C.contractors.section} as overriding §4.2, pull it in whenever ${C.permittedDisclosure.section} is found, and write a test that fails if the subcontractor answer ever offers a route through ${C.permittedDisclosure.section} again.

**Files you create:** \`config/taxonomy.yaml\`, a plain text list of the NDA's defined terms and override words that your code reads, and new legal rules in the judge prompts from Module 7, the instruction files the grading model follows.

**Capstone branch:** save this work on a branch called \`legal-domain\` in your course project. It needs the parser, the definition resolver, the citation object and the extra check that blocks answers relying on an overridden clause.

**Check it with your assistant:** ask your coding assistant, "Does my legal-domain branch load config/taxonomy.yaml, use it when rewriting and tagging the question, and save the taxonomy's version number with the index so I know which list built it?"`,
    },
    {
      id: "m10-s07",
      order_index: 7,
      kind: "concept",
      title: "Where legal rules stop",
      body_md: `You've now taught the system real legal reading. Two last things to keep in mind.

**The know-how lives in a pack, not in the engine.** Everything legal you added sits in a **domain pack** with four parts: the taxonomy (\`config/taxonomy.yaml\`), the golden set of test questions, the judge rules, and an embedding model that knows legal language. The engine, all seven stages, stays the same. Module 11 builds that fourth part.

**Some questions need a lawyer, not a rule.** Say Beta hires a freelance consultant who works in Beta's own office. Is that a contractor under ${C.contractors.section}, or more like an employee under ${C.permittedRecipient.section}? The NDA doesn't settle it, and no rule in your code can. The right move is to show both clauses, say plainly that the NDA leaves it open, and suggest asking a lawyer. A careful "it's unclear" beats a confident guess.

And remember that the rules only know the patterns you gave them. If a new amendment uses an override word that isn't in the taxonomy, the system won't spot it. That's why the subcontractor question stays in the golden set: if a rule stops working, the nightly test tells you.`,
    },
  ],

  worked_example: [
    {
      id: "m10-w01",
      order_index: 1,
      title: "The question arrives",
      body_md: `Someone at Beta asks the same question as always. By now the system rewrites it, searches two ways, tidies the results and puts the best clause first. This module changes how the question is rewritten and how the answer is written.`,
      stage: null,
      query_state: `"${RUNNING_QUESTION}"`,
    },
    {
      id: "m10-w02",
      order_index: 2,
      title: "Spell out the defined term",
      body_md: `The rewrite from Module 2 already adds the NDA's own words. Now it also opens up the defined term, using the definitions the parser found in ${C.permittedRecipient.section}. Anyone reading the question can now see that a subcontractor isn't on the list.`,
      code_snippet: `"Is disclosure of Confidential Information to a third party,
Permitted Recipient (employee, officer or professional adviser)
or contractor permitted?"`,
      code_language: "text",
      stage: "pre-retrieval",
      query_state: "Rewritten, with \"Permitted Recipient\" spelled out as employee, officer or professional adviser.",
    },
    {
      id: "m10-w03",
      order_index: 3,
      title: "The clauses come back, with their labels",
      body_md: `Search and re-ranking return the same three clauses as before:

1. ${C.contractors.section} ${C.contractors.title}, labelled **overrides §4.2**
2. ${C.permittedDisclosure.section} ${C.permittedDisclosure.title}, carrying the definition of Permitted Recipient
3. ${C.permittedRecipient.section} ${C.permittedRecipient.title}

The labels were added once, when the NDA was indexed. If search had missed ${C.contractors.section}, the override label would have pulled it in anyway.`,
      stage: "re-rank",
      query_state: `${C.contractors.section} 1st (overrides §4.2), ${C.permittedDisclosure.section} 2nd, ${C.permittedRecipient.section} 3rd.`,
    },
    {
      id: "m10-w04",
      order_index: 4,
      title: "Tagged conflicting",
      body_md: `With ${C.contractors.section} in view, "Notwithstanding Section 4.2" means two clauses pull different ways. So the routing tag changes from multi-clause to **conflicting**, and \`config/models.yaml\` sends the question to the strongest model.`,
      code_snippet: `# config/models.yaml
simple: small-model
multi-clause: main-model
conflicting: strongest-model`,
      code_language: "yaml",
      stage: "routing",
      query_state: "Tagged conflicting, so the strongest model will answer.",
    },
    {
      id: "m10-w05",
      order_index: 5,
      title: "Read it like a lawyer",
      body_md: `The writer gets the three clauses, their labels and the two new rules in \`prompts/generate.md\`. It reasons the way a lawyer would: ${C.contractors.section} wins over §4.2 for contractors, and a subcontractor isn't an employee, officer or professional adviser, so ${C.permittedDisclosure.section} doesn't apply. It writes one answer:

> "${FINAL_ANSWER}"`,
      stage: "generation",
      query_state: `Answered: not without the Disclosing Party's prior written consent (${C.contractors.section}).`,
    },
    {
      id: "m10-w06",
      order_index: 6,
      title: "Citations a lawyer can click",
      body_md: `Each claim comes back as a citation object. The quote is checked word for word against the NDA, and the check confirms the answer doesn't lean on an overridden clause. Only then is the answer shown, with each citation linking to its clause.`,
      code_snippet: `{
  "clause_id": "nda-acme-beta/4.5",
  "section": "${C.contractors.section}",
  "title": "${C.contractors.title}",
  "page": ${C.contractors.page},
  "quote": "${C.contractors.text}",
  "verified": true
}`,
      code_language: "json",
      stage: "generation",
      query_state: "The final, correct answer, with checked citations to §4.5 and §1.4.",
    },
  ],

  // Every term a learner meets in this module (tests/unit/glossary-coverage.test.ts
  // checks none is missing): contract words first, then the rest.
  glossary: [
    "nda", "clause", "section-sign", "subcontractor", "third-party", "permitted-recipient", "confidential-information",
    "disclosing-party", "receiving-party", "affiliate", "amendment", "notwithstanding", "written-consent", "defined-term",
    "precedence", "override-word", "cross-reference",
    "domain-knowledge", "domain-pack", "taxonomy", "rag", "llm", "llm-as-judge", "prompt", "prompt-file", "settings-file",
    "routing-tag", "pdf", "token", "chunk", "clause-aware-parsing", "metadata", "index", "embedding", "re-rank",
    "citation", "citation-object", "golden-set", "branch",
  ],

  study_guide: [
    {
      id: "m10-p01",
      order_index: 1,
      point: "An answer can quote only real clauses and still be wrong. Finding the clauses and refusing made-up quotes isn't the same as reading them correctly.",
      narration: `Watch the answer pass every check from Module 9. Each quote is really in the NDA. Now read it as the person at Beta: yes under §4.2(b), but contractors need consent under §4.5. Two answers at once. Nothing was missing and nothing was invented. The writer simply didn't know how lawyers read contracts.`,
    },
    {
      id: "m10-p02",
      order_index: 2,
      point: "\"Notwithstanding Section 4.2\" means §4.5 wins over §4.2 for contractors. That's precedence, and the system stores it as a label when it builds the index.",
      narration: `See the first word of §4.5: Notwithstanding. It means despite, so whatever Section 4.2 says, contractors need prior written consent. Follow the label the indexer stores, §4.5 overrides §4.2, and watch it pull §4.5 in and put it first whenever §4.2(b) is found.`,
    },
    {
      id: "m10-p03",
      order_index: 3,
      point: "A defined term means only its definition. Permitted Recipient means employees, officers and professional advisers (§1.4), so a subcontractor isn't one.",
      narration: `See the capital letters in Permitted Recipient. Open its definition in §1.4, two pages before §4.2(b): employees, officers, professional advisers. A subcontractor is an outside company, so it isn't on the list. Watch the rewrite spell that definition out before searching.`,
    },
    {
      id: "m10-p04",
      order_index: 4,
      point: "Clause-aware parsing cuts the NDA into whole clauses with their section and page, and attaches each defined term's definition to the clauses that use it.",
      narration: `Watch the parser read the NDA into a tree: section, subsection, clause. Each chunk is one whole clause, even across a page break. Then see the definition from §1.4 travel along with §4.2(b), so the writer never reads the term without its meaning.`,
    },
    {
      id: "m10-p05",
      order_index: 5,
      point: "Conflicting questions go to the strongest model, and every claim comes back as a citation object: clause id, section, title, page and an exact, checked quote.",
      narration: `See the routing tag change to conflicting the moment §4.5 is in view, and the settings file send it to the strongest model. Then follow the answer out: one claim, one citation object, the quote checked word for word, and a link a lawyer can click.`,
    },
    {
      id: "m10-p06",
      order_index: 6,
      point: "Legal know-how lives in a domain pack (taxonomy, golden set, judge rules, legal embedding model). When the NDA truly leaves a question open, the system should say so and point to a lawyer.",
      narration: `Watch the engine stay the same while the legal pieces sit beside it in one pack. Then see a question the NDA doesn't settle: a freelance consultant in Beta's office. The system shows both clauses, says it's unclear, and suggests asking a lawyer instead of guessing.`,
    },
  ],

  quiz_items: [
    {
      id: "m10-q01",
      lesson_step_id: "m10-s02",
      order_index: 1,
      kind: "single_choice",
      prompt: `Why did Module 9's checks let through "Yes under §4.2(b)… but contractors need consent under §4.5"?`,
      choices: [
        { id: "a", text: "The checks were switched off by mistake" },
        { id: "b", text: "Every quote was really in the NDA. The checks test that quotes are real, not that the contract was read correctly" },
        { id: "c", text: "§4.5 wasn't retrieved, so the checks couldn't see it" },
        { id: "d", text: "The answer had no citations to check" },
      ],
      answer: { choice: "b" },
      explanation: "Real quotes can still be combined wrongly. Reading a contract correctly needs legal rules, such as which clause wins.",
      difficulty: 1,
    },
    {
      id: "m10-q02",
      lesson_step_id: "m10-s03",
      order_index: 2,
      kind: "single_choice",
      prompt: "§4.5 starts \"Notwithstanding Section 4.2…\". What does that mean for the subcontractor question?",
      choices: [
        { id: "a", text: "Nothing: it's standard wording and can be ignored" },
        { id: "b", text: "Section 4.2 has been deleted from the NDA" },
        { id: "c", text: "§4.5 wins over Section 4.2 for contractors, so §4.2(b) can't give a separate yes" },
        { id: "d", text: "Section 4.2 wins, because it came first" },
      ],
      answer: { choice: "c" },
      explanation: "\"Notwithstanding\" means \"despite\". Whatever Section 4.2 allows, contractors still need the Disclosing Party's prior written consent.",
      difficulty: 1,
    },
    {
      id: "m10-q03",
      lesson_step_id: "m10-s03",
      order_index: 3,
      kind: "short_answer",
      prompt: "Once §4.5 is in view, which routing tag should the subcontractor question get, so the strongest model answers it?",
      answer: { accepted: ["conflicting", "conflict"] },
      explanation: "\"Notwithstanding Section 4.2\" means two clauses pull different ways, so the question is tagged conflicting.",
      difficulty: 1,
    },
    {
      id: "m10-q04",
      lesson_step_id: "m10-s04",
      order_index: 4,
      kind: "single_choice",
      prompt: "Why isn't a subcontractor a Permitted Recipient under our NDA?",
      choices: [
        { id: "a", text: "§1.4 defines Permitted Recipients as employees, officers or professional advisers, and a subcontractor is none of those" },
        { id: "b", text: "Subcontractors can't sign confidentiality obligations" },
        { id: "c", text: "§4.2(b) only applies to Affiliates" },
        { id: "d", text: "The NDA bans all sharing" },
      ],
      answer: { choice: "a" },
      explanation: "A defined term means only what its definition says, and §1.4's list doesn't include outside companies.",
      difficulty: 2,
    },
    {
      id: "m10-q05",
      lesson_step_id: "m10-s04",
      order_index: 5,
      kind: "single_choice",
      prompt: "Why does clause-aware parsing cut the NDA by clause instead of by a fixed number of tokens?",
      choices: [
        { id: "a", text: "Clause chunks are always smaller" },
        { id: "b", text: "Fixed-size chunks can cut a clause like §4.2(b) in half, losing its condition" },
        { id: "c", text: "The embedding model only accepts whole clauses" },
        { id: "d", text: "It makes the index faster to build" },
      ],
      answer: { choice: "b" },
      explanation: "A clause is the unit of meaning in a contract. Split it, and you split the answer.",
      difficulty: 2,
    },
    {
      id: "m10-q06",
      lesson_step_id: "m10-s05",
      order_index: 6,
      kind: "multi_choice",
      prompt: "Which of these belong in a citation object for the §4.5 claim?",
      choices: [
        { id: "a", text: "The section and clause title" },
        { id: "b", text: "The page number" },
        { id: "c", text: "The exact quote, checked word for word against the NDA" },
        { id: "d", text: "How confident the model felt" },
      ],
      answer: { choices: ["a", "b", "c"] },
      explanation: "A lawyer needs to find the clause and read the exact words. The model's feelings don't help them check anything.",
      difficulty: 2,
    },
    {
      id: "m10-q07",
      lesson_step_id: "m10-s07",
      order_index: 7,
      kind: "single_choice",
      prompt: "Someone asks whether a freelance consultant working in Beta's office counts as a contractor under §4.5 or as an employee under §1.4. The NDA doesn't settle it. What should the system do?",
      choices: [
        { id: "a", text: "Pick whichever clause ranked higher" },
        { id: "b", text: "Say \"The contract does not address this\" and show nothing" },
        { id: "c", text: "Answer yes, since consultants are usually advisers" },
        { id: "d", text: "Show both clauses, say the NDA leaves it open, and suggest asking a lawyer" },
      ],
      answer: { choice: "d" },
      explanation: "When the contract truly leaves a question open, an honest \"it's unclear\" with the clauses beats a confident guess.",
      difficulty: 3,
    },
  ],

  failure_cases: [
    {
      id: "m10-f01",
      order_index: 1,
      title: "The answer that argues with itself",
      category: "prompt",
      user_query: RUNNING_QUESTION,
      retrieved_context: [
        { source: cite(C.contractors), text: C.contractors.text, score: 0.94 },
        { source: cite(C.permittedDisclosure), text: C.permittedDisclosure.text, score: 0.91 },
        { source: cite(C.permittedRecipient), text: C.permittedRecipient.text, score: 0.87 },
      ],
      bad_output: `"${MUDDLED_ANSWER}"`,
      symptom: "Every quote is real and passes verification, but the answer gives two routes, and the first one is wrong.",
      root_cause: `The writer had the right clauses but no rule that "Notwithstanding Section 4.2" makes ${C.contractors.section} win over §4.2.`,
      fix: `Label ${C.contractors.section} as overriding §4.2 when indexing, put it first in the prompt, add a precedence rule to prompts/generate.md, and tag the question conflicting.`,
      cause_options: [
        { id: "a", text: "The re-ranker put the wrong clause first, above the amendment in §4.5" },
        { id: "b", text: "No rule told the writer that §4.5 overrides §4.2" },
        { id: "c", text: "§4.5 was missing from the clauses the writer read" },
      ],
      correct_cause: "b",
    },
    {
      id: "m10-f02",
      order_index: 2,
      title: "The missed \"Notwithstanding\"",
      category: "retrieval_miss",
      user_query: "Does §4.2(b) let us share with a subcontractor?",
      retrieved_context: [
        { source: cite(C.permittedDisclosure), text: C.permittedDisclosure.text, score: 0.93 },
        { source: cite(C.definitions), text: C.definitions.text, score: 0.71 },
      ],
      bad_output: `"Yes, if the subcontractor is bound by written confidentiality obligations no less protective than this Agreement." (${C.permittedDisclosure.section} ${C.permittedDisclosure.title})`,
      symptom: `A confident yes, cited to a real clause, that ${C.contractors.section} overrides.`,
      root_cause: `The question named §4.2(b), so search found only that clause. Nothing linked it to ${C.contractors.section}, the clause that overrides it, so ${C.contractors.section} never arrived.`,
      fix: `Store cross-references when indexing (${C.contractors.section} overrides §4.2), and whenever ${C.permittedDisclosure.section} is retrieved, pull in the clause that overrides it.`,
      cause_options: [
        { id: "a", text: "The definition of \"third party\" was missing from the index entirely" },
        { id: "b", text: "The citation check wrongly rejected §4.5" },
        { id: "c", text: "Nothing pulled in the clause overriding §4.2" },
      ],
      correct_cause: "c",
    },
    {
      id: "m10-f03",
      order_index: 3,
      title: "A defined term read as plain English",
      category: "chunking",
      user_query: "Is a subcontractor a Permitted Recipient?",
      retrieved_context: [
        { source: cite(C.permittedDisclosure), text: C.permittedDisclosure.text, score: 0.9 },
        { source: cite(C.contractors), text: C.contractors.text, score: 0.84 },
      ],
      bad_output: `"Yes. Once the Disclosing Party consents, the subcontractor becomes a Permitted Recipient." (${C.permittedDisclosure.section}, ${C.contractors.section})`,
      symptom: "The answer treats \"Permitted Recipient\" as anyone you're allowed to share with.",
      root_cause: `"Permitted Recipient" is defined in ${C.permittedRecipient.section}, two pages away. The ${C.permittedDisclosure.section} chunk didn't carry that definition, so the writer guessed its everyday meaning.`,
      fix: "Parse the NDA by clause and attach each defined term's definition to every chunk that uses it. Spell the definition out when rewriting the question.",
      cause_options: [
        { id: "a", text: "The chunk lacked the definition from §1.4" },
        { id: "b", text: "The routing tag sent the question to the smallest and cheapest model" },
        { id: "c", text: "§4.5 changed what Permitted Recipient means" },
      ],
      correct_cause: "a",
    },
  ],
};

export default m10;
