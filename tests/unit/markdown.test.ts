import { describe, expect, it } from "vitest";
import { findTerms, parseInline, parseMarkdown, termForCode } from "@/lib/course/markdown";
import { parseHandsOn } from "@/lib/course/hands-on";
import { modules } from "@/content";

const words = (text: string) => findTerms(text).map((t) => [text.slice(t.start, t.end), t.id]);

describe("parseMarkdown", () => {
  it("splits paragraphs, bold-only subheadings, lists right after a line, and quotes", () => {
    const blocks = parseMarkdown("Intro line\nsecond line\n\n**Getting ready**\n- **Load** it\n- Chunk it\n\n> quoted\n\n1. one\n2. two");
    expect(blocks.map((b) => b.type)).toEqual(["p", "h", "list", "quote", "list"]);
    expect(blocks[0]).toEqual({ type: "p", text: "Intro line\nsecond line" });
    expect(blocks[1]).toEqual({ type: "h", text: "Getting ready" });
    expect(blocks[4]).toMatchObject({ type: "list", ordered: true, items: [{ text: "one" }, { text: "two" }] });
  });

  it("nests indented bullets under a numbered item", () => {
    const [list] = parseMarkdown("1. Rewrite:\n   - first\n   - second\n2. Next");
    expect(list).toMatchObject({ type: "list", ordered: true });
    if (list.type !== "list") throw new Error();
    expect(list.items).toHaveLength(2);
    expect(list.items[0].children[0]).toMatchObject({ type: "list", ordered: false, items: [{ text: "first" }, { text: "second" }] });
  });

  it("reads :::key and :::more boxes", () => {
    const blocks = parseMarkdown("Before\n\n:::key Two jobs\nThe **librarian**.\n:::\n\n:::more How it's done\n- a\n:::");
    expect(blocks).toMatchObject([
      { type: "p" },
      { type: "key", title: "Two jobs", blocks: [{ type: "p", text: "The **librarian**." }] },
      { type: "more", title: "How it's done", blocks: [{ type: "list" }] },
    ]);
  });

  it("turns bold and code into inline nodes, never raw asterisks", () => {
    expect(parseInline("A **bold `x`** and `prompts/generate.md`\nnext")).toEqual([
      { type: "text", text: "A " },
      { type: "bold", children: [{ type: "text", text: "bold " }, { type: "code", text: "x" }] },
      { type: "text", text: " and " },
      { type: "code", text: "prompts/generate.md" },
      { type: "br" },
      { type: "text", text: "next" },
    ]);
  });
});

describe("findTerms", () => {
  it("matches acronyms in capitals only, and whole words only", () => {
    expect(words("The NDA and two NDAs, but not nda or agenda.")).toEqual([
      ["NDA", "nda"],
      ["NDAs", "nda"],
    ]);
    expect(words("indexing builds the index, not index/")).toEqual([["index", "index"]]);
  });

  it("prefers the longest alias and ignores case for ordinary words", () => {
    expect(words("Permitted Recipients and an embedding model")).toEqual([
      ["Permitted Recipients", "permitted-recipient"],
      ["embedding model", "embedding"],
    ]);
    expect(words("Retrieval-augmented generation")).toEqual([["Retrieval-augmented generation", "rag"]]);
  });

  it("links section references to the § entry", () => {
    expect(words("see §4.2(b) and §1.1")).toEqual([
      ["§4.2(b)", "section-sign"],
      ["§1.1", "section-sign"],
    ]);
  });

  it("knows file names in code spans", () => {
    expect(termForCode("prompts/generate.md")).toBe("prompt-file");
    expect(termForCode("index/")).toBeNull();
  });
});

describe("parseHandsOn", () => {
  it("reads the three tiers and the project details from every module's hands-on step", () => {
    const exercises = modules.flatMap((m) => m.lesson_steps.filter((s) => s.kind === "exercise" && /\*\*Guided:\*\*|^:::tier guided/m.test(s.body_md)));
    expect(exercises.length).toBeGreaterThanOrEqual(11);
    for (const s of exercises) {
      const plan = parseHandsOn(s.body_md);
      expect(plan, s.id).not.toBeNull();
      expect(plan!.tiers.map((t) => t.level), s.id).toEqual(["guided", "partial", "solo"]);
    }
  });

  it("softens the internal labels and keeps the prediction up front", () => {
    const m01 = modules.find((m) => m.id === "m01")!;
    const plan = parseHandsOn(m01.lesson_steps.find((s) => s.kind === "exercise")!.body_md)!;
    expect(plan.intro).toMatch(/^\*\*Predict first:\*\*/);
    expect(plan.project.map((p) => p.label)).toEqual(["What you'll have at the end", "Where to save it", "Ask your coding assistant to check it"]);
    expect(JSON.stringify(plan.tiers)).not.toMatch(/capstone/i);
  });

  it("reads the block form, keeping each tier's full markdown", () => {
    const plan = parseHandsOn("**Predict first:** guess.\n\n:::tier guided\n:::step One\n**Do:** x\n:::\n:::\n\n:::tier partial\nLess help.\n:::\n\n:::tier solo\nNone.\n:::\n\n**Capstone branch:** \`b\`");
    expect(plan!.tiers.map((t) => t.level)).toEqual(["guided", "partial", "solo"]);
    expect(plan!.tiers[0].text).toBe(":::step One\n**Do:** x\n:::");
    expect(plan!.project).toEqual([{ label: "Where to save it", text: "\`b\`" }]);
  });

  it("returns null for steps that don't follow the pattern", () => {
    expect(parseHandsOn("Just do the thing.")).toBeNull();
  });
});
