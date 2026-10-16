import { describe, expect, it } from "vitest";
import { modules } from "@/content";
import { GLOSSARY, GLOSSARY_BY_ID } from "@/content/glossary";
import { PIPELINE } from "@/content/pipeline";
import { findTerms, termForCode } from "@/lib/course/markdown";
import { learnerText, prose } from "../support/learner-text";

// Course-wide rule: never leave a term or acronym unexplained. Every acronym
// is spelled out on first use and every term a learner meets has a glossary
// entry. Enforced for modules in the lesson format (Module 1 for now).

const lessonModules = modules.filter((m) => m.hook);
const ACRONYM = /\b[A-Z][A-Z0-9]+s?\b/g;
const aliasSet = new Set(GLOSSARY.flatMap((g) => g.aliases));
/** "NDA (non-disclosure agreement)" → ["NDA", "non-disclosure agreement"] */
const acronymTerms = GLOSSARY.map((g) => g.term.match(/^([A-Z][A-Z0-9]+) \((.+)\)$/)).filter((m): m is RegExpMatchArray => m !== null);

const termsIn = (texts: string[]) => {
  const ids = new Set<string>();
  for (const t of texts) {
    for (const f of findTerms(prose(t))) ids.add(f.id);
    for (const c of t.match(/`[^`]+`/g) ?? []) {
      const id = termForCode(c.slice(1, -1));
      if (id) ids.add(id);
    }
  }
  return ids;
};

describe("glossary", () => {
  it("has unique ids and aliases, and short one-line definitions", () => {
    expect(new Set(GLOSSARY.map((g) => g.id)).size).toBe(GLOSSARY.length);
    const aliases = GLOSSARY.flatMap((g) => g.aliases.map((a) => a.toLowerCase()));
    expect(aliases.length - new Set(aliases).size).toBe(0);
    for (const g of GLOSSARY) {
      expect(g.aliases.length, g.id).toBeGreaterThan(0);
      expect(g.definition.length, g.id).toBeLessThanOrEqual(160);
      expect(g.definition, g.id).not.toMatch(/\n/);
    }
  });

  it("covers plain contract vocabulary, not just RAG jargon", () => {
    for (const id of ["nda", "clause", "confidential-information", "third-party", "permitted-recipient"]) expect(GLOSSARY_BY_ID[id], id).toBeDefined();
  });

  it("explains its own acronyms (definitions use no undefined acronyms)", () => {
    for (const g of GLOSSARY) for (const a of g.definition.match(ACRONYM) ?? []) expect(aliasSet, `${g.id}: ${a}`).toContain(a);
  });
});

describe.each(lessonModules.map((m) => [m.id, m] as const))("%s: no term left unexplained", (_id, m) => {
  const texts = learnerText(m);

  it("defines every acronym it uses in the glossary", () => {
    for (const t of texts) for (const a of prose(t).match(ACRONYM) ?? []) expect(aliasSet, `"${a}" in: ${t.slice(0, 80)}`).toContain(a);
  });

  it("spells each acronym out the first time it appears", () => {
    const all = texts.map(prose).join("\n\n");
    for (const [, acronym, expansion] of acronymTerms) {
      const at = all.search(new RegExp(`\\b${acronym}s?\\b`));
      if (at < 0) continue;
      const near = all.slice(Math.max(0, at - 120), at + acronym.length + 120).toLowerCase();
      expect(near, `${acronym} first used without "${expansion}"`).toContain(expansion.toLowerCase());
    }
  });

  it("lists every glossary term it uses in its own glossary", () => {
    const used = termsIn(texts);
    const missing = Array.from(used).filter((id) => !m.glossary!.includes(id));
    expect(missing).toEqual([]);
  });
});

describe("pipeline overview", () => {
  const texts = PIPELINE.flatMap((s) => [s.plain, s.does, s.why, s.how, s.example]);

  it("defines every acronym it uses", () => {
    for (const t of texts) for (const a of prose(t).match(ACRONYM) ?? []) expect(aliasSet, a).toContain(a);
  });

  it("explains every file it names in a plain sentence, not just the name", () => {
    for (const s of PIPELINE) {
      for (const line of s.how.split("\n")) {
        if (!/`[^`]*\.(md|yaml|jsonl|py)`/.test(line)) continue;
        // The file name plus at least one full sentence saying what it is.
        expect(prose(line).replace(/\*\*[^*]+\*\*/g, "").split(/[.:]\s/).filter((p) => p.trim().split(/\s+/).length >= 6).length, `${s.id}: ${line.slice(0, 60)}`).toBeGreaterThan(0);
        expect(line, s.id).toMatch(/plain text|a file of|program/i);
      }
    }
  });
});
