import type { VideoClip } from "../video-clips";

// How-to clips wanted for Module 2. Each id is used by one :::video marker in the module.
export const clips: VideoClip[] = [
  { id: "m02-rewrite-search", shows: "Pasting the rewrite prompt into Claude Code, approving each step, and reading the searches and the new top 5 for the subcontractor question.", system: "any" },
  { id: "m02-tag-and-answer", shows: "Leaving Claude Code and running ask.py on the subcontractor and \"How long\" questions: the tag, the model picked and the cited answer.", system: "any" },
];
