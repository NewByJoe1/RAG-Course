import type { VideoClip } from "../video-clips";

// How-to clips wanted for Module 4. Each id is used by one :::video marker in the module.
export const clips: VideoClip[] = [
  { id: "m04-build-clean", shows: "Pasting the clean() prompt into Claude Code, approving each step, reading the clean: log, then try_clean.py catching the copies.", system: "any" },
  { id: "m04-read-clean-log", shows: "Leaving Claude Code, running ask.py on two questions, and reading the three counts, the threshold and where §4.5 sits.", system: "any" },
];
