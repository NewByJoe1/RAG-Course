import type { VideoClip } from "../video-clips";

// How-to clips wanted for Module 8. Each id is used by one :::video marker in the module.
export const clips: VideoClip[] = [
  { id: "m08-gh-run-watch", shows: "Pushing the automation branch, then gh run watch: picking the run, steps ticking off, and the run ending in success.", system: "any" },
  { id: "m08-actions-tab", shows: "gh browse, the Actions tab, a run's steps and its eval-results artifact, then gh run download and reading results.json.", system: "any" },
];
