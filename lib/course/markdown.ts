// A deliberately small markdown dialect for lesson text, so the renderer can
// weave glossary tooltips into it. Supports what the course content uses:
//
//   paragraphs (single newlines are line breaks)   **bold**   `code`
//   - bullet lists / 1. numbered lists (nested by indenting 2+ spaces)
//   > quotes
//   a paragraph that is only **bold** becomes a small subheading
//   :::key Title … :::    a highlighted "key idea" box
//   :::more Title … :::   a "show more" expander, closed by default
//   ```lang … ``` (or ~~~) a code box with a Copy button (commands, prompts, files)
//   :::step Title … :::   one numbered step card (numbered in order on the page)
//   :::mac / :::windows / :::linux … :::
//                         text for one kind of computer; the page shows the
//                         learner's chosen system (see components/lesson/System.tsx)
//   :::video clip-id ::: (closing line)
//                         a spot where a how-to video would help (content/video-clips.ts)

import { GLOSSARY, type GlossaryTerm } from "@/content/glossary";

export type MdBlock =
  | { type: "p"; text: string }
  | { type: "h"; text: string }
  | { type: "list"; ordered: boolean; items: { text: string; children: MdBlock[] }[] }
  | { type: "quote"; blocks: MdBlock[] }
  | { type: "key"; title: string | null; blocks: MdBlock[] }
  | { type: "more"; title: string; blocks: MdBlock[] }
  | { type: "code"; lang: string; text: string }
  | { type: "step"; title: string; blocks: MdBlock[] }
  | { type: "os"; os: OperatingSystem; blocks: MdBlock[] }
  | { type: "video"; id: string };

export const OPERATING_SYSTEMS = ["mac", "windows", "linux"] as const;
export type OperatingSystem = (typeof OPERATING_SYSTEMS)[number];

const LIST_ITEM = /^(\s*)([-*]|\d+\.)\s+(.*)$/;
const FENCE_OPEN = /^:::(\w+)\s*(.*)$/;
const FENCE_CLOSE = /^:::\s*$/;
const QUOTE = /^>\s?/;
const CODE_FENCE = /^(?:```|~~~)\s*([\w-]*)\s*$/;
const CODE_CLOSE = /^(?:```|~~~)\s*$/;

const topItem = (line: string) => {
  const m = line.match(LIST_ITEM);
  return m && m[1].length < 2 ? { ordered: /\d/.test(m[2]), text: m[3] } : null;
};
const startsBlock = (line: string) =>
  FENCE_OPEN.test(line) || FENCE_CLOSE.test(line) || QUOTE.test(line) || CODE_FENCE.test(line) || topItem(line) !== null;

const dedent = (lines: string[]) => {
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^\s*/)![0].length));
  return lines.map((l) => l.slice(Math.min(indent, l.match(/^\s*/)![0].length)));
};

/** Every block in a tree, depth first (for tests and checks). */
export function walkBlocks(blocks: MdBlock[], visit: (b: MdBlock, parents: MdBlock[]) => void, parents: MdBlock[] = []) {
  for (const b of blocks) {
    visit(b, parents);
    const kids = "blocks" in b ? b.blocks : b.type === "list" ? b.items.flatMap((it) => it.children) : [];
    walkBlocks(kids, visit, [...parents, b]);
  }
}

export function parseMarkdown(src: string): MdBlock[] {
  return parseLines(src.replace(/\r\n?/g, "\n").split("\n"));
}

