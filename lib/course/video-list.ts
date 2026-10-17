import { VIDEO_CLIPS } from "@/content/video-clips";
import { modules } from "@/content";

const SYSTEM: Record<string, string> = { mac: "Mac", windows: "Windows", linux: "Linux", any: "Any (recordable on your Mac)" };

/** docs/VIDEO_SHOT_LIST.md: every how-to clip the course wants, grouped by module. */
export function renderShotList(): string {
  const title = (id: string) => modules.find((m) => m.id === id)?.title ?? id;
  const lines = [
    "# Video shot list",
    "",
    "Every spot in the course where a short how-to video would help. Each clip appears on the lesson page as \"Video coming soon\" until it's recorded.",
    "",
    "Generated from `content/video-clips/` by `npm run video-list`. Don't edit by hand.",
    "",
    `Clips: ${VIDEO_CLIPS.length} in all. Recordable on a Mac: ${VIDEO_CLIPS.filter((c) => c.system === "mac" || c.system === "any").length}. Need a Windows PC: ${VIDEO_CLIPS.filter((c) => c.system === "windows").length}. Need a Linux computer: ${VIDEO_CLIPS.filter((c) => c.system === "linux").length}.`,
  ];
  for (const mod of Array.from(new Set(VIDEO_CLIPS.map((c) => c.module)))) {
    lines.push("", `## Module ${Number(mod.slice(1))}: ${title(mod)}`, "", "| Clip | What it should show | Record on |", "| --- | --- | --- |");
    for (const c of VIDEO_CLIPS.filter((x) => x.module === mod)) lines.push(`| \`${c.id}\` | ${c.shows.replace(/\|/g, "\\|")} | ${SYSTEM[c.system]} |`);
  }
  return lines.join("\n") + "\n";
}
