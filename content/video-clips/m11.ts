import type { VideoClip } from "../video-clips";

// How-to clips wanted for Module 11. Each id is used by one :::video marker in the module.
export const clips: VideoClip[] = [
  { id: "m11-cuad-pairs", shows: "Downloading the 200-clause CUAD slice through Claude Code, building the training pairs, and reading three hard negatives.", system: "any" },
  { id: "m11-before-after", shows: "Training the embedding model, re-indexing into index-legal/, and reading the base vs legal recall@3 table.", system: "any" },
];