function parseLines(lines: string[]): MdBlock[] {
  const out: MdBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }

    const code = line.match(CODE_FENCE);
    if (code) {
      let j = i + 1;
      while (j < lines.length && !CODE_CLOSE.test(lines[j])) j++;
      out.push({ type: "code", lang: code[1] || "text", text: lines.slice(i + 1, j).join("\n") });
      i = j + 1;
      continue;
    }

    const fence = line.match(FENCE_OPEN);
    if (fence) {
      let depth = 1;
      let j = i + 1;
      let inCode = false;
      for (; j < lines.length; j++) {
        if (CODE_FENCE.test(lines[j])) inCode = !inCode;
        else if (inCode) continue;
        else if (FENCE_OPEN.test(lines[j])) depth++;
        else if (FENCE_CLOSE.test(lines[j]) && --depth === 0) break;
      }
      const blocks = parseLines(lines.slice(i + 1, j));
      const [kind, title] = [fence[1], fence[2].trim()];
      if (kind === "more") out.push({ type: "more", title: title || "Show more", blocks });
      else if (kind === "step") out.push({ type: "step", title, blocks });
      else if ((OPERATING_SYSTEMS as readonly string[]).includes(kind)) out.push({ type: "os", os: kind as OperatingSystem, blocks });
      else if (kind === "video") out.push({ type: "video", id: title });
      else out.push({ type: "key", title: title || null, blocks });
      i = j + 1;
      continue;
    }

    if (QUOTE.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) quoted.push(lines[i++].replace(QUOTE, ""));
      out.push({ type: "quote", blocks: parseLines(quoted) });
      continue;
    }

    const first = topItem(line);
    if (first) {
      const items: { text: string; sub: string[] }[] = [];
      while (i < lines.length) {
        const l = lines[i];
        const item = topItem(l);
        if (item) {
          if (item.ordered !== first.ordered) break;
          items.push({ text: item.text, sub: [] });
          i++;
        } else if (/^\s{2,}\S/.test(l)) {
          items[items.length - 1].sub.push(l);
          i++;
        } else if (!l.trim()) {
          // A blank line ends the list unless the list carries on after it.
          let k = i + 1;
          while (k < lines.length && !lines[k].trim()) k++;
          const next = k < lines.length ? lines[k] : "";
          if (topItem(next)?.ordered === first.ordered || /^\s{2,}\S/.test(next)) i = k;
          else break;
        } else break;
      }
      out.push({
        type: "list",
        ordered: first.ordered,
        items: items.map((it) => ({ text: it.text, children: it.sub.length ? parseLines(dedent(it.sub)) : [] })),
      });
      continue;
    }

    const para: string[] = [line.trim()];
    i++;
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) para.push(lines[i++].trim());
    const text = para.join("\n");
    const heading = text.match(/^\*\*([^*\n]+)\*\*$/);
    out.push(heading ? { type: "h", text: heading[1] } : { type: "p", text });
  }
  return out;
}

// --- Inline -----------------------------------------------------------------

export type Inline =
  | { type: "text"; text: string }
  | { type: "bold"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "br" };

/** Split inline text into bold, code, line breaks and plain text. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /`([^`]+)`|\*\*([\s\S]+?)\*\*|\n/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ type: "text", text: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ type: "code", text: m[1] });
    else if (m[2] !== undefined) out.push({ type: "bold", children: parseInline(m[2]) });
    else out.push({ type: "br" });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

// --- Glossary terms in text -------------------------------------------------

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Acronyms ("NDA", "NDAs", "BM25") only match in capitals. */
const isAcronym = (alias: string) => /^[A-Z][A-Z0-9]+s?$/.test(alias);

type Matcher = { re: RegExp; byAlias: Map<string, { id: string; exact: string | null }>; patterns: { id: string; re: RegExp }[] };

function buildMatcher(glossary: GlossaryTerm[]): Matcher {
  const byAlias = new Map<string, { id: string; exact: string | null }>();
  const patterns: { id: string; re: RegExp }[] = [];
  const alts: string[] = [];
  for (const g of glossary) {
    if (g.pattern) {
      patterns.push({ id: g.id, re: new RegExp(`^(?:${g.pattern})$`) });
      alts.push(g.pattern);
      continue;
    }
    for (const a of g.aliases) {
      byAlias.set(a.toLowerCase(), { id: g.id, exact: isAcronym(a) ? a : null });
    }
  }
  const words = Array.from(byAlias.keys()).sort((a, b) => b.length - a.length);
  alts.push(...words.map(escape));
  // Whole words only: "index" never matches inside "indexing" or "index/".
  const re = new RegExp(`(?<![\\w-])(?:${alts.join("|")})(?![\\w/-])`, "gi");
  return { re, byAlias, patterns };
}

let cached: Matcher | null = null;
const matcher = () => (cached ??= buildMatcher(GLOSSARY));

export type TermSpan = { start: number; end: number; id: string };

/** Every glossary term in `text`, in order, without overlaps. */
export function findTerms(text: string): TermSpan[] {
  const { re, byAlias, patterns } = matcher();
  const out: TermSpan[] = [];
  re.lastIndex = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const hit = m[0];
    const alias = byAlias.get(hit.toLowerCase());
    const id = alias ? (alias.exact === null || alias.exact === hit ? alias.id : null) : (patterns.find((p) => p.re.test(hit))?.id ?? null);
    if (id) out.push({ start: m.index, end: m.index + hit.length, id });
  }
  return out;
}

/** The glossary term a whole code span names, e.g. `prompts/generate.md`. */
export function termForCode(code: string): string | null {
  const alias = matcher().byAlias.get(code.toLowerCase());
  return alias && (alias.exact === null || alias.exact === code) ? alias.id : null;
}

/** Plain text of a markdown string (for tests and search). */
export function markdownText(src: string): string {
  return src
    .replace(/^(?:```|~~~).*$/gm, "")
    .replace(/^:::\w*.*$/gm, "")
    .replace(/\*\*|`/g, "")
    .replace(/^\s*(?:[-*]|\d+\.|>)\s?/gm, "");
}
