import type { ModuleContent } from "../types";
import { cite, NDA_CLAUSES as C, RUNNING_QUESTION } from "../nda";
import { md } from "../md";

// Module 3, in Module 1's lesson format, on the running example: one NDA
// (Acme Corp and Beta Ltd) and one question, "Can we share this with a
// subcontractor?". After Module 2, §4.2(b) is 2nd but §4.5 ("contractors")
// is still 9th by meaning alone. This module adds keyword search (BM25) and
// reciprocal rank fusion behind one retrieve(): §4.5 comes back 7th of about
// 40 candidates. The writer still reads only the top few, so the answer is
// unchanged until Modules 4 and 5.
//
// Quiz, step and failure ids are unchanged from the original Module 3, so
// existing attempts and review cards keep pointing at the same slots.

const REWRITE = "Is disclosure of Confidential Information to a third party, Permitted Recipient or contractor permitted?";
const FOLLOW_UP = "Does Section 4.5 change whether we can share with a subcontractor?";
const M02_ANSWER = `Yes, to Permitted Recipients bound by written confidentiality obligations (${C.permittedDisclosure.section}).`;

const m03: ModuleContent = {
  id: "m03",
  slug: "hybrid-retrieval",
  order_index: 3,
  title: "Retrieval",
  summary:
    "Add keyword search to the contract assistant's meaning search, merge the two ranked lists with reciprocal rank fusion, and watch the amendment about contractors come back for \"Can we share this with a subcontractor?\", all behind one retrieve() function.",
  hook: `After Module 2, ask "${RUNNING_QUESTION}" and the assistant says yes, to Permitted Recipients (${C.permittedDisclosure.section}). But Amendment No. 1 to the non-disclosure agreement (NDA) added ${C.contractors.section}: no disclosure to contractors without written consent. The word "contractors" is right there, and the search still ranks that clause 9th.`,
  learning_objectives: [
    `Explain why meaning search ranks the short ${C.contractors.section} amendment 9th, even though it says "contractors"`,
    "Describe what keyword search scored with BM25 (Best Matching 25) catches, such as exact words and section numbers, and what it misses",
    "Merge a meaning search and a keyword search with reciprocal rank fusion, and work out a clause's merged score by hand",
    "Predict whether meaning, keyword or hybrid search will find the right clause for a question about the NDA, then test it",
    "Put both searches behind one retrieve() function that hands about 40 candidate clauses forward",
  ],
  estimated_minutes: 90,
  is_published: true,
  pipeline_stages: ["hybrid-retrieval"],
  explain_back_prompt: `In your own words: ${C.contractors.section} says "contractors", yet meaning search ranks it 9th. How do keyword search and reciprocal rank fusion bring it back, and why doesn't the answer to the subcontractor question change yet?`,
  video: null,

  lesson_steps: [
    {
      id: "m03-s01",
      order_index: 1,
      kind: "warm_up",
      title: "Warm-up: what you already know",
      body_md: `Before we start, answer these from what you remember of Module 2. There are no wrong answers. You'll check yourself against the study guide at the end.

1. The NDA never says "subcontractor". Which words does it use for the same idea?
2. Module 2 translated the question before searching. Name two of the tools it used to do that.
3. The subcontractor question was tagged multi-clause. What does that tag decide, and which way does the tagger lean when it isn't sure?`,
    },
    {
      id: "m03-s02",
      order_index: 2,
      kind: "concept",
      title: "The word is right there",
      body_md: `Here's where Module 2 left us.

The question is translated now. The search runs with "${RUNNING_QUESTION}" and with the rewrite, "${REWRITE}" ${C.permittedDisclosure.section} climbs to 2nd, and the writer answers: "${M02_ANSWER}"

Now read Amendment No. 1:

> ${C.contractors.text}

**Contractors.** The very word our rewrite added. So why does ${C.contractors.section} still come 9th?

Because meaning search reads a clause as a whole and asks what it's about. ${C.contractors.section} is one short sentence, and much of it points back at another clause: "Notwithstanding Section 4.2…". So its embedding lands near "a rule about Section 4.2", not near "sharing with outside companies". The one word that matters, "contractors", gets drowned out.

Then a lawyer at Beta tries a sharper question: **"${FOLLOW_UP}"** That misses too. To an embedding model, "4.5" is just a number with no meaning of its own. It looks much like "4.2" or "1.4".

What we need is a search that doesn't care about meaning at all. One that simply looks for the word.`,
    },
    {
      id: "m03-s03",
      order_index: 3,
      kind: "concept",
      title: "Two searches, one list",
      body_md: `Think of a good librarian. Ask about "sharing secrets with outside firms" and they know which shelf to try. That's meaning search. Ask for "Section 4.5" and they flip to the index at the back of the book and look it up. That's **keyword search**.

Keyword search looks for the question's exact words in each clause. The usual way to score it is called **BM25 (Best Matching 25)**. It gives a clause more points when:

- the clause contains the question's words, and
- those words are **rare** in the NDA. "Contractors" appears in only one clause, so a match on it is worth a lot. "Confidential Information" appears almost everywhere, so a match on it is worth very little.

So for our rewritten question, the word "contractor" lifts ${C.contractors.section} near the top of the keyword list. And for the lawyer's question, "4.5" matches the clause's own section number.

We don't throw meaning search away. It's still what finds ${C.permittedDisclosure.section} and ${C.permittedRecipient.section} when someone says "subcontractor", a word that appears in neither. So we run both searches and merge their two lists into one. Running both together is called **hybrid search**.

:::key What Module 3 adds
This module finishes **[2] hybrid retrieval**. Module 1 built only its meaning-search half. Now you add the keyword half and the step that merges the two. That's why the map's 📍 You are here marker sits on that one stage.

What's still wrong afterwards: ${C.contractors.section} now comes back **7th** of about 40 candidates. It's found, but the writer still reads only the top few, so the answer to the subcontractor question doesn't change yet. Module 4 tidies the 40 down to 10, and Module 5 puts the best clause first.
:::

:::more How BM25 counts
For each word in the question, BM25 asks three things about a clause. Does the word appear, and how often? How rare is the word across the whole NDA? And how long is the clause? Rare words count for more, repeats help a little but not endlessly, and a long clause doesn't win just by being long. The scores for each word are added up. You don't need to code this yourself: a ready-made library does it in a few lines.
:::`,
      code_snippet: `from rank_bm25 import BM25Okapi

def words(text: str) -> list[str]:
    # Keep section numbers like "4.5" and "4.2(b)" whole.
    return [w.strip("§,.;:\\"?") for w in text.lower().split()]

clauses = load_nda_clauses()             # the same clauses as the meaning index
bm25 = BM25Okapi([words(c.text + " " + c.section) for c in clauses])

scores = bm25.get_scores(words("${REWRITE}"))
keyword_list = sorted(zip(clauses, scores), key=lambda x: -x[1])`,
      code_language: "python",
    },
    {
      id: "m03-s04",
      order_index: 4,
      kind: "concept",
      title: "Merging the two lists",
      body_md: `Now you have two ranked lists for the same question, one from meaning search and one from keyword search. How do you turn them into one?

You can't just add the scores. Cosine similarity runs from -1 to 1, while a BM25 score might be 3 or 12. That's like adding inches to kilograms. So instead of scores, we use **ranks**, with a method called **reciprocal rank fusion**.

Each clause gets points from each list: **1 ÷ (60 + its rank in that list)**. Then you add its points up. A clause that isn't in a list gets nothing from it.

Let's do ${C.contractors.section} for our rewritten question:

- Meaning search ranks it 9th: 1 ÷ 69 ≈ 0.0145
- Keyword search ranks it 2nd: 1 ÷ 62 ≈ 0.0161
- Total ≈ 0.0306

Compare the signature block at the end of the NDA. Meaning search ranks it 5th, but it shares almost no words with the question, so keyword search ranks it around 30th: 1 ÷ 65 + 1 ÷ 90 ≈ 0.0265. ${C.contractors.section} now beats it comfortably.

That's the pattern: **a clause that does well in both lists comes out on top**, and a clause that only one search liked drifts down. Put everything together and ${C.contractors.section} lands 7th in the merged list.

:::more Why 60, and one easy mistake
- The 60 is a cushion. Without it, first place in either list (1 ÷ 1) would swamp everything else. 60 is the usual choice, and you rarely need to change it.
- Merge by clause, not by position. ${C.permittedDisclosure.section} appears in both lists; it must become one entry with both sets of points, not two entries. Give every clause a fixed id, such as its document and section number, and add points by that id.
:::`,
      code_snippet: `def fuse(*ranked_lists, k: int = 60) -> list[str]:
    """Reciprocal rank fusion: merge ranked lists of clause ids."""
    points: dict[str, float] = {}
    for ranked in ranked_lists:
        for rank, clause_id in enumerate(ranked, start=1):
            points[clause_id] = points.get(clause_id, 0) + 1 / (k + rank)
    return sorted(points, key=points.get, reverse=True)

# §4.5: 9th by meaning, 2nd by keyword
# 1/(60+9) + 1/(60+2) = 0.0145 + 0.0161 = 0.0306  →  7th overall`,
      code_language: "python",
    },
    {
      id: "m03-s05",
      order_index: 5,
      kind: "concept",
      title: "Which search wins?",
      body_md: `Different questions need different searches. Try predicting each one before you read the answer.

- "${RUNNING_QUESTION}" → **meaning search** finds ${C.permittedDisclosure.section} and ${C.permittedRecipient.section}, because the NDA never says "subcontractor". **Keyword search** finds ${C.contractors.section}, through the word "contractor" that Module 2's rewrite added.
- "${FOLLOW_UP}" → **keyword search.** "4.5" means nothing to an embedding model, but it's an exact match for the clause's section number.
- "Can our sister company see this?" → **meaning search.** The NDA says "Affiliates", a word the question never uses.

Run ten questions like these through all three searches and count how often each one puts the right clause in the top 3. Hybrid usually wins most of them, often 8 of 10. **Study the ones it loses**: they show you where the merge is weak.

**One function for the whole pipeline**

All of this sits behind one function in your code, \`retrieve()\`. The rest of the pipeline simply asks it for clauses and never needs to know there are two searches inside.

It hands back about **40 candidates**. That's generous on purpose. At this stage, missing the right clause is far worse than bringing along a few wrong ones: later stages can throw the wrong ones away, but nothing later can bring back a clause that was never found.`,
      code_snippet: `def retrieve(question: str, k: int = 40) -> list[Clause]:
    q = rewrite_query(question)                      # from Module 2
    meaning, keyword = [], []
    for text in q["searches"]:
        meaning.append(vector_index.search(text, top_k=k, filters=q["filters"]))
        keyword.append(bm25_index.search(text, top_k=k, filters=q["filters"]))
    ids = fuse(*[[c.id for c in found] for found in meaning + keyword])
    return [clause_by_id[i] for i in ids[:k]]`,
      code_language: "python",
    },
    {
      id: "m03-s06",
      order_index: 6,
      kind: "exercise",
      title: "Hands-on: try it yourself",
      body_md: md`**Predict first:** you'll run ten questions about the NDA through meaning search, keyword search and hybrid search. For how many will hybrid put the right clause in the top 3? And where will ${C.contractors.section} land for "${RUNNING_QUESTION}"? Write both guesses down before you start.

:::tier guided
:::step Open your project and make this module's branch
**Where:** in your terminal (see Module 0 if you need a reminder of how to open it).

**Do:** go into your project folder, then make a **branch** called \`hybrid-retrieval\` for this module. It starts from where you are now, Module 2's \`pre-retrieval\` branch, so the rewrites, the tag and the writer all come along.

~~~bash
cd rag-course-project
git switch -c hybrid-retrieval
~~~

**You should see:** \`Switched to a new branch 'hybrid-retrieval'\`.

**If it didn't work:** if it says the branch already exists, you've started this before: run \`git switch hybrid-retrieval\` instead. If \`cd\` can't find the folder, open a new terminal (it starts in your home folder) and try again.
:::

:::step See where ${C.contractors.section} is now
**Where:** in your terminal, inside \`rag-course-project\`.

**Do:** ask the lawyer's sharper question from this lesson, the one that names the clause by its number. This is your "before".

~~~bash
uv run ask.py "${FOLLOW_UP}"
~~~

**You should see:** after about half a minute, Module 2's output: the searches, five clauses with scores, the tag and model, and an answer. Write down whether ${C.contractors.section} is in the five clauses, and where. Meaning search often leaves it out, because "4.5" is just a number to it.

**If it didn't work:** if you see only five clause lines and no tag or answer, Module 2 isn't finished on this branch. Run \`git log --oneline -1\`: it should show "Module 2: translate the question before searching". If not, finish Module 2's Guided steps first.
:::

:::step Ask Claude Code to add keyword search
**Keyword search** looks for the question's exact words in each clause, and **BM25** is the usual way to score it: rare words count most. A ready-made **library** called rank-bm25 does the scoring. You'll also use a simple kind of **stemming**: cutting a final "s" off longer words, so "contractor" and "contractors" count as the same word.

**Where:** in Claude Code. Start it from your project folder:

~~~bash
claude
~~~

**Do:** paste this whole box and press Enter.

~~~prompt
Add keyword search next to the meaning search in this project, in Python, run with uv.
- Add the rank-bm25 library with uv.
- In rag.py, write words(text): lower-case the text, split it on spaces, and strip § and the punctuation , . ; : " ' ? ! from the start and end of each word, so section numbers like 4.5 and 4.2(b) stay whole. Then cut a final "s" from any word longer than three letters, so contractor and contractors count as the same word.
- In rag.py, write keyword_search(text, k): build a BM25Okapi index once, when rag.py loads, over every chunk in index/, using words() on each chunk's section, title and text together. Return the k chunks with the highest BM25 scores, with their scores, in the same shape meaning_search returns.
- Give rewrite_query an option use_claude, default True. When it's False, return only the question with the synonym words added, without calling Claude.
Then, for the question "Does Section 4.5 change whether we can share with a subcontractor?" with use_claude=False, show me the top 5 from meaning_search and the top 5 from keyword_search side by side.
~~~

Claude Code asks before it changes files, adds the library or runs anything. Choose **Yes** each time.

**You should see:** two short lists of five clauses each. In the keyword list, ${C.contractors.section} should be at or near the top, because "4.5" and "Section" match it exactly. In the meaning list it's lower, or missing.

**If it didn't work:** if ${C.contractors.section} gets no keyword points at all, the section number was probably not included or got cut up. Ask Claude Code: "Show me what words() returns for the §4.5 chunk and for the question, and fix it so 4.5 matches."
:::

:::video m03-keyword-search
:::

:::step Combine the two searches inside retrieve()
Now the two lists become one, with **reciprocal rank fusion**: each clause gets 1 ÷ (60 + its rank) from every list it's in, and the points are added up. All of it goes inside \`retrieve()\`, so the rest of your code doesn't change.

**Where:** in Claude Code, still in your project.

**Do:** paste this whole box and press Enter.

~~~prompt
Merge meaning search and keyword search with reciprocal rank fusion, inside retrieve().
- In rag.py, write fuse(ranked_lists, k=60). Each list holds clause ids, best first; a clause's id is its section, or "Signature block". Every clause gets 1 / (60 + its rank) from each list it appears in, with ranks starting at 1, added up by clause id, so each clause appears once. Return the clauses sorted by total points, highest first, with their points.
- Change retrieve(question, k=40, use_claude=True): call rewrite_query(question, use_claude), run meaning_search and keyword_search for every search it returns, each for the top k, fuse all those lists, and return up to k clauses with their fused points. Our NDA has only eight clauses, so it returns all of them.
- Keep generate() reading only the top 3.
- Change ask.py so that after the searches it prints every clause retrieve() returns, one per line: merged rank, fused points, section, title. Add "<-- §4.5" at the end of the §4.5 line. Then print the tag and model line and the answer, as before.
Run it with "Can we share this with a subcontractor?" and show me the output.
~~~

**You should see:** the searches, then all eight clauses in one merged list with small, close-together numbers such as 0.12 (they're fusion points, not similarity scores), and an arrow marking ${C.contractors.section}. It should sit higher than it did in Module 2. The answer will most likely be the same as in Module 2, because the writer still reads only the top 3.

**If it didn't work:** if a clause appears twice in the merged list, the lists are being combined by position, not by clause. Ask Claude Code: "Make fuse() add up points by clause id, so each clause appears only once."
:::

:::step Build a ten-question comparison
One question proves little. You'll check all three kinds of search on ten questions, each with the clause that should answer it. This runs without calling Claude, so it takes seconds.

**Where:** in Claude Code, still in your project.

**Do:** paste this whole box and press Enter.

~~~prompt
Create compare.py, run with uv run compare.py. It checks ten questions, each with the clause that answers it:
1. Can we share this with a subcontractor? → §4.2(b)
2. Does Section 4.5 change whether we can share with a subcontractor? → §4.5
3. Can our sister company see this? → §4.2(b)
4. How long does the NDA last? → §7
5. Which state's law governs this agreement? → §9
6. What if a court orders us to hand the information over? → §5
7. What counts as confidential information? → §1.1
8. Who counts as a Permitted Recipient? → §1.4
9. Can we tell contractors without asking first? → §4.5
10. Who signs the agreement? → Signature block
For each question, use rewrite_query(question, use_claude=False), then find the right clause's rank in three searches: meaning_search alone, keyword_search alone, and hybrid (fuse of the two). Print one line per question: its number, then the rank in each search, with a tick when it's in the top 3. At the end print the tally: how many of the ten each search put in the top 3. Run it and show me the output.
~~~

**You should see:** ten lines of ranks and ticks, then a tally such as "meaning 6/10, keyword 7/10, hybrid 8/10". Your numbers will differ, and with only eight clauses in the NDA they can be close. Fill in your tally on paper, and circle any question hybrid gets wrong.

**If it didn't work:** if every rank is 1 or every rank is the same, compare.py is probably reading the wrong field. Ask Claude Code: "Print the full ranked list for question 1 in all three searches so I can check compare.py."
:::

:::step Run it all yourself
**Where:** in your terminal. Leave Claude Code first: type \`/exit\` and press Enter.

**Do:** run the subcontractor question, the lawyer's question from step 2, and the comparison, one line at a time.

~~~bash
uv run ask.py "${RUNNING_QUESTION}"
uv run ask.py "${FOLLOW_UP}"
uv run compare.py
~~~

**You should see:** for the subcontractor question, the combined list of all eight clauses with the arrow on ${C.contractors.section}: write down its rank. The answer is most likely the same as in Module 2, because ${C.contractors.section} is found now but usually isn't in the top 3 the writer reads. (With only eight clauses it sometimes makes the top 3, and then the answer mentions contractors. That's fine too.) For the lawyer's question, ${C.contractors.section} should be at or near the top, higher than your "before" from step 2. Last, the ten-question tally from step 5.

**If it didn't work:** if \`compare.py\` says "No such file", Claude Code may have put it somewhere else: run \`ls\` to list your project's files, and look for it.
:::

:::video m03-compare-tally
:::

:::step Save your work and send it to GitHub
**Where:** in your terminal, inside \`rag-course-project\`.

**Do:** run these three lines one at a time. The first picks up every new and changed file, the second **commits** them (saves a snapshot with a note), and the third **pushes** the branch to GitHub, so it's backed up.

~~~bash
git add -A
git commit -m "Module 3: keyword search and rank fusion"
git push -u origin hybrid-retrieval
~~~

**You should see:** after the commit, a line like \`[hybrid-retrieval 1a2b3c4] Module 3: keyword search and rank fusion\`. After the push, a line saying the branch \`hybrid-retrieval\` is set up to track \`origin/hybrid-retrieval\`. On GitHub, your project now has a \`hybrid-retrieval\` branch.

**If it didn't work:** "Please tell me who you are" means Git doesn't know your name yet: do Module 1's Guided step 3, then run the commit line again. If the push asks for a username or password, your terminal isn't signed in to GitHub: run \`gh auth login\` (Module 0, Part 3) and push again.
:::
:::

:::tier partial
Check the merge by hand, then see what the 60 is for.

1. In Claude Code (started as in Guided step 3), ask it to make \`compare.py\` also print, for question 1, the meaning rank, the keyword rank and the fused points of ${C.contractors.section}. Run \`uv run compare.py\` as in Guided step 6.
2. With a calculator, work out 1 ÷ (60 + meaning rank) + 1 ÷ (60 + keyword rank). Does it match the fused points printed?
3. Ask Claude Code to change the 60 in \`fuse()\` to 1, run \`compare.py\` again, and compare the tally with your paper one. What happens to a clause that came first in just one list? Put the 60 back.
4. Save and push as in Guided step 7.
:::

:::tier solo
Find a question about the NDA where keyword search alone beats hybrid in \`compare.py\` (add one if none of the ten does). Give the keyword lists more weight in \`fuse()\`: multiply their points by, say, 1.5. Tune that weight until hybrid wins the question without losing any of the others, keep the question in \`compare.py\`, and save and push.
:::

**Files you create:** new parts of \`rag.py\`: \`words()\` and \`keyword_search()\`, the BM25 keyword search built from the same chunks as your meaning index, and \`fuse()\`, reciprocal rank fusion inside \`retrieve()\`; an updated \`ask.py\` that shows every candidate and where ${C.contractors.section} lands; and \`compare.py\`, a small program that runs ten questions through all three searches and tallies the results.

**Capstone branch:** save this work on a branch called \`hybrid-retrieval\` in your course project. It builds on your pre-retrieval branch and puts meaning search and BM25 keyword search, merged by reciprocal rank fusion, behind one \`retrieve()\` function that hands back up to 40 candidate clauses.

**Check it with your assistant:** ask your coding assistant, "Does my hybrid-retrieval branch run meaning search and BM25 together for every search from rewrite_query, merge them with reciprocal rank fusion by clause rather than by position, and return up to 40 candidates from one retrieve() function?"`,
    },
    {
      id: "m03-s07",
      order_index: 7,
      kind: "concept",
      title: "What keyword search can't do",
      body_md: `Keyword search rescued ${C.contractors.section}. But it has limits of its own, and it's worth knowing them before you lean on it.

- **It matches spellings, not ideas.** "Subcontractor" will never match "Permitted Recipient". That's still meaning search's job, with help from Module 2's rewrite.
- **Small spelling differences count.** "Contractor" and "contractors" are different words to a plain keyword search. **Stemming**, cutting each word back to its root before indexing and searching, fixes that.
- **Two searches means two indexes to keep up to date.** When Amendment No. 1 arrived, both the meaning index and the keyword index had to be rebuilt. Rebuild one and not the other and the two lists disagree about what the NDA says.
- **Finding isn't the same as reading.** ${C.contractors.section} is now 7th, but the writer reads only the top few. You might be tempted to send all 40 candidates to the writer. Don't: it gets lost in long, repetitive text, and every extra word costs money. Module 4 cleans the list, and Module 5 puts the best clause first.`,
    },
  ],

  worked_example: [
    {
      id: "m03-w01",
      order_index: 1,
      title: "The translated question arrives",
      body_md: `Module 2's pre-retrieval has already done its work. The search gets the original question and the rewrite, limited to the NDA's clauses.`,
      stage: "pre-retrieval",
      query_state: `The question now: "${RUNNING_QUESTION}", also searched as "${REWRITE}"`,
    },
    {
      id: "m03-w02",
      order_index: 2,
      title: "Meaning search",
      body_md: `Meaning search ranks the clauses by cosine similarity, just as in Module 2:

1. ${C.definitions.section} ${C.definitions.title}
2. ${C.permittedDisclosure.section} ${C.permittedDisclosure.title}
3. ${C.permittedRecipient.section} ${C.permittedRecipient.title}
…
9. ${C.contractors.section} ${C.contractors.title}

${C.contractors.section} embeds as "a rule about Section 4.2", so the word "contractors" doesn't lift it.`,
      stage: "hybrid-retrieval",
      query_state: `Meaning list: ${C.contractors.section} is 9th.`,
    },
    {
      id: "m03-w03",
      order_index: 3,
      title: "Keyword search",
      body_md: `BM25 scores the same clauses on the rewrite's exact words. "Contractor" is a rare word in the NDA, found only in ${C.contractors.section}, so a match on it is worth a lot. ${C.permittedDisclosure.section}, with "disclose", "Confidential Information" and "Permitted Recipients", comes 1st. ${C.contractors.section} comes **2nd**.`,
      code_snippet: `bm25.get_scores(words("${REWRITE}"))
# 1. §4.2(b)  2. §4.5  3. §1.4 …`,
      code_language: "python",
      stage: "hybrid-retrieval",
      query_state: `Keyword list: ${C.contractors.section} is 2nd.`,
    },
    {
      id: "m03-w04",
      order_index: 4,
      title: "Merge with reciprocal rank fusion",
      body_md: `Each clause gets 1 ÷ (60 + rank) from each list, added up. For ${C.contractors.section}: 1 ÷ 69 + 1 ÷ 62 ≈ 0.0306. Clauses that did well in both lists, like ${C.permittedDisclosure.section} and ${C.permittedRecipient.section}, still finish above it, but ${C.contractors.section} jumps from 9th to **7th**.`,
      code_snippet: `fuse(meaning_ids, keyword_ids)[:40]`,
      code_language: "python",
      stage: "hybrid-retrieval",
      query_state: `Merged list: ${C.contractors.section} is 7th of about 40 candidates.`,
    },
    {
      id: "m03-w05",
      order_index: 5,
      title: "The lawyer's follow-up",
      body_md: `Now try "${FOLLOW_UP}" Meaning search barely notices "4.5". Keyword search matches it exactly against the clause's section number and ranks ${C.contractors.section} 1st. Merged, ${C.contractors.section} reaches the top 3 for this question, where meaning search alone left it out.`,
      stage: "hybrid-retrieval",
      query_state: `For the follow-up: ${C.contractors.section} is 1st by keyword and in the merged top 3.`,
    },
    {
      id: "m03-w06",
      order_index: 6,
      title: "The answer hasn't changed yet",
      body_md: `Back to "${RUNNING_QUESTION}". \`retrieve()\` hands about 40 candidates forward, with ${C.contractors.section} 7th. But the writer still reads only the top few, so it answers just as before:

> "${M02_ANSWER}"

That's not a retrieval miss any more: ${C.contractors.section} was found. It's sitting too far down the list. Module 4 cleans the 40 candidates down to 10, and Module 5 moves the best clause to the top.`,
      stage: "generation",
      query_state: `The answer now: unchanged, "${M02_ANSWER}" ${C.contractors.section} is found (7th) but not yet read.`,
    },
  ],

  // Every term a learner meets in this module (tests/unit/glossary-coverage.test.ts
  // checks none is missing): contract words first, then the rest.
  glossary: [
    "nda", "clause", "section-sign", "subcontractor", "third-party", "permitted-recipient", "confidential-information",
    "disclosing-party", "receiving-party", "affiliate", "amendment", "notwithstanding", "written-consent", "defined-term",
    "signature-block", "keyword-search", "bm25", "hybrid-search", "reciprocal-rank-fusion", "candidate", "embedding",
    "cosine-similarity", "index", "vector-store", "database", "stemming", "synonym-table", "query-rewriting", "routing-tag",
    "retrieval-miss", "re-rank", "function", "branch",
    "terminal", "folder", "claude-code", "library", "chunk", "git", "github", "commit", "push",
  ],

  study_guide: [
    {
      id: "m03-p01",
      order_index: 1,
      point: "Module 2 recap: the NDA says third party, Permitted Recipient and contractors. A synonym table and a rewrite prompt translate the question, a filter keeps the search to the NDA, and a routing tag (going up when unsure) picks the model.",
      narration: `Watch Module 2's pre-retrieval once more. "Subcontractor" picks up third party, Permitted Recipient and contractor. The rewrite restates the question in the NDA's words. The filter keeps the search on the NDA, and the question is tagged multi-clause, so the main model answers. When the tagger isn't sure, it picks the stronger model.`,
    },
    {
      id: "m03-p02",
      order_index: 2,
      point: "Meaning search ranks §4.5 9th: the short amendment embeds as \"about Section 4.2\", and numbers like \"4.5\" embed poorly.",
      narration: `See §4.5 on screen: one short sentence that starts "Notwithstanding Section 4.2". Its embedding lands near §4.2, not near sharing with contractors. Now type the lawyer's question about "Section 4.5" and watch meaning search shrug at the number.`,
    },
    {
      id: "m03-p03",
      order_index: 3,
      point: "Keyword search, scored with BM25 (Best Matching 25), finds exact words and section numbers, and rare words count most.",
      narration: `Follow the word "contractor" through the keyword index. It appears in just one clause, so the match is worth a lot, and §4.5 jumps to 2nd. Common words like "Confidential Information" barely move anything, because they're everywhere.`,
    },
    {
      id: "m03-p04",
      order_index: 4,
      point: "Reciprocal rank fusion merges the two lists by rank: each clause scores 1 ÷ (60 + rank) in each list, added up.",
      narration: `Watch §4.5 collect its points: about 0.0145 for 9th by meaning, about 0.0161 for 2nd by keyword. Together it passes the signature block, which only one search liked, and lands 7th. Clauses that do well in both lists rise to the top.`,
    },
    {
      id: "m03-p05",
      order_index: 5,
      point: "One retrieve() function runs both searches and hands about 40 candidates forward, generous on purpose.",
      narration: `See the rest of the pipeline call retrieve() and get back one list of about 40 clauses. It never sees the two searches inside. Forty is generous on purpose: later stages can drop wrong clauses, but nothing later can recover one that was never found.`,
    },
    {
      id: "m03-p06",
      order_index: 6,
      point: "§4.5 is found (7th) but not yet read, so the answer is unchanged. Modules 4 and 5 fix that.",
      narration: `Follow the 40 candidates to the writer. It reads only the top few, so it still answers "Yes, to Permitted Recipients". This isn't a retrieval miss any more: §4.5 is in the list. It just isn't near the top yet.`,
    },
  ],

  quiz_items: [
    {
      id: "m03-q01",
      lesson_step_id: "m03-s02",
      order_index: 1,
      kind: "single_choice",
      prompt: `${C.contractors.section} says "contractors". Why does meaning search still rank it 9th for the subcontractor question?`,
      choices: [
        { id: "a", text: "§4.5 was never added to the index" },
        { id: "b", text: "The short clause embeds as \"about Section 4.2\", drowning out \"contractors\"" },
        { id: "c", text: "Meaning search skips amendments" },
        { id: "d", text: "The question is too long to embed" },
      ],
      answer: { choice: "b" },
      explanation: "Meaning search reads the whole clause. Most of §4.5 points back at Section 4.2, so its embedding lands there, and one important word isn't enough to move it.",
      difficulty: 1,
    },
    {
      id: "m03-q02",
      lesson_step_id: "m03-s03",
      order_index: 2,
      kind: "single_choice",
      prompt: `A lawyer asks, "${FOLLOW_UP}" Which search is most likely to find ${C.contractors.section}?`,
      choices: [
        { id: "a", text: "Meaning search" },
        { id: "b", text: "Keyword search scored with BM25" },
        { id: "c", text: "Neither" },
        { id: "d", text: "The re-ranker" },
      ],
      answer: { choice: "b" },
      explanation: "\"4.5\" has little meaning to embed, but keyword search matches it exactly against the clause's section number.",
      difficulty: 1,
    },
    {
      id: "m03-q03",
      lesson_step_id: "m03-s03",
      order_index: 3,
      kind: "single_choice",
      prompt: "BM25 gives a clause more points for matching \"contractor\" than for matching \"Confidential Information\". Why?",
      choices: [
        { id: "a", text: "\"Contractor\" is rare in the NDA, so a match on it says more" },
        { id: "b", text: "Shorter words always score higher" },
        { id: "c", text: "BM25 ignores capitalised terms" },
        { id: "d", text: "\"Confidential Information\" is a defined term, so it's skipped" },
      ],
      answer: { choice: "a" },
      explanation: "BM25 rewards rare words. \"Confidential Information\" appears in almost every clause, so matching it tells you little.",
      difficulty: 2,
    },
    {
      id: "m03-q04",
      lesson_step_id: "m03-s04",
      order_index: 4,
      kind: "short_answer",
      prompt: "In reciprocal rank fusion, a clause ranks 2nd in the keyword list. How many points does it get from that list? Write it as a fraction.",
      answer: { accepted: ["1/62", "1 / 62", "1÷62", "1 ÷ 62"] },
      explanation: "Each list gives 1 ÷ (60 + rank), so 2nd place gives 1 ÷ 62, about 0.0161.",
      difficulty: 2,
    },
    {
      id: "m03-q05",
      lesson_step_id: "m03-s04",
      order_index: 5,
      kind: "multi_choice",
      prompt: "Which of these are true of reciprocal rank fusion? (Select all that apply.)",
      choices: [
        { id: "a", text: "Each clause gets points from its rank in each list, added up" },
        { id: "b", text: "The two searches' scores must first be put on the same scale" },
        { id: "c", text: "A clause that ranks well in both lists comes out on top" },
        { id: "d", text: "Each clause should appear only once in the merged list" },
      ],
      answer: { choices: ["a", "c", "d"] },
      explanation: "It uses ranks, not scores, so the scales never need to match. Merging by clause means §4.2(b) from both lists becomes one entry.",
      difficulty: 2,
    },
    {
      id: "m03-q06",
      lesson_step_id: "m03-s05",
      order_index: 6,
      kind: "single_choice",
      prompt: "About how many candidate clauses does retrieve() hand forward, and why?",
      choices: [
        { id: "a", text: "3, because that's all the writer reads" },
        { id: "b", text: "About 40, because later stages can drop wrong clauses but can't recover a missing one" },
        { id: "c", text: "Every clause in the NDA, to be safe" },
        { id: "d", text: "1, the single best match" },
      ],
      answer: { choice: "b" },
      explanation: "Retrieval is generous on purpose. Later stages narrow about 40 down to the best few.",
      difficulty: 2,
    },
    {
      id: "m03-q07",
      lesson_step_id: "m03-s07",
      order_index: 7,
      kind: "single_choice",
      prompt: "Someone asks, \"Can we let an outside firm see this?\" None of those words appear in §4.2(b) or §1.4. Which part of the pipeline has to find those clauses?",
      choices: [
        { id: "a", text: "Keyword search on its own" },
        { id: "b", text: "Meaning search, helped by Module 2's rewrite" },
        { id: "c", text: "Reciprocal rank fusion" },
        { id: "d", text: "Stemming" },
      ],
      answer: { choice: "b" },
      explanation: "Keyword search matches spellings, not ideas. With no shared words, only meaning search and a rewrite into the NDA's words can find the right clauses.",
      difficulty: 3,
    },
  ],

  failure_cases: [
    {
      id: "m03-f01",
      order_index: 1,
      title: "Only one search ran",
      category: "retrieval_miss",
      user_query: FOLLOW_UP,
      retrieved_context: [
        { source: cite(C.permittedDisclosure), text: C.permittedDisclosure.text, score: 0.79 },
        { source: cite(C.permittedRecipient), text: C.permittedRecipient.text, score: 0.77 },
        { source: cite(C.definitions), text: C.definitions.text, score: 0.76 },
      ],
      bad_output: `"No. You may share with Permitted Recipients bound by written confidentiality obligations." (${C.permittedDisclosure.section} ${C.permittedDisclosure.title})`,
      symptom: `The lawyer asked about ${C.contractors.section} by number, and the answer never mentions it.`,
      root_cause: `This search path still called meaning search alone, with no keyword half. To an embedding model "4.5" is just a number, so ${C.contractors.section} never reached the top 3. Keyword search would have matched it exactly.`,
      fix: "Send every search through retrieve(), which runs meaning and keyword search together, and add this section-number question to your test questions.",
      cause_options: [
        { id: "a", text: "The writer was told to ignore section numbers in questions" },
        { id: "b", text: "Only meaning search ran, and numbers embed poorly" },
        { id: "c", text: "§4.5 was never added to the index" },
      ],
      correct_cause: "b",
    },
    {
      id: "m03-f02",
      order_index: 2,
      title: "Contractor isn't contractors",
      category: "retrieval_miss",
      user_query: RUNNING_QUESTION,
      retrieved_context: [
        { source: cite(C.definitions), text: C.definitions.text, score: 0.0325 },
        { source: cite(C.permittedDisclosure), text: C.permittedDisclosure.text, score: 0.032 },
        { source: cite(C.permittedRecipient), text: C.permittedRecipient.text, score: 0.0315 },
      ],
      bad_output: `"${M02_ANSWER}"`,
      symptom: `Keyword search was added, but ${C.contractors.section} didn't move. It's still 9th in the merged list.`,
      root_cause: `The rewrite says "contractor"; ${C.contractors.section} says "contractors". The keyword search compared exact spellings, so the two never matched and ${C.contractors.section} got no keyword points at all.`,
      fix: "Use stemming at both index time and question time, so \"contractors\" and \"contractor\" are stored as the same root word. Then check that §4.5 gets keyword points for the subcontractor question.",
      cause_options: [
        { id: "a", text: "The keyword index was built before Amendment No. 1 was signed" },
        { id: "b", text: "Reciprocal rank fusion gave keyword search too little weight" },
        { id: "c", text: "Keyword search matched exact spellings only" },
      ],
      correct_cause: "c",
    },
    {
      id: "m03-f03",
      order_index: 3,
      title: "The clause that counted twice",
      category: "ranking",
      user_query: RUNNING_QUESTION,
      retrieved_context: [
        { source: `${cite(C.permittedDisclosure)} (from the meaning list)`, text: C.permittedDisclosure.text, score: 0.0161 },
        { source: `${cite(C.permittedDisclosure)} (from the keyword list)`, text: C.permittedDisclosure.text, score: 0.0164 },
        { source: cite(C.definitions), text: C.definitions.text, score: 0.0156 },
      ],
      bad_output: `"${M02_ANSWER}" (${C.permittedDisclosure.section} Permitted Disclosure; ${C.permittedDisclosure.section} Permitted Disclosure)`,
      symptom: `${C.permittedDisclosure.section} fills two of the top 3 places, and ${C.contractors.section} slips down the merged list.`,
      root_cause: `The merge joined the two lists by position, not by clause. ${C.permittedDisclosure.section} from each list became two separate entries, each with only one list's points, instead of one entry with both added together.`,
      fix: "Give every clause a fixed id, such as its document and section number, and add up points by that id, so each clause appears once with its combined score.",
      cause_options: [
        { id: "a", text: "The merge joined the lists by position, not by clause" },
        { id: "b", text: "The index stored §4.2(b) twice when the NDA was loaded" },
        { id: "c", text: "Meaning search and keyword search used different embedding models" },
      ],
      correct_cause: "a",
    },
  ],
};

export default m03;
