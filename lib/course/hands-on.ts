// Every module's hands-on step follows the same pattern:
//
//   **Predict first:** …
//   :::tier guided        numbered :::step cards: what to do, where, what you
//   …                     should see, and what to do if it didn't work
//   :::
//   :::tier partial … :::
//   :::tier solo … :::
//   **Files you create:** …  **Capstone branch:** …  **Check it with your assistant:** …
//
// (The older one-line form, "- **Guided:** …" list items, still parses.)
//
// The lesson page shows the three tiers one at a time and tucks the project
// details away, under friendlier labels.

export type TierLevel = "guided" | "partial" | "solo";
export type HandsOnPlan = {
  /** Everything before the tiers (usually "Predict first"). */
  intro: string;
  tiers: { level: TierLevel; text: string }[];
  /** The project plumbing, relabelled for beginners. */
  project: { label: string; text: string }[];
  /** Anything else after the tiers. */
  outro: string;
};

export const TIER_COPY: Record<TierLevel, { title: string; hint: string }> = {
  guided: { title: "Start here", hint: "Step by step, with everything spelled out." },
  partial: { title: "Now with less help", hint: "The same idea, with a twist to work out." },
  solo: { title: "On your own", hint: "Put it together yourself." },
};

const PROJECT_LABELS: Record<string, string> = {
  "files you create": "What you'll have at the end",
  "capstone branch": "Where to save it",
  "check it with your assistant": "Ask your coding assistant to check it",
};

const TIER = /^-\s+\*\*(Guided|Partial|Solo):\*\*\s*(.*)$/i;
const PROJECT = /^\*\*(Files you create|Capstone branch|Check it with your assistant):\*\*\s*([\s\S]*)$/i;

const TIER_BLOCK = /^:::tier\s+(guided|partial|solo)\s*$/i;

/** The :::tier block form: tier bodies keep their full markdown (steps, systems, code). */
function parseTierBlocks(lines: string[]) {
  const intro: string[] = [];
  const outro: string[] = [];
  const tiers: HandsOnPlan["tiers"] = [];
  for (let i = 0; i < lines.length; i++) {
    const open = lines[i].match(TIER_BLOCK);
    if (!open) {
      (tiers.length ? outro : intro).push(lines[i]);
      continue;
    }
    let depth = 1;
    let inCode = false;
    let j = i + 1;
    for (; j < lines.length; j++) {
      if (/^(```|~~~)/.test(lines[j])) inCode = !inCode;
      else if (inCode) continue;
      else if (/^:::\w/.test(lines[j])) depth++;
      else if (/^:::\s*$/.test(lines[j]) && --depth === 0) break;
    }
    tiers.push({ level: open[1].toLowerCase() as TierLevel, text: lines.slice(i + 1, j).join("\n").trim() });
    outro.length = 0; // anything between tiers is dropped; text belongs inside a tier
    i = j;
  }
  return { intro, tiers, outro };
}

/** Null when the step doesn't follow the pattern (it then renders as plain text). */
export function parseHandsOn(md: string): HandsOnPlan | null {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  if (lines.some((l) => TIER_BLOCK.test(l))) {
    const { intro, tiers, outro } = parseTierBlocks(lines);
    if (tiers.map((t) => t.level).join() !== "guided,partial,solo") return null;
    return finish(intro, tiers, outro);
  }
  const intro: string[] = [];
  const outro: string[] = [];
  const tiers: HandsOnPlan["tiers"] = [];
  let inTier = false;
  for (const line of lines) {
    const t = line.match(TIER);
    if (t) {
      tiers.push({ level: t[1].toLowerCase() as TierLevel, text: t[2].trim() });
      inTier = true;
    } else if (inTier && /^\s{2,}\S/.test(line)) {
      tiers[tiers.length - 1].text += `\n${line.trim()}`;
    } else {
      inTier = false;
      (tiers.length ? outro : intro).push(line);
    }
  }
  if (tiers.map((t) => t.level).join() !== "guided,partial,solo") return null;
  return finish(intro, tiers, outro);
}

function finish(intro: string[], tiers: HandsOnPlan["tiers"], outro: string[]): HandsOnPlan {
  const project: HandsOnPlan["project"] = [];
  const rest: string[] = [];
  for (const para of outro.join("\n").split(/\n\s*\n/)) {
    const p = para.trim().match(PROJECT);
    if (p) project.push({ label: PROJECT_LABELS[p[1].toLowerCase()], text: p[2].trim() });
    else if (para.trim()) rest.push(para.trim());
  }
  return { intro: intro.join("\n").trim(), tiers, project, outro: rest.join("\n\n") };
}
