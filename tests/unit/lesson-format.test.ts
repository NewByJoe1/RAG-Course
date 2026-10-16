import { describe, expect, it } from "vitest";
import { modules } from "@/content";
import { moduleSchema, type ModuleContent } from "@/content/types";
import { NDA_CLAUSES, RUNNING_QUESTION } from "@/content/nda";
import { PIPELINE, PIPELINE_STAGE_IDS } from "@/content/pipeline";
import { GLOSSARY } from "@/content/glossary";

const m01 = modules.find((m) => m.id === "m01")!;
const parse = (m: ModuleContent) => moduleSchema.safeParse(m);
const messages = (m: ModuleContent) => {
  const r = parse(m);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe("beginner lesson format", () => {
  it("is used by Module 1 only, until Modules 2–11 are reviewed and rewritten", () => {
    expect(modules.filter((m) => m.hook).map((m) => m.id)).toEqual(["m01"]);
  });

  it("is all-or-nothing: a hook needs every other part", () => {
    expect(messages({ ...m01, study_guide: [] })).toContain("m01 has a hook, so it needs at least 3 study_guide points");
    expect(messages({ ...m01, explain_back_prompt: null })).toContain("m01 has a hook, so it needs an explain_back_prompt");
    expect(messages({ ...m01, pipeline_stages: [] })).toContain("m01 has a hook, so it needs pipeline_stages");
    expect(messages({ ...m01, lesson_steps: m01.lesson_steps.slice(1) })).toContain("m01 has a hook, so it needs a warm_up lesson step first");
    const m02 = modules.find((m) => m.id === "m02")!;
    expect(messages({ ...m02, worked_example: m01.worked_example!.map((w) => ({ ...w, id: w.id.replace("m01", "m02") })) })).toContain(
      "m02: lesson-structure fields need a hook too",
    );
  });

  it("rejects unknown glossary terms and stages", () => {
    expect(messages({ ...m01, glossary: [...m01.glossary!, "not-a-term"] })).toContain('m01: glossary term "not-a-term" isn\'t in content/glossary.ts');
    expect(parse({ ...m01, pipeline_stages: ["retrieval" as never] }).success).toBe(false);
  });

  it("puts the warm-up first and keeps the worked example out of the lesson steps", () => {
    expect(m01.lesson_steps[0].kind).toBe("warm_up");
    expect(m01.lesson_steps.some((s) => s.kind === "example")).toBe(false);
  });
});

describe("pipeline spine", () => {
  it("uses the exact seven stage labels, in order", () => {
    expect(PIPELINE.map((s) => `[${s.number}] ${s.label}`)).toEqual([
      "[1] pre-retrieval",
      "[1b] routing",
      "[2] hybrid retrieval",
      "[3] post-retrieval",
      "[4] re-rank",
      "[5] generation",
      "[6] eval & guardrails",
    ]);
    expect(PIPELINE.map((s) => s.id)).toEqual([...PIPELINE_STAGE_IDS]);
  });

  it("gives each stage a plain one-liner, what it does, why and how, with the running example", () => {
    for (const s of PIPELINE) {
      for (const k of ["plain", "does", "why", "how", "example"] as const) expect(s[k].length, `${s.id}.${k}`).toBeGreaterThan(20);
    }
  });

  it("every glossary term's stage is a real stage", () => {
    for (const g of GLOSSARY) if (g.stage) expect(PIPELINE_STAGE_IDS).toContain(g.stage);
  });
});

describe("Module 1 stays on the running example", () => {
  const onThread = (t: string) => /subcontractor|\bNDA\b|§\d|Permitted Recipient/.test(t);
  // The off-thread examples the old Module 1 used.
  const drift = /E4021|error code|refund|Pro plan|pricing|employee handbook|API reference|\bSKU|orders? (did we ship|table)/i;

  it("ties every lesson step, worked step and failure case to the NDA or the subcontractor question", () => {
    const material = m01.lesson_steps.filter((s) => s.kind !== "warm_up");
    for (const s of material) expect(onThread(`${s.title} ${s.body_md}`), s.id).toBe(true);
    for (const w of m01.worked_example!) expect(onThread(`${w.title} ${w.body_md} ${w.query_state ?? ""} ${w.code_snippet ?? ""}`), w.id).toBe(true);
    for (const f of m01.failure_cases) expect(f.user_query, f.id).toBe(RUNNING_QUESTION);
  });

  it("no longer drifts into unrelated documents", () => {
    const all = JSON.stringify(m01);
    expect(all.match(drift)).toBeNull();
  });

  it("quotes the NDA's clauses exactly as the shared NDA defines them", () => {
    const text = JSON.stringify(m01);
    for (const c of [NDA_CLAUSES.definitions, NDA_CLAUSES.permittedDisclosure, NDA_CLAUSES.contractors]) expect(text).toContain(JSON.stringify(c.text).slice(1, -1));
  });

  it("sets up what Module 2's warm-up asks about", () => {
    const text = JSON.stringify(m01);
    expect(text).toMatch(/librarian retrieves the right pages/i);
    expect(text).toMatch(/The writer answers only from them/i);
    expect(text).toContain("prompts/generate.md");
    expect(text).toContain("The contract does not address this.");
    expect(m01.failure_cases[0].retrieved_context[0].source).toMatch(/Definitions/); // "the definitions clause"
  });
});
