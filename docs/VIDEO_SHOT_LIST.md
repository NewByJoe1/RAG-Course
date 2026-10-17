# Video shot list

Every spot in the course where a short how-to video would help. Each clip appears on the lesson page as "Video coming soon" until it's recorded.

Generated from `content/video-clips/` by `npm run video-list`. Don't edit by hand.

Clips: 37 in all. Recordable on a Mac: 31. Need a Windows PC: 3. Need a Linux computer: 3.

## Module 0: Set up your workshop

| Clip | What it should show | Record on |
| --- | --- | --- |
| `m00-open-terminal-mac` | Opening Terminal with Cmd+Space, and what the window and the % line look like. | Mac |
| `m00-open-terminal-windows` | Opening Windows PowerShell from the Start menu (not the x86 one), and spotting the PS line. | Windows |
| `m00-open-terminal-linux` | Opening a terminal with Ctrl+Alt+T on Ubuntu, and pasting with Ctrl+Shift+V. | Linux |
| `m00-install-claude-code-mac` | Pasting the Claude Code install command, waiting through the silence, and the success message. | Mac |
| `m00-install-claude-code-windows` | Running the PowerShell install command for Claude Code and checking claude --version in a new window. | Windows |
| `m00-install-claude-code-linux` | Running the Claude Code install command on Ubuntu and checking claude --version. | Linux |
| `m00-claude-sign-in` | First run of claude: picking a theme, signing in through the browser, and leaving with /exit. | Any (recordable on your Mac) |
| `m00-github-signup` | Creating a GitHub account at github.com/signup, including the emailed code. | Any (recordable on your Mac) |
| `m00-install-gh-mac` | Installing Homebrew (password prompt, Next steps lines) and then brew install gh. | Mac |
| `m00-install-gh-windows` | Installing the GitHub CLI with winget and reopening PowerShell to check gh --version. | Windows |
| `m00-install-gh-linux` | Installing Git and the GitHub CLI on Ubuntu with the official apt commands. | Linux |
| `m00-gh-auth-login` | gh auth login from start to finish: the four answers, the one-time code and the browser approval. | Any (recordable on your Mac) |
| `m00-template-copy` | Copying the course template with gh repo create, then cd into the folder and ls. | Any (recordable on your Mac) |
| `m00-first-claude-question` | Running git status, starting claude in the project, trusting the folder, and asking the first question. | Any (recordable on your Mac) |

## Module 1: RAG Foundations

| Clip | What it should show | Record on |
| --- | --- | --- |
| `m01-install-uv` | Installing uv with the official command, opening a new terminal, and checking uv --version. | Mac |
| `m01-first-build` | Pasting the NDA and the build prompt into Claude Code, approving each step, and reading the top 5 output. | Any (recordable on your Mac) |
| `m01-commit-push` | Leaving Claude Code, then git add, git commit and git push for the naive-rag branch, and the branch on GitHub. | Any (recordable on your Mac) |

## Module 2: Pre-Retrieval

| Clip | What it should show | Record on |
| --- | --- | --- |
| `m02-rewrite-search` | Pasting the rewrite prompt into Claude Code, approving each step, and reading the searches and the new top 5 for the subcontractor question. | Any (recordable on your Mac) |
| `m02-tag-and-answer` | Leaving Claude Code and running ask.py on the subcontractor and "How long" questions: the tag, the model picked and the cited answer. | Any (recordable on your Mac) |

## Module 3: Retrieval

| Clip | What it should show | Record on |
| --- | --- | --- |
| `m03-keyword-search` | Pasting the keyword-search prompt into Claude Code, approving the rank-bm25 library, and comparing the meaning and keyword top 5 for the Section 4.5 question. | Any (recordable on your Mac) |
| `m03-compare-tally` | Leaving Claude Code, running ask.py to find the §4.5 arrow in the merged list, then compare.py and reading the ten-question tally. | Any (recordable on your Mac) |

## Module 4: Post-Retrieval

| Clip | What it should show | Record on |
| --- | --- | --- |
| `m04-build-clean` | Pasting the clean() prompt into Claude Code, approving each step, reading the clean: log, then try_clean.py catching the copies. | Any (recordable on your Mac) |
| `m04-read-clean-log` | Leaving Claude Code, running ask.py on two questions, and reading the three counts, the threshold and where §4.5 sits. | Any (recordable on your Mac) |

## Module 5: Re-Ranking

| Clip | What it should show | Record on |
| --- | --- | --- |
| `m05-add-reranker` | Pasting the re-ranker prompt into Claude Code, approving the big first download, and reading the before-and-after places. | Any (recordable on your Mac) |
| `m05-before-after-table` | Leaving Claude Code, running check_rerank.py and ask.py, and reading the ten-question table and the 1st-place count. | Any (recordable on your Mac) |

## Module 6: Fine-Tuning

| Clip | What it should show | Record on |
| --- | --- | --- |
| `m06-train-reranker` | Pasting the training prompt into Claude Code, approving each step, and reading the epoch table: losses falling, the best epoch kept. | Any (recordable on your Mac) |
| `m06-compare-rerankers` | Running uv run compare_rerankers.py, then reading base versus tuned: the held-out scores and the top 3 for both wordings. | Any (recordable on your Mac) |

## Module 7: Refinement

| Clip | What it should show | Record on |
| --- | --- | --- |
| `m07-build-eval` | Pasting the evaluate.py prompt into Claude Code, approving each step, and the report printing one golden-set row at a time. | Any (recordable on your Mac) |
| `m07-read-report` | Running uv run evaluate.py --saved, then finding the subcontractor row nda-001 and the five worst rows in the report. | Any (recordable on your Mac) |

## Module 8: Automation

| Clip | What it should show | Record on |
| --- | --- | --- |
| `m08-gh-run-watch` | Pushing the automation branch, then gh run watch: picking the run, steps ticking off, and the run ending in success. | Any (recordable on your Mac) |
| `m08-actions-tab` | gh browse, the Actions tab, a run's steps and its eval-results artifact, then gh run download and reading results.json. | Any (recordable on your Mac) |

## Module 9: Production Harness

| Clip | What it should show | Record on |
| --- | --- | --- |
| `m09-harness-question` | Asking the subcontractor question through uv run harness.py, and reading the reply, the gate results and the customer of each clause. | Any (recordable on your Mac) |
| `m09-kill-switch` | Asking Claude Code to switch serving.enabled off, the instant switched-off reply, then switching it back on. | Any (recordable on your Mac) |

## Module 10: Contract Analysis Domain

| Clip | What it should show | Record on |
| --- | --- | --- |
| `m10-clause-tree` | Pasting the parser prompt into Claude Code, approving each step, and reading the clause tree: §4.2(b) whole, §4.5 marked overrides §4.2. | Any (recordable on your Mac) |
| `m10-correct-answer` | Running ask.py with the subcontractor question and reading it: §4.5 first, the conflicting tag, one answer and the ✓ citation lines. | Any (recordable on your Mac) |

## Module 11: Datasets and Fine-Tuning for Legal Citations

| Clip | What it should show | Record on |
| --- | --- | --- |
| `m11-cuad-pairs` | Downloading the 200-clause CUAD slice through Claude Code, building the training pairs, and reading three hard negatives. | Any (recordable on your Mac) |
| `m11-before-after` | Training the embedding model, re-indexing into index-legal/, and reading the base vs legal recall@3 table. | Any (recordable on your Mac) |
