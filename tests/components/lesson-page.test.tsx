// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { modules } from "@/content";
import { GLOSSARY } from "@/content/glossary";

vi.mock("@/app/actions/explain-back", () => ({ saveExplainBack: vi.fn() }));

let pathname = "/modules/rag-foundations";
vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), usePathname: () => pathname }));

const m01 = modules.find((m) => m.id === "m01")!;
const m02 = modules.find((m) => m.id === "m02")!;
let current = m01;

/** Fake supabase serving one module's content, the way the seed stores it. */
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: (table: string) => {
      const m = current;
      const data: Record<string, unknown> = {
        modules: { ...m, hook: m.hook ?? null, pipeline_stages: m.pipeline_stages ?? [], explain_back_prompt: m.explain_back_prompt ?? null, video: null },
        lesson_steps: m.lesson_steps.map((s) => ({ code_snippet: null, code_language: null, ...s })),
        progress: null,
        failure_cases: m.failure_cases.map((f) => ({ cause_options: null, correct_cause: null, ...f })),
        worked_example_steps: (m.worked_example ?? []).map((w) => ({ code_snippet: null, stage: null, query_state: null, ...w })),
        module_glossary: (m.glossary ?? []).map((id, i) => ({ order_index: i + 1, glossary_terms: GLOSSARY.find((g) => g.id === id) })),
        study_guide_points: m.study_guide ?? [],
        explain_back_responses: null,
      };
      const result = { data: data[table] ?? [], count: table === "quiz_items" ? m.quiz_items.length : null, error: null };
      const q: Record<string, unknown> = {};
      for (const k of ["select", "eq", "gt", "order", "limit"]) q[k] = () => q;
      q.maybeSingle = async () => result;
      q.single = async () => result;
      q.then = (r: (v: unknown) => void) => r(result);
      return q;
    },
  }),
}));

import ModulePage from "@/app/modules/[slug]/page";
import ModuleLayout from "@/app/modules/[slug]/layout";
import LessonTabPage from "@/app/modules/[slug]/[page]/page";
import { lessonTabs, partSteps } from "@/lib/course/lesson-tabs";

afterEach(cleanup);
beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
});
const before = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
const parts = partSteps(m01.lesson_steps);

/** Render a lesson page inside the shared layout, at its URL. */
async function show(page?: string, m = m01) {
  current = m;
  pathname = `/modules/${m.slug}${page ? `/${page}` : ""}`;
  const children = page
    ? await LessonTabPage({ params: { slug: m.slug, page } })
    : await ModulePage({ params: { slug: m.slug }, searchParams: {} });
  return render(await ModuleLayout({ params: { slug: m.slug }, children }));
}
const sidebar = () => screen.getByRole("navigation", { name: "Lesson pages" });
const tabLinks = () => within(sidebar()).getAllByRole("link");
const pager = () => screen.getByRole("navigation", { name: "Back and next" });

