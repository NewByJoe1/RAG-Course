import type { ModuleContent } from "../types";
import { cite, NDA_CLAUSES as C, RUNNING_QUESTION } from "../nda";
import { md } from "../md";

// Module 6, rewritten on the running example. Module 5's re-ranker put §4.5
// first for the plain question; asked in a lawyer's words ("May the Receiving
// Party disclose to a subcontractor?"), the ready-made cross-encoder puts §5
// Compelled Disclosure first because "disclose" overlaps. The rescue is
// fine-tuning the re-ranker on legal training pairs, tested fairly.
//
// Quiz, step and failure ids are unchanged from the original Module 6, so
// existing attempts and review cards keep pointing at the same slots.

const LAWYER_QUESTION = "May the Receiving Party disclose to a subcontractor?";

const m06: ModuleContent = {
  id: "m06",
  slug: "fine-tuned",
  order_index: 6,
  title: "Fine-Tuning",
  summary:
    "Teach the re-ranker legal language. When a lawyer words the subcontractor question their own way, the ready-made re-ranker is fooled by a shared word. You fine-tune it on your own question-and-clause pairs, test it fairly on pairs it never trained on, and keep the old one a single switch away.",
  hook: `Module 5's re-ranker put ${C.contractors.section} first for "${RUNNING_QUESTION}" Then a lawyer asks the same thing in lawyer's words: "${LAWYER_QUESTION}" Now the re-ranker puts ${C.compelledDisclosure.section} Compelled Disclosure first, a clause about court orders, just because it also says "disclose".`,
  learning_objectives: [
    `Explain why a ready-made re-ranker, trained on web searches, puts ${C.compelledDisclosure.section} Compelled Disclosure first for a lawyer's wording of the subcontractor question`,
    "Build training pairs for the re-ranker from your non-disclosure agreement (NDA), including hard negatives: wrong clauses that look right",
    "Keep a held-out set aside, and read a loss curve to see when training should stop, before overfitting sets in",
    "Switch between the base model and the fine-tuned re-ranker with one feature flag, and compare them on the same questions",
    "Decide when fine-tuning is worth it, and when a cheaper fix is the better investment",
  ],
  estimated_minutes: 90,
  is_published: true,
  pipeline_stages: ["re-rank"],
  explain_back_prompt: `In your own words: why did the ready-made re-ranker put ${C.compelledDisclosure.section} first for "${LAWYER_QUESTION}", and how do training pairs with hard negatives teach it to put ${C.contractors.section} first instead?`,
  video: null,

  lesson_steps: [
    {
      id: "m06-s01",
      order_index: 1,
      kind: "warm_up",
      title: "Warm-up: what you already know",
      body_md: `Before we start, answer these from what you remember of Module 5. There are no wrong answers. You'll check yourself against the study guide at the end.

1. For "${RUNNING_QUESTION}", which clause did the re-ranker move into first place, and where was it before?
2. A cross-encoder reads the question and a clause together. Why is it only used on a short list, and not on the whole contract?
3. In Module 5's solo task you wrote 30 question-and-clause pairs. What did each pair say?`,
    },
    {
      id: "m06-s02",
      order_index: 2,
      kind: "concept",
      title: "Same question, a lawyer's words",
      body_md: `Let's pick up the story where Module 5 left it.

Someone at Beta asks, "${RUNNING_QUESTION}" The re-ranker puts ${C.contractors.section} first, and the answer is close to right. Then Beta's lawyer asks the very same thing the way lawyers talk: **"${LAWYER_QUESTION}"**

Same meaning, different words. This time the re-ranker's top three are:

1. ${C.compelledDisclosure.section} Compelled Disclosure: 0.91
2. ${C.permittedDisclosure.section} Permitted Disclosure: 0.88
3. ${C.definitions.section} Definitions: 0.79

${C.contractors.section} comes 4th, so it's cut. The writer reads ${C.compelledDisclosure.section} first, a clause about what to do when a court orders you to hand information over, and answers: "Only if the law or a court order requires it, after giving the Disclosing Party prompt notice." A confident answer to a question nobody asked.

Why? The re-ranker you downloaded in Module 5 is a **cross-encoder**: a model that reads the question and one clause side by side and scores the match. It learned to do that from millions of web searches. On the web, a page that repeats your search word is usually a good match. So "disclose" in the question and "disclose" in ${C.compelledDisclosure.section} looks like a great match. It has never read a contract, where "disclose" turns up in almost every clause.

Before retraining anything, try the cheap fix. Give the re-ranker the rewritten question from Module 2, the one that says "third party, Permitted Recipient or contractor". It **half works**: ${C.contractors.section} climbs to 2nd, but ${C.compelledDisclosure.section} stays 1st, because the rewrite still says "disclosure".

:::key What Module 6 adds
Module 6 doesn't add a new stage. It improves one you already have: **[4] re-rank**. That's why the map's 📍 You are here marker sits on re-rank alone.

You'll **fine-tune** the re-ranker: train the ready-made model a little more on your own examples from the NDA, so it learns that "disclose" is everywhere in a contract and "contractor" is the word that matters here. Afterwards it puts ${C.contractors.section} first for both wordings.

Two things are still wrong after this module. You're still checking each change on one or two questions by hand, which Module 7 fixes with a proper test set. And the answer still offers a muddled second route under ${C.permittedDisclosure.section}, which Module 10 fixes.
:::`,
    },
    {
      id: "m06-s03",
      order_index: 3,
      kind: "concept",
      title: "Teaching by example: training pairs",
      body_md: `A model learns from examples. For a re-ranker, each example is a **training pair**: one question, one clause, and a mark saying how well that clause answers the question.

We use three marks:

- **1** means this clause answers the question. "${LAWYER_QUESTION}" with ${C.contractors.section} gets a 1.
- **0.5** means it helps but doesn't settle it. The same question with ${C.permittedDisclosure.section} or ${C.permittedRecipient.section} gets 0.5.
- **0** means it's the wrong clause. The same question with ${C.compelledDisclosure.section} gets a 0.

That last kind is the most useful. A **hard negative** is a wrong clause that looks very like a right one. ${C.compelledDisclosure.section} shares the word "disclose" with the question, so it's exactly the mistake we want to train out. An easy negative, like ${C.governingLaw.section} Governing Law, teaches almost nothing, because the model already knows it's unrelated.

**Where the pairs come from**
- **The 30 pairs you wrote in Module 5**, saved in \`data/rerank_pairs.jsonl\`. These are the most valuable: real questions, checked by you against the NDA.
- **About 200 generated pairs.** You ask a language model to write new questions for each clause, the way different people would ask them: plainly, like a lawyer, short, long. You check a sample by hand before trusting them.

All of them go in a file called \`train/pairs.jsonl\`. It's a plain text file with one pair per line, so you can read it, add to it and see every change.`,
      code_snippet: `# train/pairs.jsonl: one pair per line (question, clause, mark)
{"question": "${LAWYER_QUESTION}", "clause": "§4.5", "label": 1.0}
{"question": "${LAWYER_QUESTION}", "clause": "§4.2(b)", "label": 0.5}
{"question": "${LAWYER_QUESTION}", "clause": "§5", "label": 0.0}
{"question": "${RUNNING_QUESTION}", "clause": "§4.5", "label": 1.0}
{"question": "Can an outside firm we hire see Acme's files?", "clause": "§4.5", "label": 1.0}
{"question": "Can an outside firm we hire see Acme's files?", "clause": "§1.1", "label": 0.0}`,
      code_language: "json",
    },
    {
      id: "m06-s04",
      order_index: 4,
      kind: "concept",
      title: "Testing it fairly: held-out pairs and the loss curve",
      body_md: `Here's the trap. If you test the re-ranker on the same pairs it trained on, it will look brilliant. It has seen the answers, the subcontractor question's included. That tells you what it memorised, not what it learned.

So before training, put **20% of the pairs aside**. That's your **held-out set**. The re-ranker never trains on it, and you use it only to test. Do the split **first**, before you generate any extra pairs, or near-copies of a held-out question can sneak into training. That's called **leakage**, and it makes the test score look better than the model really is.

Then you train. Training goes through all the training pairs several times; each full pass is an **epoch**. After each epoch you measure two things: the mistakes on the training pairs, and the mistakes on the held-out pairs. Plot both and you get a **loss curve**.

- At first both lines fall. The re-ranker is learning that "contractor" matters and "disclose" doesn't.
- Around **epoch 3**, the held-out line stops falling. That's the moment to stop.
- Keep going to epoch 10 and the training line keeps falling while the held-out line rises. The re-ranker is memorising the exact wording of its training pairs. That's **overfitting**.

:::key The numbers
The ready-made re-ranker gets **71%** of the held-out pairs right. Fine-tuned for 3 epochs, it gets **84%**. Trained for 10, it scores 99% on its training pairs but drops to **76%** on the held-out ones. Same model, same pairs: only the stopping point changed.
:::

:::more How the training run works
The program loads the ready-made cross-encoder, reads the training pairs, and adjusts the model's numbers a little after each batch of 16 pairs, so that its scores move towards the marks you gave. After each epoch it scores the held-out pairs and saves the model only if the held-out score improved. That way, even if you set too many epochs, you keep the best version, not the last one.
:::`,
      code_snippet: `from sentence_transformers import CrossEncoder, InputExample
from torch.utils.data import DataLoader

# Start from the same ready-made re-ranker Module 5 downloaded.
model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2", num_labels=1)

train = [InputExample(texts=[p["question"], CLAUSE_TEXT[p["clause"]]], label=p["label"])
         for p in train_pairs]          # the 80%; held_out_pairs are never used here

model.fit(
    train_dataloader=DataLoader(train, shuffle=True, batch_size=16),
    evaluator=held_out_evaluator,       # scores the held-out pairs after every epoch
    epochs=3,                           # where the held-out line bottomed out
    save_best_model=True,
    output_path="models/reranker-v2",
)`,
      code_language: "python",
    },
    {
      id: "m06-s05",
      order_index: 5,
      kind: "concept",
      title: "Base or tuned: one switch",
      body_md: `You now have two re-rankers: the **base model** you downloaded, and the fine-tuned one saved in a folder called \`models/reranker-v2/\`. Don't delete the base model. You'll want to compare them, and you may need to switch back.

So the choice lives in one setting, a **feature flag**, in \`config/models.yaml\`. That's the plain text settings file from Module 2 that already says which language model answers which kind of question. Add one line for the re-ranker: \`base\` or \`tuned\`. To switch, you change that word. No code changes.

Then compare them on the same questions, side by side:

- **The held-out pairs:** 71% for the base model, 84% tuned.
- **"${RUNNING_QUESTION}":** both put ${C.contractors.section} first.
- **"${LAWYER_QUESTION}":** the base model puts ${C.compelledDisclosure.section} first; the tuned one puts ${C.contractors.section} first, ${C.permittedDisclosure.section} second and ${C.permittedRecipient.section} third.

The tuned re-ranker wins on both wordings, so you set the flag to \`tuned\`. If lawyers start reporting worse answers next week, you set it back to \`base\` in seconds, while you work out why.

One more check: speed. The fine-tuned model is the same size as the base one, so it takes the same time to score the short list. Fine-tuning changed what it knows, not how fast it reads.`,
      code_snippet: `# config/models.yaml
reranker:
  use: tuned                                   # base or tuned: the feature flag
  base: cross-encoder/ms-marco-MiniLM-L-6-v2   # the ready-made one
  tuned: models/reranker-v2                    # fine-tuned on train/pairs.jsonl
  keep_top: 3`,
      code_language: "yaml",
    },
    {
      id: "m06-s06",
      order_index: 6,
      kind: "exercise",
      title: "Hands-on: try it yourself",
      body_md: md`**Predict first:** how many points do you think fine-tuning will add on the held-out pairs? And for "${LAWYER_QUESTION}", which clause will the tuned re-ranker put first? Write both guesses down before you start.

:::tier guided
:::step Open your project and make this module's branch
**Where:** in your terminal (see Module 0 if you need a reminder of how to open it).

**Do:** go into your project folder, then make a **branch** called \`fine-tuned\` for this module. A branch is a named copy of your code. You're on Module 5's \`rerank\` branch, so the new one starts from your Module 5 work.

~~~bash
cd rag-course-project
git switch -c fine-tuned
~~~

**You should see:** \`Switched to a new branch 'fine-tuned'\`.

**If it didn't work:** if it says the branch already exists, you've started this before: run \`git switch fine-tuned\` instead. If \`cd\` can't find the folder, open a new terminal (it starts in your home folder) and try again.
:::

:::step See the problem with a lawyer's wording
**Where:** in your terminal, inside \`rag-course-project\`.

**Do:** ask your pipeline the subcontractor question the way Beta's lawyer words it, then the everyday way. Run the two lines one at a time:

~~~bash
uv run ask.py "${LAWYER_QUESTION}"
uv run ask.py "${RUNNING_QUESTION}"
~~~

**You should see:** for each, after up to a minute, the clauses your re-ranker kept, the routing tag and an answer. Write down which clause is listed first for each wording. In the lesson, the lawyer's wording put ${C.compelledDisclosure.section} Compelled Disclosure first, a clause about court orders, while the everyday wording put ${C.contractors.section} first. Your lists may differ a little; what matters is whether ${C.contractors.section} comes first.

**If it didn't work:** "No such file" means you're not in the project folder: run \`cd rag-course-project\` first. If \`ask.py\` stops with an error, start \`claude\`, paste the error and add "Please fix this."
:::

:::step Write the training pairs
**Where:** in Claude Code. Start it from your project folder:

~~~bash
claude
~~~

**Do:** a **training pair** is one question, one clause and a mark saying how well the clause answers it. Copy the whole box below, paste it into Claude Code and press Enter. It asks Claude Code to write about 100 pairs from the NDA and to put a fifth of the questions aside as your **held-out** set, which training never sees, so you can test fairly.

~~~prompt
Read data/nda.md. I want training pairs to fine-tune our re-ranker. Write them in two new files, one pair per line, each line like this:
{"question": "May the Receiving Party disclose to a subcontractor?", "clause": "§4.5", "label": 1.0}
- "clause" is the section exactly as it starts its paragraph in data/nda.md (§1.1, §1.4, §4.2(b), §4.5, §5, §7, §9) or "Signature block".
- "label" is 1.0 if the clause answers the question, 0.5 if it helps but doesn't settle it, and 0.0 if it's the wrong clause.
- Write 25 different questions someone at Beta might ask about this NDA, in different styles: plain words, a lawyer's words, short, long. Never put a section number or a clause title in a question.
- Include these two questions: "Can we share this with a subcontractor?" and "May the Receiving Party disclose to a subcontractor?". For both: §4.5 is 1.0, §4.2(b) and §1.4 are 0.5, §5 is 0.0, and §1.1 is 0.0.
- Give every question exactly 4 pairs: the clause that answers it (1.0); a clause that helps (0.5), or another wrong clause (0.0) if none helps; a hard negative (0.0), which is a wrong clause that shares words with the question; and one more wrong clause (0.0). For every question that says "disclose" or "disclosure" but isn't about a court order or the law, the hard negative is §5.
- Split by question: put 20 questions in train/pairs.jsonl (the training pairs) and the other 5 in train/heldout.jsonl (the held-out set). Keep both subcontractor questions in train/pairs.jsonl. Rewordings of the same question go in the same file, and no question may appear in both files.
When you're done, tell me how many lines each file has, and how many pairs have each label.
~~~

Claude Code asks before it creates or changes a file. When it asks, check it's the file you expected and choose **Yes**.

**You should see:** Claude Code reading \`data/nda.md\`, then creating the two files. It ends with the counts: about 80 lines in \`train/pairs.jsonl\` and about 20 in \`train/heldout.jsonl\`, with a mix of 1.0, 0.5 and 0.0 labels, mostly 0.0.

**If it didn't work:** if the counts are far off, or there are almost no 0.0 labels, paste this:

~~~prompt
Please check that train/pairs.jsonl and train/heldout.jsonl follow every rule in my last message, and fix them.
~~~
:::

:::step Check a sample by hand
**Where:** in Claude Code, still in your project.

**Do:** never train on pairs you haven't looked at. Paste this:

~~~prompt
Show me 10 pairs picked at random from train/pairs.jsonl, as a numbered list: the question, the clause's section and title, and the label. Don't change anything.
~~~

For each one, ask yourself: does that clause answer the question (1.0), help (0.5) or not (0.0)? If you're not sure, ask Claude Code to show you that clause's text from \`data/nda.md\`. If a label looks wrong, tell Claude Code, for example: "Pair 4 should be 0.0. Please fix it in the file."

**You should see:** ten pairs, nearly all with labels you agree with. Every "disclose" question should have ${C.compelledDisclosure.section} marked 0.0 somewhere in the file.

**If it didn't work:** if several labels look wrong, the pairs aren't ready to train on. Paste this:

~~~prompt
Several labels are wrong. Please re-check every pair in train/pairs.jsonl and train/heldout.jsonl against data/nda.md, fix them, and list what you changed.
~~~
:::

:::step Train the re-ranker
**Where:** in Claude Code, still in your project.

**Do:** copy the whole box, paste it into Claude Code and press Enter. It writes \`train_reranker.py\`, a **script** (a small program) that **fine-tunes** your re-ranker: it starts from the ready-made model you downloaded in Module 5 and trains it a little more on your pairs.

~~~prompt
Write train_reranker.py, run with uv, to fine-tune our re-ranker on train/pairs.jsonl.
- Start from the same ready-made cross-encoder that rerank() uses now (its name is in config/models.yaml), loaded with the sentence-transformers library's CrossEncoder.
- Look up each pair's clause text in data/nda.md by its section. The model reads the question and the clause text together, and the label is the score it should learn.
- Write the training loop yourself with PyTorch, which came with sentence-transformers, so no new libraries are needed. Use binary cross-entropy loss on the model's raw score, AdamW with learning rate 0.00003, shuffled batches of 8 pairs, 3 epochs and random seed 42. Run on the computer's processor: it must work on an ordinary laptop.
- Before training and after each epoch, measure two things on train/heldout.jsonl, which must never be trained on: the held-out loss, and the held-out score. The held-out score is a percentage: for each held-out question, compare every two of its pairs that have different labels, and count it right if the higher label got the higher score.
- Print a table with one line per epoch: epoch, training loss, held-out loss, held-out score. Epoch 0 is the ready-made model before any training.
- Save to models/reranker-v2/ the epoch (1 to 3) with the best held-out score, and at the end print which epoch was kept.
- Add models/ to .gitignore: the trained model is too big to send to GitHub, and this script can rebuild it.
Then run uv run train_reranker.py and show me the table.
~~~

**You should see:** Claude Code asking permission to create files and run commands: choose **Yes** each time. There's no big download this time, because the ready-made re-ranker is already on your computer from Module 5. Training takes one to five minutes. It ends with a table of four lines, epochs 0 to 3. **Loss** is a number for how wrong the model's scores are, so lower is better. Both losses should fall after epoch 0. If the held-out loss rises at epoch 2 or 3, that's the moment training should have stopped (overfitting), and why the script keeps the best epoch, not the last. Write down the epoch it kept and its held-out score.

**If it didn't work:** if it stops with an error it doesn't fix by itself, copy the error, paste it back, and add "Please fix this." If training runs for more than 15 minutes, press Esc and paste: "Training is too slow on my computer. Please use batches of 4 and 2 epochs."
:::

:::video m06-train-reranker
:::

:::step Add the switch between base and tuned
**Where:** in Claude Code, still in your project.

**Do:** you now have two re-rankers: the **base model** you downloaded, and your fine-tuned one in \`models/reranker-v2/\`. A **feature flag** is one setting that picks between them, so you can compare them and switch back in seconds without changing any code. Paste this:

~~~prompt
Add a feature flag for the re-ranker.
- In config/models.yaml, put the re-ranker settings under "reranker:" with "use: tuned", "base:" set to the ready-made model name that's there now, and "tuned: models/reranker-v2". Keep any other re-ranker settings, such as how many clauses to keep.
- Make rerank() load the model that "use:" names. If "use" is tuned but the folder models/reranker-v2 doesn't exist (for example on a fresh copy of the project), print a warning and use the base model.
- Write compare_rerankers.py, run with uv. It loads both re-rankers and prints: the held-out score of each on train/heldout.jsonl, measured the same way as train_reranker.py; then, for "Can we share this with a subcontractor?" and for "May the Receiving Party disclose to a subcontractor?", the top 3 clauses each re-ranker picks (section, title, score), both from the same candidates, found with retrieve() and clean() the way ask.py finds them.
Then run uv run compare_rerankers.py and show me the output.
~~~

**You should see:** Claude Code changing \`config/models.yaml\` and your re-ranking code, creating \`compare_rerankers.py\`, and running it (it asks first: choose **Yes**). The output has two held-out scores, base and tuned, then a top 3 from each re-ranker for each wording.

**If it didn't work:** if it says it can't find \`models/reranker-v2\`, the training in step 5 didn't save a model. Paste this:

~~~prompt
Run train_reranker.py again and make sure it saves the kept epoch to models/reranker-v2/.
~~~
:::

:::step Compare base and tuned yourself
**Where:** in your terminal. Leave Claude Code first: type \`/exit\` and press Enter.

**Do:** run the comparison, then ask the lawyer's question again through the whole pipeline, now with the tuned re-ranker:

~~~bash
uv run compare_rerankers.py
uv run ask.py "${LAWYER_QUESTION}"
~~~

**You should see:** the same comparison as before, then the pipeline's clauses and answer. Write down three things and check them against your predictions: the held-out score for base and for tuned; which clause each re-ranker puts first for the lawyer's wording; and which clause the answer now starts from. In the lesson, tuning lifted the held-out score and moved ${C.contractors.section} to first place. With only 100 pairs, your gain may be smaller, or ${C.contractors.section} may still miss first place. That's a real result, not a mistake: write it down, because the next part, with less help, adds more pairs.

**If it didn't work:** if both re-rankers give exactly the same scores, the flag isn't being read: start \`claude\` and paste this:

~~~prompt
Why do both re-rankers give the same scores? Check that rerank() and compare_rerankers.py read "use:" from config/models.yaml, and fix it.
~~~
:::

:::video m06-compare-rerankers
:::

:::step Save your work and send it to GitHub
**Where:** in your terminal, inside \`rag-course-project\`.

**Do:** run these three lines one at a time. The first picks up every new and changed file, the second **commits** them (saves a snapshot with a note), and the third **pushes** the branch to GitHub, so it's backed up. The trained model itself stays on your computer, because \`.gitignore\` (a list of files Git should leave out) now names the \`models/\` folder; \`train_reranker.py\` can always rebuild it.

~~~bash
git add -A
git commit -m "Module 6: fine-tuned re-ranker behind a feature flag"
git push -u origin fine-tuned
~~~

**You should see:** after the commit, a line like \`[fine-tuned 1a2b3c4] Module 6: fine-tuned re-ranker behind a feature flag\`. After the push, a line saying the branch \`fine-tuned\` is set up to track \`origin/fine-tuned\`. On GitHub, your project now has a \`fine-tuned\` branch.

**If it didn't work:** if the push is refused because a file is larger than GitHub allows, the model folder slipped in. Start \`claude\` and paste this, then run the push line again:

~~~prompt
My push failed because the models/ folder was committed. Add models/ to .gitignore and take it out of my last commit, keeping the files on my computer.
~~~
:::
:::

:::tier partial
Now teach the re-ranker your team's own words, and watch for overfitting.

1. Start Claude Code in your project, as in Guided step 3, and ask it to write 15 more questions the way your team really talks, each with 4 pairs and a hard negative (${C.compelledDisclosure.section} for every "disclose" question is a good start). Add them to \`train/pairs.jsonl\` only, and leave \`train/heldout.jsonl\` exactly as it is, so the comparison stays fair. Check a sample, as in Guided step 4.
2. Ask Claude Code to let \`train_reranker.py\` take the number of epochs, and run it for 8. In the table, find the epoch where the held-out loss stops falling: that's where training should stop. Keeping the best epoch (Guided step 5) protects you from overfitting.
3. Run the comparison from Guided step 7. Did the held-out score move compared with your first run? Then save and push, as in Guided step 8.
:::

:::tier solo
Try the cheaper fix properly instead. Set the flag in \`config/models.yaml\` back to \`base\` (Guided step 6). Change \`prompts/rewrite.md\` from Module 2 so the rewrite turns lawyer's words into everyday ones, and have the re-ranker read the rewritten question instead of the original. Measure it the same way as Guided step 7, on both wordings and on the held-out questions. Which was the better investment, the rewrite prompt or fine-tuning? Argue it with numbers, set the flag to the winner, then commit and push.
:::

**Files you create:** \`train/pairs.jsonl\` and \`train/heldout.jsonl\`, your training and held-out pairs, one per line; \`train_reranker.py\`, which fine-tunes the re-ranker; \`models/reranker-v2/\`, the folder holding the fine-tuned re-ranker (on your computer only); \`compare_rerankers.py\`, which compares base and tuned; and the re-ranker feature flag in \`config/models.yaml\`.

**Capstone branch:** save this work on a branch called \`fine-tuned\` in your course project. It needs a re-ranker you can swap, a feature flag that picks base or tuned, and the held-out pairs saved alongside the code.

**Check it with your assistant:** ask your coding assistant, "Does my fine-tuned branch keep train/heldout.jsonl out of training, switch between the base and tuned re-rankers with one feature flag in config/models.yaml, fall back to the base model when models/reranker-v2 is missing, and print the held-out score for both?"`,
    },
    {
      id: "m06-s07",
      order_index: 7,
      kind: "concept",
      title: "When fine-tuning isn't the answer",
      body_md: `Fine-tuning worked here. But it's slow, it costs money, and the pairs go out of date when your contracts change. Most problems have a cheaper fix, so check before you reach for it.

Fine-tune only when all three are true:

1. **You have at least a few hundred training pairs,** each marked and checked. We had about 230.
2. **The failure is systematic, not a one-off.** Every question a lawyer words with "disclose" pulled ${C.compelledDisclosure.section} up. That's a pattern, not a fluke.
3. **You've run out of cheaper fixes.** We tried the rewrite first, and it only half worked.

Here's how that plays out on our NDA:

- ${C.contractors.section} is missing from the results because the index was built before Amendment No. 1 → **rebuild the index.** No training will find a clause that isn't there.
- One person's oddly worded question misses once → **add a row to the synonym table** (Module 2).
- Every lawyer-worded question puts ${C.compelledDisclosure.section} first → **fine-tune.** That's today.

Think of it as hiring a specialist versus giving your generalist a better filing system. Try the filing system first.`,
    },
  ],

  worked_example: [
    {
      id: "m06-w01",
      order_index: 1,
      title: "The question, in a lawyer's words",
      body_md: `Beta's lawyer asks the subcontractor question their way. The earlier stages run as before: the rewrite adds "third party, Permitted Recipient, contractor", search finds about 40 candidates, and cleaning leaves 10, with ${C.contractors.section} among them.`,
      stage: null,
      query_state: `"${LAWYER_QUESTION}"`,
    },
    {
      id: "m06-w02",
      order_index: 2,
      title: "The ready-made re-ranker is fooled",
      body_md: `The base model reads the question next to each of the 10 clauses and scores them:

1. ${C.compelledDisclosure.section} ${C.compelledDisclosure.title}: 0.91
2. ${C.permittedDisclosure.section} ${C.permittedDisclosure.title}: 0.88
3. ${C.definitions.section} ${C.definitions.title}: 0.79
4. ${C.contractors.section} ${C.contractors.title}: 0.64

It keeps the top 3, so ${C.contractors.section} is cut. "Disclose" in the question matched "disclose" in ${C.compelledDisclosure.section}, and that's what a model trained on web searches rewards.`,
      stage: "re-rank",
      query_state: `Top 3: ${C.compelledDisclosure.section}, ${C.permittedDisclosure.section}, ${C.definitions.section}. ${C.contractors.section} is 4th and cut.`,
    },
    {
      id: "m06-w03",
      order_index: 3,
      title: "Build the training pairs",
      body_md: `Start from the 30 pairs you wrote in Module 5 and generate about 200 more, then split them: 80% to train on, 20% held out. Every lawyer-worded question gets ${C.contractors.section} marked 1, ${C.permittedDisclosure.section} and ${C.permittedRecipient.section} marked 0.5, and ${C.compelledDisclosure.section} marked 0 as a hard negative.`,
      code_snippet: `{"question": "${LAWYER_QUESTION}", "clause": "§4.5", "label": 1.0}
{"question": "${LAWYER_QUESTION}", "clause": "§5", "label": 0.0}`,
      code_language: "json",
      stage: "re-rank",
      query_state: "About 230 pairs: 184 to train on, 46 held out. Hard negatives teach \"disclose\" isn't enough.",
    },
    {
      id: "m06-w04",
      order_index: 4,
      title: "Train, and stop at the right time",
      body_md: `Train and watch the loss curve. Both lines fall until epoch 3, as the re-ranker learns that "contractor", not "disclose", is what points to §4.5. After that the held-out line starts to rise, so the model saved at epoch 3 is the one you keep. Training on to epoch 10 would score 99% on the training pairs and only 76% on the held-out ones: overfitting.`,
      stage: "re-rank",
      query_state: "A fine-tuned re-ranker, saved at epoch 3 in models/reranker-v2.",
    },
    {
      id: "m06-w05",
      order_index: 5,
      title: "Compare base and tuned",
      body_md: `Flip the feature flag in \`config/models.yaml\` and score the same 10 clauses again with the tuned re-ranker:

1. ${C.contractors.section} ${C.contractors.title}: 0.94
2. ${C.permittedDisclosure.section} ${C.permittedDisclosure.title}: 0.81
3. ${C.permittedRecipient.section} ${C.permittedRecipient.title}: 0.74

${C.compelledDisclosure.section} drops to 0.22. The plain wording, "${RUNNING_QUESTION}", still puts ${C.contractors.section} first too. On the held-out pairs: 71% before, 84% after.`,
      stage: "re-rank",
      query_state: `Top 3 for both wordings: ${C.contractors.section}, ${C.permittedDisclosure.section}, ${C.permittedRecipient.section}.`,
    },
    {
      id: "m06-w06",
      order_index: 6,
      title: "The answer",
      body_md: `With ${C.contractors.section} read first, the writer gives Module 5's answer again, now for the lawyer's wording too:

> "Disclosure to contractors needs the Disclosing Party's prior written consent (${C.contractors.section}). Under ${C.permittedDisclosure.section} you may also share with Permitted Recipients."

The right clause leads. The second sentence is still muddled, because a subcontractor isn't a Permitted Recipient. That's a writing problem, not a ranking one, and Module 10 fixes it.`,
      stage: "generation",
      query_state: `Answered from ${C.contractors.section} first, for both wordings. The second route is still muddled.`,
    },
  ],

  // Every term a learner meets in this module (tests/unit/glossary-coverage.test.ts
  // checks none is missing): contract words first, then the rest.
  glossary: [
    "nda", "clause", "section-sign", "subcontractor", "third-party", "permitted-recipient", "confidential-information",
    "disclosing-party", "receiving-party", "affiliate", "amendment", "notwithstanding", "written-consent",
    "re-rank", "cross-encoder", "fine-tuning", "base-model", "training-pair", "hard-negative", "held-out-set", "data-leakage",
    "epoch", "loss-curve", "overfitting", "feature-flag", "roll-back", "language-model", "prompt", "prompt-file", "query-rewriting",
    "synonym-table", "settings-file", "index", "candidate", "deduplication", "routing-tag", "loss", "gitignore",
    "terminal", "folder", "command", "script", "claude-code", "git", "github", "branch", "commit", "push",
  ],

  study_guide: [
    {
      id: "m06-p01",
      order_index: 1,
      point: `A ready-made re-ranker learned from web searches, where a shared word means a match. So "${LAWYER_QUESTION}" puts ${C.compelledDisclosure.section} first, just because it also says "disclose".`,
      narration: `Watch the same question asked two ways. In plain words, ${C.contractors.section} comes first. In a lawyer's words, ${C.compelledDisclosure.section} jumps to the top, because "disclose" appears in both. The re-ranker has never read a contract, where that word is everywhere.`,
    },
    {
      id: "m06-p02",
      order_index: 2,
      point: "Fine-tuning trains the ready-made model a little more on your own examples, so it learns one job better.",
      narration: `See the base model on one side and your training pairs on the other. A few passes through the pairs nudge the model's numbers, until "contractor" counts for more than "disclose". The model is the same size; it just knows legal wording better.`,
    },
    {
      id: "m06-p03",
      order_index: 3,
      point: `A training pair is a question, a clause and a mark. Hard negatives, like ${C.compelledDisclosure.section} for a "disclose" question, teach the most.`,
      narration: `Follow one question into three pairs: ${C.contractors.section} marked 1, ${C.permittedDisclosure.section} marked 0.5, ${C.compelledDisclosure.section} marked 0. That last one looks right but isn't. Those look-alikes are exactly the mistakes you want the re-ranker to stop making.`,
    },
    {
      id: "m06-p04",
      order_index: 4,
      point: "Split off a held-out set before anything else, and never train on it. If held-out pairs leak into training, the test score lies.",
      narration: `Watch 20% of the pairs go into a locked box before training starts. The re-ranker never sees them. Afterwards you open the box and test. If copies of those questions had slipped into training, the score would jump, and nobody using the system would feel it.`,
    },
    {
      id: "m06-p05",
      order_index: 5,
      point: "Read the loss curve: stop when the held-out line stops falling. Training on after that is overfitting.",
      narration: `See two lines fall together, then split at epoch 3. The training line keeps dropping; the held-out line turns up. From there the model is memorising its pairs, not learning. Stop at the bottom of the held-out line: 84% instead of 76%.`,
    },
    {
      id: "m06-p06",
      order_index: 6,
      point: "Keep the base model behind a feature flag, and fine-tune only with a few hundred pairs, a systematic failure and no cheaper fix left.",
      narration: `Watch one word in the settings file switch the re-ranker from base to tuned and back. That switch lets you compare them and roll back in seconds. And before training at all, check the cheap fixes: a rebuilt index or a synonym often does the job.`,
    },
  ],

  quiz_items: [
    {
      id: "m06-q01",
      lesson_step_id: "m06-s02",
      order_index: 1,
      kind: "single_choice",
      prompt: `Why did the ready-made re-ranker put ${C.compelledDisclosure.section} Compelled Disclosure first for "${LAWYER_QUESTION}"?`,
      choices: [
        { id: "a", text: `${C.compelledDisclosure.section} is the clause that answers the question` },
        { id: "b", text: `It learned from web searches, where sharing a word like "disclose" usually means a match` },
        { id: "c", text: "The cross-encoder can only read the first clause in the list" },
        { id: "d", text: `${C.contractors.section} was missing from the index` },
      ],
      answer: { choice: "b" },
      explanation: `Trained on web searches, it treats a shared word as a strong sign of a match. In a contract, "disclose" is in almost every clause, so it misleads.`,
      difficulty: 1,
    },
    {
      id: "m06-q02",
      lesson_step_id: "m06-s07",
      order_index: 2,
      kind: "single_choice",
      prompt: "Which of these is not part of the rule for when to fine-tune?",
      choices: [
        { id: "a", text: "You have at least a few hundred marked training pairs" },
        { id: "b", text: "The failure is systematic, not a one-off" },
        { id: "c", text: "One lawyer's question ranked wrong once" },
        { id: "d", text: "You've run out of cheaper fixes, like the rewrite and the synonym table" },
      ],
      answer: { choice: "c" },
      explanation: "A single miss is a one-off. Try a synonym or a rewrite first; fine-tune only when the same mistake keeps happening.",
      difficulty: 2,
    },
    {
      id: "m06-q03",
      lesson_step_id: "m06-s03",
      order_index: 3,
      kind: "multi_choice",
      prompt: `Which clauses make good hard negatives for "${LAWYER_QUESTION}"?`,
      choices: [
        { id: "a", text: `${C.compelledDisclosure.section} Compelled Disclosure: it also says "disclose" but is about court orders` },
        { id: "b", text: `${C.definitions.section} Definitions: it's about Confidential Information but doesn't answer the question` },
        { id: "c", text: `${C.contractors.section} Contractors: the clause that answers it` },
        { id: "d", text: `${C.governingLaw.section} Governing Law: obviously unrelated` },
      ],
      answer: { choices: ["a", "b"] },
      explanation: `A hard negative is wrong but looks right. ${C.contractors.section} is the right answer, and ${C.governingLaw.section} is too obviously wrong to teach anything.`,
      difficulty: 2,
    },
    {
      id: "m06-q04",
      lesson_step_id: "m06-s04",
      order_index: 4,
      kind: "single_choice",
      prompt: "Trained for 10 epochs, the re-ranker scores 99% on its training pairs but only 76% on the held-out pairs. What does that show?",
      choices: [
        { id: "a", text: "The held-out pairs were marked wrongly" },
        { id: "b", text: "Overfitting: it memorised its training pairs instead of learning what makes a clause answer a question" },
        { id: "c", text: "The base model was better at everything" },
        { id: "d", text: "The held-out set was too large" },
      ],
      answer: { choice: "b" },
      explanation: "A big gap between training and held-out scores is the sign of overfitting. Stopping at epoch 3 gave 84%.",
      difficulty: 2,
    },
    {
      id: "m06-q05",
      lesson_step_id: "m06-s04",
      order_index: 5,
      kind: "single_choice",
      prompt: "Reading the loss curve, when should training have stopped?",
      choices: [
        { id: "a", text: "When the training line reaches zero" },
        { id: "b", text: "When the held-out line stops falling and starts to rise" },
        { id: "c", text: "After exactly 10 epochs" },
        { id: "d", text: "As soon as the first epoch finishes" },
      ],
      answer: { choice: "b" },
      explanation: "After that point the model is memorising its training pairs, not learning.",
      difficulty: 2,
    },
    {
      id: "m06-q06",
      lesson_step_id: "m06-s04",
      order_index: 6,
      kind: "single_choice",
      prompt: `Near-copies of "${RUNNING_QUESTION}" ended up in both the training pairs and the held-out pairs. What happens to the held-out score?`,
      choices: [
        { id: "a", text: "It looks better than the re-ranker really is" },
        { id: "b", text: "It drops to zero" },
        { id: "c", text: "Nothing, because duplicates are ignored" },
        { id: "d", text: "It becomes more accurate" },
      ],
      answer: { choice: "a" },
      explanation: "That's leakage: the re-ranker has already seen those answers, so the score overstates how it does on new questions. Split first.",
      difficulty: 2,
    },
    {
      id: "m06-q07",
      lesson_step_id: "m06-s05",
      order_index: 7,
      kind: "short_answer",
      prompt: "What do you call the one setting in config/models.yaml that switches between the base and the fine-tuned re-ranker, without changing code?",
      answer: { accepted: ["feature flag", "a feature flag", "the feature flag", "flag"] },
      explanation: "A feature flag lets you compare both re-rankers on the same questions and switch back in seconds.",
      difficulty: 1,
    },
  ],

  failure_cases: [
    {
      id: "m06-f01",
      order_index: 1,
      title: "The re-ranker that memorised",
      category: "ranking",
      user_query: "Can our subcontractor's engineers look at Acme's drawings?",
      retrieved_context: [
        { source: cite(C.definitions), text: C.definitions.text, score: 0.96 },
        { source: cite(C.compelledDisclosure), text: C.compelledDisclosure.text, score: 0.93 },
        { source: cite(C.term), text: C.term.text, score: 0.9 },
      ],
      bad_output: `"Drawings count as Confidential Information if they're marked confidential or would reasonably be understood to be." (${C.definitions.section} Definitions)`,
      symptom: `The tuned re-ranker scored 99% on its training pairs, but for new wordings like this one it puts ${C.contractors.section} 5th.`,
      root_cause: `It was trained for 10 epochs and memorised the exact wordings of its training pairs, instead of learning what makes a clause answer a question. A wording it never saw matches nothing it memorised.`,
      fix: "Stop training when the held-out line on the loss curve stops falling (epoch 3 here), add more varied wordings to the pairs, and test on questions the team really asked.",
      cause_options: [
        { id: "a", text: "The training went far too slowly for the model to learn anything" },
        { id: "b", text: "It memorised the training pairs" },
        { id: "c", text: "The base model can't read legal text at all" },
      ],
      correct_cause: "b",
    },
    {
      id: "m06-f02",
      order_index: 2,
      title: "The leaky held-out set",
      category: "evaluation",
      user_query: RUNNING_QUESTION,
      retrieved_context: [
        { source: cite(C.contractors), text: C.contractors.text, score: 0.97 },
        { source: cite(C.permittedDisclosure), text: C.permittedDisclosure.text, score: 0.84 },
        { source: cite(C.permittedRecipient), text: C.permittedRecipient.text, score: 0.76 },
      ],
      bad_output: `The held-out score jumps to 97%. But Beta's team sees no change on new wordings, and 40 of the 46 held-out pairs, including this question with ${C.contractors.section}, also appear in train/pairs.jsonl.`,
      symptom: "A huge jump on the held-out score that nobody using the system can feel.",
      root_cause: "The extra pairs were generated before the split, so near-copies of each held-out question, this one included, went into training too. The re-ranker had already seen the answers.",
      fix: "Split the pairs first, then generate extras from the training side only. Remove near-duplicates across the split, and check that no held-out question appears in training.",
      cause_options: [
        { id: "a", text: "The held-out set was too small to measure anything useful" },
        { id: "b", text: "The re-ranker was trained for too few epochs to learn" },
        { id: "c", text: "Held-out pairs also appeared in training" },
      ],
      correct_cause: "c",
    },
    {
      id: "m06-f03",
      order_index: 3,
      title: "Better score, worse answers",
      category: "evaluation",
      user_query: LAWYER_QUESTION,
      retrieved_context: [
        { source: cite(C.permittedDisclosure), text: C.permittedDisclosure.text, score: 0.96 },
        { source: cite(C.compelledDisclosure), text: C.compelledDisclosure.text, score: 0.9 },
        { source: cite(C.contractors), text: C.contractors.text, score: 0.71 },
      ],
      bad_output: `"Yes, to Affiliates and Permitted Recipients bound by written confidentiality obligations." (${C.permittedDisclosure.section} ${C.permittedDisclosure.title})`,
      symptom: "The held-out score rose 9 points, but Beta's lawyers say the answers got worse.",
      root_cause: `The generated questions copied each clause's own wording, so the held-out pairs rewarded word-matching. "The Receiving Party may disclose" in ${C.permittedDisclosure.section} now beats ${C.contractors.section}. Real questions don't copy the NDA.`,
      fix: "Generate questions in the words people actually use, score the tuned re-ranker on real team questions as well as held-out pairs, and keep the base model behind the feature flag until both improve.",
      cause_options: [
        { id: "a", text: "Generated questions copied the clauses' wording" },
        { id: "b", text: "The writer's prompt was changed in the same week as the training run" },
        { id: "c", text: "The feature flag was still set to the base model" },
      ],
      correct_cause: "a",
    },
  ],
};

export default m06;
