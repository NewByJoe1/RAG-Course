import type { VideoClip } from "../video-clips";

// How-to clips wanted for Module 7. Each id is used by one :::video marker in the module.
export const clips: VideoClip[] = [
  { id: "m07-build-eval", shows: "Pasting the evaluate.py prompt into Claude Code, approving each step, and the report printing one golden-set row at a time.", system: "any" },
  { id: "m07-read-report", shows: "Running uv run evaluate.py --saved, then finding the subcontractor row nda-001 and the five worst rows in the report.", system: "any" },
];
