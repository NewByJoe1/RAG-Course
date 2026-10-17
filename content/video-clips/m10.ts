import type { VideoClip } from "../video-clips";

// How-to clips wanted for Module 10. Each id is used by one :::video marker in the module.
export const clips: VideoClip[] = [
  { id: "m10-clause-tree", shows: "Pasting the parser prompt into Claude Code, approving each step, and reading the clause tree: §4.2(b) whole, §4.5 marked overrides §4.2.", system: "any" },
  { id: "m10-correct-answer", shows: "Running ask.py with the subcontractor question and reading it: §4.5 first, the conflicting tag, one answer and the ✓ citation lines.", system: "any" },
];
