import type { VideoClip } from "../video-clips";

// How-to clips wanted for Module 6. Each id is used by one :::video marker in the module.
export const clips: VideoClip[] = [
  { id: "m06-train-reranker", shows: "Pasting the training prompt into Claude Code, approving each step, and reading the epoch table: losses falling, the best epoch kept.", system: "any" },
  { id: "m06-compare-rerankers", shows: "Running uv run compare_rerankers.py, then reading base versus tuned: the held-out scores and the top 3 for both wordings.", system: "any" },
];
