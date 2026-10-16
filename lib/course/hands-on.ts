// Every module's hands-on step follows the same pattern:
//
//   **Predict first:** …
//   - **Guided:** …
//   - **Partial:** …
//   - **Solo:** …
//   **Files you create:** …  **Capstone branch:** …  **Check it with your assistant:** …
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

/** Null when the step doesn't follow the pattern (it then renders as plain text). */
export function parseHandsOn(md: string): HandsOnPlan | null {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
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

  const project: HandsOnPlan["project"] = [];
  const rest: string[] = [];
  for (const para of outro.join("\n").split(/\n\s*\n/)) {
    const p = para.trim().match(PROJECT);
    if (p) project.push({ label: PROJECT_LABELS[p[1].toLowerCase()], text: p[2].trim() });
    else if (para.trim()) rest.push(para.trim());
  }
  return { intro: intro.join("\n").trim(), tiers, project, outro: rest.join("\n\n") };
}
