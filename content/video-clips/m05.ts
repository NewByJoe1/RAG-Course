import type { VideoClip } from "../video-clips";

// How-to clips wanted for Module 5. Each id is used by one :::video marker in the module.
export const clips: VideoClip[] = [
  { id: "m05-add-reranker", shows: "Pasting the re-ranker prompt into Claude Code, approving the big first download, and reading the before-and-after places.", system: "any" },
  { id: "m05-before-after-table", shows: "Leaving Claude Code, running check_rerank.py and ask.py, and reading the ten-question table and the 1st-place count.", system: "any" },
];
