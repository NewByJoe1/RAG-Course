import type { VideoClip } from "../video-clips";

// How-to clips wanted for Module 3. Each id is used by one :::video marker in the module.
export const clips: VideoClip[] = [
  { id: "m03-keyword-search", shows: "Pasting the keyword-search prompt into Claude Code, approving the rank-bm25 library, and comparing the meaning and keyword top 5 for the Section 4.5 question.", system: "any" },
  { id: "m03-compare-tally", shows: "Leaving Claude Code, running ask.py to find the §4.5 arrow in the merged list, then compare.py and reading the ten-question tally.", system: "any" },
];
