// Writes docs/VIDEO_SHOT_LIST.md from content/video-clips/. Run: npm run video-list
import { writeFileSync } from "node:fs";
import { renderShotList } from "../lib/course/video-list";

writeFileSync("docs/VIDEO_SHOT_LIST.md", renderShotList());
console.log("Wrote docs/VIDEO_SHOT_LIST.md");