describe("tabbed lesson: sidebar", () => {
  it("has one tab per page, in order, with Hands-on right after Go deeper and the quiz last", async () => {
    await show();
    expect(tabLinks().map((a) => a.textContent?.replace(/^[✓\d]+/, ""))).toEqual([
      "RAG Foundations",
      ...parts.map((s) => s.title),
      "Practice: when it goes wrong",
      "Go deeper",
      "Hands-on",
      "Glossary",
      "Study guide",
      "Module quiz",
    ]);
    expect(tabLinks().map((a) => a.getAttribute("href"))).toEqual([
      "/modules/rag-foundations",
      ...parts.map((_, i) => `/modules/rag-foundations/part-${i + 1}`),
      ...["practice", "go-deeper", "hands-on", "glossary", "study", "quiz"].map((k) => `/modules/rag-foundations/${k}`),
    ]);
  });

  it("highlights the current tab and ticks pages already visited", async () => {
    await show();
    await show("part-1");
    cleanup();
    await show("part-2");
    expect(within(sidebar()).getByRole("link", { current: "page" })).toHaveTextContent(parts[1].title);
    expect(within(sidebar()).getByRole("link", { name: /RAG Foundations ?\(visited\)/ })).toBeInTheDocument();
    expect(within(sidebar()).getByRole("link", { name: new RegExp(`${parts[0].title} ?\\(visited\\)`) })).toBeInTheDocument();
    expect(within(sidebar()).queryByRole("link", { name: /Go deeper ?\(visited\)/ })).toBeNull();
  });

  it("keeps the quiz tab current through the quiz flow", async () => {
    current = m01;
    pathname = "/modules/rag-foundations/quiz";
    render(await ModuleLayout({ params: { slug: "rag-foundations" }, children: <p>quiz</p> }));
    expect(within(sidebar()).getByRole("link", { current: "page" })).toHaveTextContent("Module quiz");
  });

  it("collapses into a menu at the top on small screens", async () => {
    await show("go-deeper");
    const toggle = screen.getByRole("button", { name: "Menu" });
    const list = document.getElementById(toggle.getAttribute("aria-controls")!)!;
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(list).toHaveClass("hidden", "md:block");
    expect(sidebar()).toHaveTextContent(`Page ${parts.length + 3} of ${parts.length + 7}: Go deeper`);
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Close" })).toHaveAttribute("aria-expanded", "true");
    expect(list).toHaveClass("block");
    expect(list).not.toHaveClass("hidden");
  });
});

