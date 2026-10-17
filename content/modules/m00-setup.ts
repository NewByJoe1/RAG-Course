import type { ModuleContent } from "../types";
import { md } from "../md";

// Module 0: set up the workshop the hands-on steps use, for someone who has
// never opened a terminal. No quiz: ticking "My setup works" on the last tab
// unlocks Module 1 (public.complete_setup(), migration 0011).
//
// Install commands are the official ones, checked October 2026:
//   Claude Code  code.claude.com/docs/en/setup and /terminal-guide
//   GitHub CLI   github.com/cli/cli/blob/trunk/docs/install_{macos,windows,linux}.md
//   Homebrew     brew.sh
//   Git          git-scm.com/downloads/win (Windows)
// Every hands-on Guided tier in Modules 1–11 starts from what this module sets
// up: a terminal, Claude Code, Git, the GitHub CLI signed in, and the project
// folder rag-course-project in the home folder.

export const PROJECT = "rag-course-project";
export const TEMPLATE = "NewByJoe1/rag-course-template";

const m00: ModuleContent = {
  id: "m00",
  slug: "setup",
  order_index: 0,
  title: "Set up your workshop",
  summary:
    "Get your computer ready for the course, even if you've never used a terminal: open one, install Claude Code, make a GitHub account, copy the course template and run your first command.",
  hook: `Before you can build an assistant that answers "Can we share this with a subcontractor?", you need a workshop: a terminal to type in, Claude Code to write code with you, and a GitHub account to keep your work safe. This module sets all of it up, one small step at a time, even if you've never opened a terminal before.`,
  learning_objectives: [
    "Open a terminal on your computer and run a command in it",
    "Install Claude Code and sign in to it",
    "Make a GitHub account and connect your computer to it",
    "Make your own copy of the course template and download it",
    "Run one command in your project and check that it worked",
  ],
  estimated_minutes: 60,
  is_published: true,
  pipeline_stages: [],
  explain_back_prompt: null,
  video: null,

  lesson_steps: [
    {
      id: "m00-s01",
      order_index: 1,
      kind: "warm_up",
      title: "What you'll need",
      body_md: md`You don't need to know anything about programming. You do need a few things to hand:

1. **A computer** running one of these: a Mac with macOS 13 or newer, a Windows 10 or 11 computer, or a Linux computer such as Ubuntu 20.04 or newer. Phones and tablets won't work.
2. **An internet connection** and about an hour.
3. **A Claude account on a paid plan** (Pro or Max). Claude Code isn't included in the free plan.
4. **An email address** for your GitHub account.

Every page from here on starts with a small box saying which computer you're on. Pick yours, and the steps will show only what applies to you.

Each step has four parts: **where** to do it, what to **do**, what **you should see** when it worked, and what to do **if it didn't work**. Do the steps in order, and don't skip the checks: they catch problems early, when they're easy to fix.`,
    },
    {
      id: "m00-s02",
      order_index: 2,
      kind: "concept",
      title: "Open your terminal",
      body_md: md`A **terminal** is a window where you type instructions to your computer instead of clicking. Each instruction is called a **command**. It looks old-fashioned, but it's the most direct way to work with the tools in this course, and Claude Code lives there too.

You'll never need to memorise commands. Every one is in a box with a **Copy** button: copy it, paste it into the terminal, and press Enter.

:::step Open the terminal
:::mac
**Where:** anywhere on your Mac.

**Do:** press Cmd and Space together to open Spotlight, the Mac's search box. Type Terminal and press Enter.

**You should see:** a window with a line of text ending in a % sign and a blinking cursor. That's where you type.

**If it didn't work:** open Finder, go to Applications, then Utilities, and double-click Terminal.
:::
:::windows
**Where:** anywhere on your computer.

**Do:** press the Windows key, type PowerShell, and click **Windows PowerShell** (not the one ending in "(x86)"). On Windows 11 you can also choose **Terminal**, which opens PowerShell inside it.

**You should see:** a window with a line like \`PS C:\Users\Sam>\` (with your name), then a blinking cursor. PowerShell is the terminal that comes with Windows.

**If it didn't work:** if the line starts with \`C:\` but has no \`PS\` in front, you're in Windows' older terminal, \`Command Prompt\`. Close it and open PowerShell as above.
:::
:::linux
**Where:** anywhere on your computer.

**Do:** press Ctrl, Alt and T together. If nothing happens, open your applications menu and search for Terminal.

**You should see:** a window with a line ending in a $ sign and a blinking cursor.

**If it didn't work:** on some Linux versions the app has a different name, such as Konsole. Search your applications for "terminal".
:::
:::

:::video m00-open-terminal-mac
:::

:::video m00-open-terminal-windows
:::

:::video m00-open-terminal-linux
:::

:::step Run your first command
**Where:** in your terminal.

**Do:** click Copy on the box below, click inside the terminal, paste, and press Enter.

~~~bash
echo hello
~~~

:::mac
To paste on a Mac, press Cmd and V.
:::
:::windows
To paste in PowerShell, press Ctrl and V, or right-click.
:::
:::linux
To paste in a Linux terminal, press Ctrl, Shift and V (Ctrl and V on its own doesn't work there).
:::

**You should see:** the word hello on the next line. echo is a command that repeats back whatever you give it.

**If it didn't work:** if you see "command not found" or "not recognized", something was pasted wrongly. Delete the line with Backspace, then copy and paste it again. Nothing you type here can harm your computer.
:::

:::step Find out which folder you're in
**Where:** in your terminal.

**Do:** paste this and press Enter. pwd stands for "print working directory": it shows the folder the terminal is working in.

~~~bash
pwd
~~~

**You should see:** your home folder, the one with your name on it. On a Mac it looks like /Users/sam, on Linux /home/sam, and on Windows C:\Users\Sam. The terminal always starts here, and this is where your course project will live.

**If it didn't work:** if you see a different folder, that's fine. Make a note of it: you'll come back to this same terminal.
:::`,
    },
    {
      id: "m00-s03",
      order_index: 3,
      kind: "concept",
      title: "Install Claude Code",
      body_md: md`**Claude Code** is an AI (artificial intelligence) assistant that runs in your terminal. You tell it what you want in plain words, and it writes code, creates files and runs commands for you, asking your permission first. In the hands-on parts of this course, you'll paste instructions into Claude Code rather than writing code yourself.

To **install** something means putting a program on your computer so you can use it.

:::step Get Git first (Windows only)
:::mac
**Where:** nothing to do here on a Mac.

**Do:** skip to the next step. Your Mac gets this tool in Part 3.

**You should see:** nothing yet.

**If it didn't work:** there's nothing that can go wrong here.
:::
:::windows
**Where:** in your web browser.

**Do:** go to git-scm.com/downloads/win and download the installer for "Git for Windows". Run it. Click **Next** on every screen and keep the choices it suggests, including "Adjusting your PATH environment". Then click **Install** and **Finish**.

**You should see:** the installer finish without errors. Claude Code uses a tool from Git for Windows, and you'll need Git itself in Part 3.

**If it didn't work:** if Windows asks "Do you want to allow this app to make changes?", click **Yes**. If the download page offers several files, choose the "64-bit Git for Windows Setup".
:::
:::linux
**Where:** nothing to do here on Linux.

**Do:** skip to the next step. You'll get this tool in Part 3.

**You should see:** nothing yet.

**If it didn't work:** there's nothing that can go wrong here.
:::
:::

:::step Run the Claude Code installer
:::mac
**Where:** in your terminal.

**Do:** paste this and press Enter. It downloads the official installer from claude.ai and runs it.

~~~bash
curl -fsSL https://claude.ai/install.sh | bash
~~~

**You should see:** nothing for a while (it shows no progress while it downloads), then "Claude Code successfully installed!".

**If it didn't work:** if you see a lot of text starting with \`<!DOCTYPE html>\` or \`syntax error near unexpected token\`, run the same command again. If it says the app is unavailable in your region, Claude Code isn't offered in your country yet.
:::
:::windows
**Where:** in PowerShell.

**Do:** paste this and press Enter. It downloads the official installer from claude.ai and runs it.

~~~powershell
irm https://claude.ai/install.ps1 | iex
~~~

**You should see:** nothing for a while (it shows no progress while it downloads), then "Claude Code successfully installed!".

**If it didn't work:** "'irm' is not recognized" means you're in \`Command Prompt\`, not PowerShell: open PowerShell (see Part 1) and try again. "Claude Code does not support 32-bit Windows" means you opened the PowerShell ending in "(x86)": close it and open the plain Windows PowerShell.
:::
:::linux
**Where:** in your terminal.

**Do:** paste this and press Enter. It downloads the official installer from claude.ai and runs it.

~~~bash
curl -fsSL https://claude.ai/install.sh | bash
~~~

**You should see:** nothing for a while (it shows no progress while it downloads), then "Claude Code successfully installed!".

**If it didn't work:** if it says curl isn't found, install it first with sudo apt install curl (on Ubuntu or Debian) and try again. sudo runs a command as the computer's administrator, so it asks for your password; nothing appears as you type it, which is normal.
:::
:::

:::video m00-install-claude-code-mac
:::

:::video m00-install-claude-code-windows
:::

:::video m00-install-claude-code-linux
:::

:::step Check that it installed
**Where:** in a **new** terminal window. Close the old one first, so the terminal notices the new program.

**Do:** paste this and press Enter.

~~~bash
claude --version
~~~

**You should see:** a version number followed by (Claude Code), something like 2.1.211 (Claude Code). Your number will be different, and that's fine.

**If it didn't work:** "command not found" or "not recognized" means the terminal doesn't know where Claude Code was put. Its folder needs adding to your PATH, the list of folders the terminal searches. Paste the lines for your computer, then close the terminal, open a new one, and run claude --version again.

:::mac
~~~bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
~~~
:::
:::windows
~~~powershell
$currentPath = [Environment]::GetEnvironmentVariable('PATH', 'User')
[Environment]::SetEnvironmentVariable('PATH', "$currentPath;$env:USERPROFILE\.local\bin", 'User')
~~~
:::
:::linux
~~~bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
~~~
:::
:::

:::step Sign in to Claude Code
**Where:** in your terminal.

**Do:** start Claude Code by typing claude and pressing Enter. Follow what it says on screen: choose a colour theme with the arrow keys and Enter, then choose to sign in with your Claude account. A browser window opens; sign in there with your Claude account and approve.

~~~bash
claude
~~~

**You should see:** a welcome message from Claude Code and a box to type in. You're in. To leave Claude Code, type /exit and press Enter, or press Ctrl and C twice.

**If it didn't work:** if no browser window opens, look in the terminal for a long web address, copy it, and paste it into your browser. If it says your plan doesn't include Claude Code, you need a paid Claude plan (Pro or Max), not the free one.
:::

:::video m00-claude-sign-in
:::`,
    },
    {
      id: "m00-s04",
      order_index: 4,
      kind: "concept",
      title: "Make a GitHub account and connect it",
      body_md: md`**GitHub** is a website that stores projects online. It keeps your course work backed up, and it's where the course checks your work later on. It works with **Git**, a free tool on your computer that remembers every saved version of your project's files.

In this part you'll make a GitHub account, install Git and GitHub's own terminal tool (the **GitHub CLI**, short for command-line interface, which you run as gh), and sign your computer in.

:::step Create your GitHub account
**Where:** in your web browser.

**Do:** go to github.com/signup. Enter your email address, a password, and a username (this will be part of your project's web address, so pick something you're happy to share). Solve the puzzle if it shows one, then type in the code GitHub emails you.

**You should see:** your GitHub home page, with your username in the top-right corner. Write your username down: you'll need it.

**If it didn't work:** if your username is taken, add a number or your initials. If the email code doesn't arrive within five minutes, check your spam folder, then use "Resend the code".
:::

:::video m00-github-signup
:::

:::step Install Git and the GitHub CLI
:::mac
**Where:** in your terminal.

**Do:** first install Homebrew, a free tool that installs other programs for you (a package manager). Paste this and press Enter:

~~~bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
~~~

It asks for your Mac's password: type the one you use to sign in to your Mac (nothing appears as you type; that's normal) and press Enter. Press Enter again when it asks you to continue. If it offers to install the "Command Line Tools", say yes: they include Git. When it finishes, look near the end for **Next steps**. If you see it, copy the lines shown under it, paste them, and press Enter.

Then install the GitHub CLI:

~~~bash
brew install gh
~~~

**You should see:** both commands finish without the word "Error". Now check both tools:

~~~bash
git --version
gh --version
~~~

You should see lines starting git version and gh version.

**If it didn't work:** "brew: command not found" means the **Next steps** lines weren't run: scroll up in the terminal, find them, and run them. Then try brew install gh again.
:::
:::windows
**Where:** in a **new** PowerShell window (Git, which you installed in Part 2, only shows up in new windows).

**Do:** paste this and press Enter. It uses winget, the package manager built into Windows, to install the GitHub CLI.

~~~powershell
winget install --id GitHub.cli --source winget
~~~

If it asks you to agree to the source's terms, type Y and press Enter. When it's done, close PowerShell and open a new window. Then check both tools:

~~~powershell
git --version
gh --version
~~~

**You should see:** lines starting git version and gh version.

**If it didn't work:** "gh is not recognized" usually means the window is too old: close it, open a brand-new PowerShell window (a new tab isn't enough) and try again. "git is not recognized" means Git for Windows didn't install: go back to Part 2, step 1.
:::
:::linux
**Where:** in your terminal.

**Do:** these steps are for Ubuntu and Debian. First install Git (it asks for your password; nothing appears as you type it):

~~~bash
sudo apt update && sudo apt install git -y
~~~

Then install the GitHub CLI with the official command. It's long: copy the whole box and paste it in one go.

~~~bash
(type -p wget >/dev/null || (sudo apt update && sudo apt install wget -y)) \
	&& sudo mkdir -p -m 755 /etc/apt/keyrings \
	&& out=$(mktemp) && wget -nv -O$out https://cli.github.com/packages/githubcli-archive-keyring.gpg \
	&& cat $out | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
	&& sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
	&& sudo mkdir -p -m 755 /etc/apt/sources.list.d \
	&& echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
	&& sudo apt update \
	&& sudo apt install gh -y
~~~

On Fedora, use these instead:

~~~bash
sudo dnf install git dnf5-plugins
sudo dnf config-manager addrepo --from-repofile=https://cli.github.com/packages/rpm/gh-cli.repo
sudo dnf install gh
~~~

Then check both tools:

~~~bash
git --version
gh --version
~~~

**You should see:** lines starting git version and gh version.

**If it didn't work:** if a line ends with an error about a "lock", another update is running in the background: wait a minute and run the same command again.
:::
:::

:::video m00-install-gh-mac
:::

:::video m00-install-gh-windows
:::

:::video m00-install-gh-linux
:::

:::step Sign your computer in to GitHub
**Where:** in your terminal.

**Do:** paste this and press Enter, then answer its questions with the arrow keys and Enter.

~~~bash
gh auth login
~~~

Choose **GitHub.com**, then **HTTPS** (Hypertext Transfer Protocol Secure: the safe way your computer talks to websites), then **Yes** to "Authenticate Git with your GitHub credentials", then **Login with a web browser**. It shows a **one-time code**: a short code like \`ABCD-1234\`. Copy it, press Enter, and a browser page opens. Paste the code there, click **Continue**, then **Authorize**.

**You should see:** back in the terminal, \`Logged in as\` and your username.

**If it didn't work:** if no browser opens, go to github.com/login/device yourself and type the code there. If the code has expired, run gh auth login again for a new one.
:::

:::video m00-gh-auth-login
:::`,
    },
    {
      id: "m00-s05",
      order_index: 5,
      kind: "concept",
      title: "Copy the course template",
      body_md: md`Your course work lives in a **repository** (or **repo** for short): a project folder that Git keeps track of, with a copy on GitHub. You don't start from an empty one. The course has a **template repository**, a starter project with the files the course checks, and you make your own copy of it.

:::step Make your own copy and download it
**Where:** in your terminal, in your home folder (where the terminal starts).

**Do:** paste this and press Enter. It creates a new repository called ${PROJECT} on your GitHub account from the course template, then downloads (**clones**) it onto your computer.

~~~bash
gh repo create ${PROJECT} --template ${TEMPLATE} --public --clone
~~~

It's **public** because the course needs to see it to check your work. Never put passwords or private documents in it.

**You should see:** a line saying it created the repository, with your username, then "Cloning into '${PROJECT}'".

**If it didn't work:** "Name already exists on this account" means you've done this before: either use that copy, or run the command again with a new name such as ${PROJECT}-2 (and use that name wherever the course says ${PROJECT}). If it created the repository but the download failed, wait ten seconds and run gh repo clone ${PROJECT}.
:::

:::video m00-template-copy
:::

:::step Go into your project folder
**Where:** in your terminal.

**Do:** paste this and press Enter. cd means "change directory": it moves the terminal into a folder.

~~~bash
cd ${PROJECT}
~~~

**You should see:** the line you type on now includes ${PROJECT}. Every command from here runs inside your project.

**If it didn't work:** "No such file or directory" or "Cannot find path" means the folder isn't here. Type ls and press Enter to list the folders you're in, and check the spelling of the name.
:::

:::step See what's inside
**Where:** in your terminal, inside ${PROJECT}.

**Do:** paste this and press Enter. ls lists what's in the current folder.

~~~bash
ls
~~~

**You should see:** \`README.md\` and \`eval/\`. (On Windows they appear in a table, along with a folder called .github, which Macs and Linux hide.) That's the starter project: you'll fill it in, module by module.

**If it didn't work:** if you see your home folder's contents instead (Desktop, Documents…), you're not inside the project yet: do the step before again.
:::`,
    },
    {
      id: "m00-s06",
      order_index: 6,
      kind: "concept",
      title: "Run one command and check it worked",
      body_md: md`Last part. You'll ask Git and then Claude Code about your project, so you know every tool works together.

:::step Ask Git how your project stands
**Where:** in your terminal, inside ${PROJECT}.

**Do:** paste this and press Enter.

~~~bash
git status
~~~

**You should see:**

~~~output
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
~~~

"On branch main" means you're on the main version of your project. A **branch** is a named copy of your code; later modules each make their own. "Nothing to commit" means nothing has changed since you downloaded it. A **commit** is a saved snapshot of your project.

**If it didn't work:** "not a git repository" means you're not inside the project folder. Run cd ${PROJECT} and try again.
:::

:::step Ask Claude Code about your project
**Where:** in your terminal, inside ${PROJECT}.

**Do:** start Claude Code:

~~~bash
claude
~~~

The first time you start it in a folder, it asks whether you trust the files in it. These are your files, so choose **Yes** and press Enter. Then paste this into Claude Code and press Enter:

~~~prompt
What files are in this project, and what does eval/run.sh do? Answer in two sentences.
~~~

**You should see:** Claude Code reading the files, then an answer mentioning \`README.md\` and \`eval/run.sh\`, saying that \`run.sh\` writes placeholder scores for now. Type /exit and press Enter to leave Claude Code.

**If it didn't work:** if it asks you to sign in again, follow the browser steps from Part 2. If it says it can't find \`eval/run.sh\`, check you started claude inside ${PROJECT} (step 1 of this part tells you where you are).
:::

:::video m00-first-claude-question
:::

:::step Remember the routine
**Where:** in your terminal, whenever you come back to the course.

**Do:** every hands-on part starts the same way: open your terminal, go into your project, and start Claude Code.

~~~bash
cd ${PROJECT}
claude
~~~

**You should see:** Claude Code's box, ready for you to type, in your project.

**If it didn't work:** if cd says the folder doesn't exist, you're probably not in your home folder. Close the terminal, open a new one (it always starts at home) and try again.
:::

That's your workshop. Go to the last tab, **Check your setup**, run through the list, and tick **My setup works** to unlock Module 1.`,
    },
  ],

  worked_example: [],
  glossary: [
    "terminal", "command", "powershell", "folder", "path-variable", "install", "package-manager", "homebrew", "winget", "sudo",
    "claude-code", "ai", "browser", "git", "github", "github-cli", "https", "sign-in-code", "repository", "template-repository",
    "clone", "branch", "commit", "subcontractor",
  ],
  study_guide: [],
  quiz_items: [],
  failure_cases: [],
};

export default m00;
