import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { modules } from "@/content";
import { GLOSSARY } from "@/content/glossary";
import { VIDEO_CLIPS } from "@/content/video-clips";
import { parseHandsOn } from "@/lib/course/hands-on";
import { OPERATING_SYSTEMS, parseMarkdown, walkBlocks, type MdBlock } from "@/lib/course/markdown";
import { renderShotList } from "@/lib/course/video-list";
import { isSetupModule } from "@/lib/course/setup";
import { prose } from "../support/learner-text";

// The hands-on steps assume nothing: every Guided tier, and all of Module 0,
// is numbered step cards that say where to do it, what to do, what you should
// see, and what to do if it didn't work. Steps that differ by computer have a
// Mac, a Windows and a Linux version. No term goes unexplained.

const setup = modules.find((m) => isSetupModule(m.id))!;
const courseModules = modules.filter((m) => m.hook && !isSetupModule(m.id));
const STEP_LABELS = ["**Where:**", "**Do:**", "**You should see:**", "**If it didn't work:**"];

const guidedOf = (m: (typeof modules)[number]) => {
  const ex = m.lesson_steps.find((s) => s.kind === "exercise")!;
  return parseHandsOn(ex.body_md)!;
};
/** All step blocks in a markdown string, with their raw source text for label checks. */
function steps(md: string): { title: string; source: string; block: MdBlock }[] {
  const out: { title: string; source: string; block: MdBlock }[] = [];
  const lines = md.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const open = lines[i].match(/^:::step\s+(.*)$/);
    if (!open) continue;
    let depth = 1;
    let inCode = false;
    let j = i + 1;
    for (; j < lines.length; j++) {
      if (/^(```|~~~)/.test(lines[j])) inCode = !inCode;
      else if (inCode) continue;
      else if (/^:::\w/.test(lines[j])) depth++;
      else if (/^:::\s*$/.test(lines[j]) && --depth === 0) break;
    }
    const source = lines.slice(i + 1, j).join("\n");
    out.push({ title: open[1], source, block: { type: "step", title: open[1], blocks: parseMarkdown(source) } });
  }
  return out;
}
/** Text a learner reads, without code boxes (commands aren't prose). */
const readable = (md: string) => prose(md.replace(/^(```|~~~)[\s\S]*?^(```|~~~)/gm, " "));

// Words a complete beginner may not know. If any appears in Module 0 or a
// Guided tier, it must be a glossary term (so it gets a tooltip and an entry).
const JARGON = [
  "terminal", "command", "powershell", "folder", "install", "installer", "package manager", "homebrew", "brew", "winget", "sudo",
  "path", "git", "github", "github cli", "claude code", "repository", "repo", "template repository", "clone", "commit", "push",
  "branch", "python", "uv", "library", "script", "browser", "one-time code", "token", "function", "index", "embedding",
  "chunk", "prompt", "workflow", "pull request", "fork", "merge", "dependency", "dependencies", "environment variable",
  "api", "api key", "cli", "json", "yaml", "jsonl", "virtual environment", "pip", "notebook", "server", "localhost",
  "deploy", "ci", "dashboard", "log", "cache",
];
const aliasSet = new Set(GLOSSARY.flatMap((g) => g.aliases.map((a) => a.toLowerCase())));
const ACRONYM = /\b[A-Z][A-Z0-9]+s?\b/g;

function unexplained(md: string): string[] {
  const text = readable(md);
  const missing = JARGON.filter((w) => new RegExp(`(?<![\\w-])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`, "i").test(text) && !aliasSet.has(w));
  const acronyms = (text.match(ACRONYM) ?? []).filter((a) => !aliasSet.has(a.toLowerCase()));
  return Array.from(new Set([...missing, ...acronyms]));
}

function checkSteps(md: string, where: string) {
  const found = steps(md);
  for (const s of found) {
    for (const label of STEP_LABELS) expect(s.source, `${where} › "${s.title}" needs ${label}`).toContain(label);
  }
  // Wherever a step splits by computer, all three versions are there.
  walkBlocks(parseMarkdown(md), (b) => {
    if (!("blocks" in b)) return;
    const systems = b.blocks.filter((x): x is Extract<MdBlock, { type: "os" }> => x.type === "os").map((x) => x.os);
    if (systems.length) expect(systems.sort(), `${where}: a block has ${systems.join("/")} versions`).toEqual([...OPERATING_SYSTEMS].sort());
  });
  return found;
}

describe("Module 0: Set up your workshop", () => {
  it("comes first, has no quiz, and is in the lesson format", () => {
    expect(setup).toMatchObject({ id: "m00", order_index: 0, is_published: true });
    expect(setup.hook).toBeTruthy();
    expect([setup.quiz_items.length, setup.failure_cases.length]).toEqual([0, 0]);
  });

  it("walks through the terminal, Claude Code, GitHub, the template and a first command, in numbered steps", () => {
    const parts = setup.lesson_steps.filter((s) => s.kind !== "warm_up");
    const text = parts.map((s) => `${s.title}\n${s.body_md}`).join("\n");
    for (const must of [/terminal/i, /Claude Code/, /GitHub account/i, /template/i, /git status/]) expect(text).toMatch(must);
    for (const p of parts) expect(checkSteps(p.body_md, p.id).length, `${p.id} has numbered steps`).toBeGreaterThanOrEqual(2);
  });

  it("gives Mac, Windows and Linux versions of the system-specific steps", () => {
    const text = setup.lesson_steps.map((s) => s.body_md).join("\n");
    for (const os of OPERATING_SYSTEMS) expect(text.match(new RegExp(`^:::${os}\\s*$`, "gm"))?.length ?? 0, os).toBeGreaterThanOrEqual(4);
    // The official install commands, not guesses.
    expect(text).toContain("curl -fsSL https://claude.ai/install.sh | bash");
    expect(text).toContain("irm https://claude.ai/install.ps1 | iex");
  });

  it("leaves no term unexplained", () => {
    for (const s of setup.lesson_steps) expect(unexplained(`${s.title}\n${s.body_md}`), s.id).toEqual([]);
    expect(unexplained(setup.hook!)).toEqual([]);
  });
});

describe.each(courseModules.map((m) => [m.id, m] as const))("%s hands-on", (_id, m) => {
  const plan = guidedOf(m);

  it("has a Guided tier of numbered steps that assume nothing", () => {
    const guided = plan.tiers.find((t) => t.level === "guided")!;
    expect(checkSteps(guided.text, `${m.id} guided`).length).toBeGreaterThanOrEqual(3);
  });

  it("leaves no term unexplained in the Guided tier", () => {
    expect(unexplained(plan.tiers.find((t) => t.level === "guided")!.text)).toEqual([]);
  });

  it("only uses tools already set up: Partial and Solo install nothing new", () => {
    for (const t of plan.tiers.filter((x) => x.level !== "guided")) {
      expect(t.text, `${m.id} ${t.level}`).not.toMatch(/install\.sh|install\.ps1|\bwinget install|\bbrew install|\bapt install|\bdnf install|\bpip install/);
      checkSteps(t.text, `${m.id} ${t.level}`);
    }
  });
});

describe("how-to video list", () => {
  const markers = modules.flatMap((m) => Array.from(JSON.stringify(m).matchAll(/:::video ([a-z0-9-]+)/g), (x) => ({ module: m.id, id: x[1] })));

  it("has a clip for every marker, and a marker for every clip, each used once", () => {
    expect(markers.map((x) => x.id).sort()).toEqual(VIDEO_CLIPS.map((c) => c.id).sort());
    for (const mk of markers) expect(VIDEO_CLIPS.find((c) => c.id === mk.id)?.module, mk.id).toBe(mk.module);
  });

  it("describes each clip in one line and says which computer it needs", () => {
    expect(VIDEO_CLIPS.length).toBeGreaterThan(0);
    for (const c of VIDEO_CLIPS) {
      expect(c.id).toMatch(/^m\d{2}-[a-z0-9-]+$/);
      expect(c.shows.length, c.id).toBeLessThanOrEqual(160);
      expect(c.shows, c.id).not.toMatch(/\n/);
    }
  });

  it("is written out in docs/VIDEO_SHOT_LIST.md (run npm run video-list after changing clips)", () => {
    expect(readFileSync(path.join(__dirname, "../../docs/VIDEO_SHOT_LIST.md"), "utf8")).toBe(renderShotList());
  });
});