describe("tabbed lesson: pages", () => {
  it("overview: hook → objectives → warm-up → Learn and the parts, then Next", async () => {
    await show();
    const learn = screen.getByRole("heading", { level: 2, name: "Learn" });
    const order = [screen.getByRole("heading", { level: 1, name: "RAG Foundations" }), screen.getByRole("region", { name: "Why this matters" }), screen.getByText("What you'll be able to do"), screen.getByRole("region", { name: "Warm-up" }), learn];
    for (let i = 1; i < order.length; i++) expect(before(order[i - 1], order[i]), `#${i}`).toBe(true);
    expect(screen.queryByText("The lesson")).toBeNull();
    const list = learn.nextElementSibling as HTMLElement;
    expect(within(list).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(parts.map((_, i) => `/modules/rag-foundations/part-${i + 1}`));
    expect(screen.queryByRole("heading", { name: "When it goes wrong" })).toBeNull();
    expect(within(pager()).queryByText("← Back")).toBeNull();
    expect(within(pager()).getByRole("link")).toHaveAttribute("href", "/modules/rag-foundations/part-1");
  });

  it.each(parts.map((s, i) => [i + 1, s] as const))("part %i is its own page, with Back and Next", async (n, s) => {
    await show(`part-${n}`);
    expect(screen.getByRole("heading", { level: 1, name: s.title })).toBeInTheDocument();
    expect(screen.getByText(`Part ${n} of ${parts.length}`)).toBeInTheDocument();
    const [back, next] = within(pager()).getAllByRole("link");
    expect(back).toHaveAttribute("href", n === 1 ? "/modules/rag-foundations" : `/modules/rag-foundations/part-${n - 1}`);
    expect(next).toHaveAttribute("href", n === parts.length ? "/modules/rag-foundations/practice" : `/modules/rag-foundations/part-${n + 1}`);
    for (const other of parts.filter((o) => o.id !== s.id)) expect(screen.queryByRole("heading", { name: other.title })).toBeNull();
  });

  it("practice: the failure cases with the cause picker", async () => {
    await show("practice");
    expect(screen.getByRole("heading", { level: 1, name: "When it goes wrong" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Check cause" })).toHaveLength(3);
  });

  it("go deeper: the pipeline diagram and the worked example, and nothing after them", async () => {
    await show("go-deeper");
    expect(screen.getByRole("button", { name: "[2] hybrid retrieval, you are here" })).toBeInTheDocument();
    expect(before(screen.getByRole("heading", { name: "Where you are in the pipeline" }), screen.getByRole("heading", { name: "Worked example, step by step" }))).toBe(true);
    expect(screen.queryByRole("heading", { name: "Glossary" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Explain it back" })).toBeNull();
  });

  it("hands-on: the three tiers, revealed one at a time", async () => {
    await show("hands-on");
    expect(screen.getByRole("heading", { level: 1, name: "Hands-on: try it yourself" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Start here" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "On your own" })).toBeNull();
    const [back, next] = within(pager()).getAllByRole("link");
    expect(back).toHaveAttribute("href", "/modules/rag-foundations/go-deeper");
    expect(next).toHaveAttribute("href", "/modules/rag-foundations/glossary");
  });

  it("glossary: every one of the module's terms, fully expanded", async () => {
    const { container } = await show("glossary");
    const terms = within(screen.getByRole("region", { name: "Glossary" })).getAllByRole("term");
    expect(terms.map((t) => t.textContent)).toEqual(m01.glossary!.map((id) => GLOSSARY.find((g) => g.id === id)!.term));
    expect(container.querySelector("article details")).toBeNull();
  });

  it("study guide: the points, with explain-it-back at the bottom, then Next is the quiz", async () => {
    await show("study");
    expect(screen.getAllByText("Narration")).toHaveLength(m01.study_guide!.length);
    const lastPoint = screen.getAllByText("Narration").at(-1)!;
    expect(before(lastPoint, screen.getByRole("heading", { name: "Explain it back" }))).toBe(true);
    const [, next] = within(pager()).getAllByRole("link");
    expect(next).toHaveAttribute("href", "/modules/rag-foundations/quiz");
    expect(next).toHaveTextContent("Module quiz");
  });

  it("404s an unknown tab", async () => {
    current = m01;
    await expect(LessonTabPage({ params: { slug: "rag-foundations", page: "nope" } })).rejects.toThrow(/NEXT_NOT_FOUND/);
  });

  it.each(["", ...parts.map((_, i) => `part-${i + 1}`), "practice", "go-deeper", "hands-on", "glossary", "study"])("/%s renders no raw markdown", async (page) => {
    const { container } = await show(page || undefined);
    expect(container.textContent).not.toMatch(/\*\*|:::/);
  });
});

describe("modules not in the lesson format", () => {
  // Every module is in the lesson format now; a module without a hook still
  // gets the single-page layout.
  const legacy = { ...m02, hook: undefined, worked_example: [], glossary: [], study_guide: [] } as typeof m02;

  it("keep the single-page layout, with no sidebar and the quiz behind a link", async () => {
    await show(undefined, legacy);
    expect(screen.queryByRole("navigation", { name: "Lesson pages" })).toBeNull();
    for (const s of legacy.lesson_steps) expect(screen.getByRole("heading", { name: s.title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Take the quiz →" })).toHaveAttribute("href", `/modules/${legacy.slug}/quiz`);
  });

  it("have no tab pages", async () => {
    current = legacy;
    await expect(LessonTabPage({ params: { slug: legacy.slug, page: "part-1" } })).rejects.toThrow(/NEXT_NOT_FOUND/);
  });
});

describe("every module, every tab", () => {
  const pagesOf = (m: typeof m01) =>
    lessonTabs({
      slug: m.slug,
      title: m.title,
      steps: m.lesson_steps,
      failures: m.failure_cases.length,
      glossary: m.glossary?.length ?? 0,
      studyPoints: m.study_guide?.length ?? 0,
      quizItems: 0, // the quiz has its own page
      goDeeper: (m.worked_example?.length ?? 0) > 0 || (m.pipeline_stages?.length ?? 0) > 0,
      setup: m.id === "m00",
    }).map((t) => (t.key === "overview" ? "" : t.key));
  it.each(modules.filter((m) => m.id !== "m12").map((m) => [m.id, m] as const))("%s renders every tab with no raw markdown", async (_id, m) => {
    for (const page of m.hook ? pagesOf(m) : [""]) {
      const { container } = await show(page || undefined, m);
      expect(container.textContent, `${m.id}/${page}`).not.toMatch(/\*\*|:::/);
      cleanup();
    }
  });
});
