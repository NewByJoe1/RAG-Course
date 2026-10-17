import type { VideoClip } from "../video-clips";

// How-to clips wanted for Module 9. Each id is used by one :::video marker in the module.
export const clips: VideoClip[] = [
  { id: "m09-harness-question", shows: "Asking the subcontractor question through uv run harness.py, and reading the reply, the gate results and the customer of each clause.", system: "any" },
  { id: "m09-kill-switch", shows: "Asking Claude Code to switch serving.enabled off, the instant switched-off reply, then switching it back on.", system: "any" },
];
