import type { VideoClip } from "../video-clips";

// How-to clips wanted for Module 1. Each id is used by one :::video marker in the module.
export const clips: VideoClip[] = [
  { id: "m01-install-uv", shows: "Installing uv with the official command, opening a new terminal, and checking uv --version.", system: "mac" },
  { id: "m01-first-build", shows: "Pasting the NDA and the build prompt into Claude Code, approving each step, and reading the top 5 output.", system: "any" },
  { id: "m01-commit-push", shows: "Leaving Claude Code, then git add, git commit and git push for the naive-rag branch, and the branch on GitHub.", system: "any" },
];
