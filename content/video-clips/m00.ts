import type { VideoClip } from "../video-clips";

// How-to clips wanted for Module 0. Each id is used by one :::video marker in the module.
export const clips: VideoClip[] = [
  { id: "m00-open-terminal-mac", shows: "Opening Terminal with Cmd+Space, and what the window and the % line look like.", system: "mac" },
  { id: "m00-open-terminal-windows", shows: "Opening Windows PowerShell from the Start menu (not the x86 one), and spotting the PS line.", system: "windows" },
  { id: "m00-open-terminal-linux", shows: "Opening a terminal with Ctrl+Alt+T on Ubuntu, and pasting with Ctrl+Shift+V.", system: "linux" },
  { id: "m00-install-claude-code-mac", shows: "Pasting the Claude Code install command, waiting through the silence, and the success message.", system: "mac" },
  { id: "m00-install-claude-code-windows", shows: "Running the PowerShell install command for Claude Code and checking claude --version in a new window.", system: "windows" },
  { id: "m00-install-claude-code-linux", shows: "Running the Claude Code install command on Ubuntu and checking claude --version.", system: "linux" },
  { id: "m00-claude-sign-in", shows: "First run of claude: picking a theme, signing in through the browser, and leaving with /exit.", system: "any" },
  { id: "m00-github-signup", shows: "Creating a GitHub account at github.com/signup, including the emailed code.", system: "any" },
  { id: "m00-install-gh-mac", shows: "Installing Homebrew (password prompt, Next steps lines) and then brew install gh.", system: "mac" },
  { id: "m00-install-gh-windows", shows: "Installing the GitHub CLI with winget and reopening PowerShell to check gh --version.", system: "windows" },
  { id: "m00-install-gh-linux", shows: "Installing Git and the GitHub CLI on Ubuntu with the official apt commands.", system: "linux" },
  { id: "m00-gh-auth-login", shows: "gh auth login from start to finish: the four answers, the one-time code and the browser approval.", system: "any" },
  { id: "m00-template-copy", shows: "Copying the course template with gh repo create, then cd into the folder and ls.", system: "any" },
  { id: "m00-first-claude-question", shows: "Running git status, starting claude in the project, trusting the folder, and asking the first question.", system: "any" },
];
