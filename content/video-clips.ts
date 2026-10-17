// Spots where a short how-to video would help, so they can be recorded later.
// Each clip is used by a ":::video clip-id" marker in a module's lesson text;
// tests/unit/video-clips.test.ts keeps markers and this list in step, and
// docs/VIDEO_SHOT_LIST.md (npm run video-list) is the printable version.
import { clips as m00 } from "./video-clips/m00";
import { clips as m01 } from "./video-clips/m01";
import { clips as m02 } from "./video-clips/m02";
import { clips as m03 } from "./video-clips/m03";
import { clips as m04 } from "./video-clips/m04";
import { clips as m05 } from "./video-clips/m05";
import { clips as m06 } from "./video-clips/m06";
import { clips as m07 } from "./video-clips/m07";
import { clips as m08 } from "./video-clips/m08";
import { clips as m09 } from "./video-clips/m09";
import { clips as m10 } from "./video-clips/m10";
import { clips as m11 } from "./video-clips/m11";

export type VideoClip = {
  /** kebab-case, unique: e.g. "m00-open-terminal-mac" */
  id: string;
  /** One line: what the clip should show. */
  shows: string;
  /** The computer it has to be recorded on ("any" = any of them, e.g. a web page). */
  system: "mac" | "windows" | "linux" | "any";
};

export const VIDEO_CLIPS_BY_MODULE: Record<string, VideoClip[]> = { m00, m01, m02, m03, m04, m05, m06, m07, m08, m09, m10, m11 };
export const VIDEO_CLIPS: (VideoClip & { module: string })[] = Object.entries(VIDEO_CLIPS_BY_MODULE).flatMap(([module, list]) =>
  list.map((c) => ({ ...c, module })),
);
export const clipById = (id: string) => VIDEO_CLIPS.find((c) => c.id === id) ?? null;
